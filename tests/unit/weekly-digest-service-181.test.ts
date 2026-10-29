import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChangelogEntry } from "../../lib/data/changelog-generator";
import type { NewWeeklyDigest, WeeklyDigest } from "../../lib/db/schema";
import type { DigestArticle } from "../../lib/services/weekly-digest-input";
import type { WeeklyDigestRepository } from "../../lib/services/weekly-digest.repository";
import { WeeklyDigestError, generateWeeklyDigest } from "../../lib/services/weekly-digest.service";
import { countDigestWords } from "../../lib/weekly-digest-validate";

/**
 * Weekly digest generate-and-store (#181).
 *
 * Why: the digest is a paid LLM call that publishes to readers and RSS, so the
 * digest rules must hold: nothing for an empty week, a short digest for one or
 * two articles, a stored week never rewritten without `force`, one retry for a
 * body the validator rejects, and no write on any failure.
 * What: runs the real service, input rules and validator over an in-memory
 * repository and a stubbed OpenRouter `fetch`; only those two boundaries are
 * replaced.
 * Test: `npx vitest run tests/unit/weekly-digest-service-181.test.ts`. No
 * database, no network.
 */

vi.mock("../../lib/startup-validation", () => ({ getOpenRouterApiKey: () => "test-key" }));

// A Monday 07:30 UTC run: the window is the week before, 2026-W43.
const NOW = new Date("2026-10-26T07:30:00Z");
const WEEK = "2026-W43";

const GOOD_SUMMARY = `${Array.from({ length: 99 }, () => "plain").join(" ")} end.`;

function article(n: number, over: Partial<DigestArticle> = {}): DigestArticle {
  return {
    id: `a${n}`,
    slug: `story-${n}`,
    title: `Story ${n}`,
    summary: GOOD_SUMMARY,
    publishedAt: new Date("2026-10-21T10:00:00Z"),
    toolMentions: [{ tool: "Alpha" }],
    ...over,
  };
}

const words = (n: number) => `${Array.from({ length: n - 1 }, () => "word").join(" ")} done.`;

/** A valid full body of 300 words that links story-1 to story-3. */
function fullBody(): string {
  return [
    words(40),
    "",
    "## The week in short",
    `- ${words(10)} [one](/en/news/story-1)`,
    `- ${words(10)} [two](/en/news/story-2)`,
    `- ${words(10)} [three](/en/news/story-3)`,
    "",
    "## What mattered",
    words(120),
    "",
    "## New and changed",
    words(30),
  ].join("\n");
}

function sized(body: string, target: number): string {
  const have = countDigestWords(body);
  return body.replace(words(120), words(120 + target - have));
}
const VALID_FULL = sized(fullBody(), 300);
const VALID_SHORT = `${words(60)}\n- ${words(20)} [one](/en/news/story-1)\n- ${words(10)} [two](/en/news/story-2)`;

interface Fixture {
  repo: WeeklyDigestRepository & { rows: Map<string, WeeklyDigest>; save: ReturnType<typeof vi.fn> };
  loadArticles: ReturnType<typeof vi.fn>;
}

function makeRepo(articles: DigestArticle[], stored?: Partial<WeeklyDigest>): Fixture {
  const rows = new Map<string, WeeklyDigest>();
  if (stored) rows.set(WEEK, { week: WEEK, content: "OLD", dataHash: "old", ...stored } as WeeklyDigest);
  const loadArticles = vi.fn(async () => articles);
  const save = vi.fn(async (row: NewWeeklyDigest, overwrite: boolean) => {
    if (rows.has(row.week) && !overwrite) return false;
    rows.set(row.week, row as WeeklyDigest);
    return true;
  });
  const repo = {
    rows,
    getByWeek: vi.fn(async (week: string) => rows.get(week) ?? null),
    loadArticles,
    loadNewTools: vi.fn(async () => [{ id: "t1", name: "Newtool", category: "code-editor" }]),
    save,
  };
  return { repo, loadArticles };
}

function completion(content: string, finish = "stop") {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content }, finish_reason: finish }],
      usage: { prompt_tokens: 1200, completion_tokens: 480 },
    }),
    { status: 200 }
  );
}

const llm = vi.fn<(url: string, init: RequestInit) => Promise<Response>>();
vi.stubGlobal("fetch", llm);

const run = (f: Fixture, options: { force?: boolean; dryRun?: boolean } = {}, changelog: ChangelogEntry[] = []) =>
  generateWeeklyDigest({ now: NOW, ...options }, { repository: f.repo, changelog });

function promptOf(call: number): string {
  const body = JSON.parse(String(llm.mock.calls[call]?.[1].body)) as { messages: Array<{ content: string }> };
  return body.messages.map((m) => m.content).join("\n");
}

beforeEach(() => {
  llm.mockReset();
});

describe("generateWeeklyDigest branches (#181)", () => {
  it("0 articles: skips with no LLM call and no write", async () => {
    const f = makeRepo([]);
    const outcome = await run(f);
    expect(outcome).toEqual({ status: "skipped", week: WEEK, reason: "no-articles" });
    expect(llm).not.toHaveBeenCalled();
    expect(f.repo.save).not.toHaveBeenCalled();
  });

  it("1-2 articles: one LLM call for a short digest, stored as tier short", async () => {
    llm.mockResolvedValue(completion(VALID_SHORT));
    const f = makeRepo([article(1), article(2)]);
    const outcome = await run(f);
    expect(outcome).toMatchObject({ status: "generated", week: WEEK, tier: "short", attempts: 1 });
    expect(llm).toHaveBeenCalledTimes(1);
    expect(promptOf(0)).toContain("quiet week");
    expect(f.repo.rows.get(WEEK)?.metadata).toMatchObject({ tier: "short", article_count: 2 });
  });

  it("3+ articles: the full shape, with a code-built title and source list around the body", async () => {
    llm.mockResolvedValue(completion(VALID_FULL));
    const f = makeRepo([article(1), article(2), article(3), article(4)]);
    const outcome = await run(f);
    expect(outcome).toMatchObject({ status: "generated", tier: "full", attempts: 1 });
    const row = f.repo.rows.get(WEEK)!;
    expect(row.content.startsWith("# AI coding tools: week of Oct 19 to Oct 25, 2026\n")).toBe(true);
    expect(row.content).toContain(VALID_FULL.trim());
    for (let n = 1; n <= 4; n++) expect(row.content).toContain(`- [Story ${n}](/en/news/story-${n})`);
    expect(row.windowStart.toISOString()).toBe("2026-10-19T00:00:00.000Z");
    expect(row.windowEnd.toISOString()).toBe("2026-10-25T23:59:59.999Z");
    expect(row.dataHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.metadata).toMatchObject({
      tier: "full",
      article_count: 4,
      new_tool_count: 1,
      prompt_tokens: 1200,
      completion_tokens: 480,
      attempts: 1,
      article_ids: ["a1", "a2", "a3", "a4"],
      tool_names: ["Alpha"],
    });
  });

  it("reads the previous full ISO week, Monday to Sunday UTC", async () => {
    const f = makeRepo([]);
    await run(f);
    const window = f.loadArticles.mock.calls[0]?.[0] as { start: Date; end: Date };
    expect(window.start.toISOString()).toBe("2026-10-19T00:00:00.000Z");
    expect(window.end.toISOString()).toBe("2026-10-25T23:59:59.999Z");
  });
});

describe("generateWeeklyDigest inputs (#181)", () => {
  it("sends validated summaries as stored, truncates a long one, and never sends a score", async () => {
    llm.mockResolvedValue(completion(VALID_FULL));
    const longOld = Array.from({ length: 450 }, (_, i) => `legacy${i}`).join(" ");
    const f = makeRepo([article(1), article(2, { summary: longOld }), article(3)]);
    await run(f, {}, [
      {
        id: "c1",
        version: "Unreleased",
        date: "2026-10-22T09:00:00.000Z",
        dateSource: "commit",
        section: "Added",
        scope: "news",
        title: "digest page (#181)",
        description: "x",
        changeType: "feature",
      },
    ]);
    const prompt = promptOf(0);
    expect(prompt).toContain(GOOD_SUMMARY);
    expect(prompt).toContain("legacy0");
    expect(prompt).not.toContain("legacy100");
    expect(prompt).toContain("- Newtool (code-editor)");
    expect(prompt).toContain("- digest page");
    expect(prompt).not.toContain("#181");
    expect(prompt).not.toMatch(/importance/i);
  });
});

describe("generateWeeklyDigest idempotency (#181)", () => {
  it("does not touch a stored week without force: no read of articles, no LLM call, no write", async () => {
    const f = makeRepo([article(1), article(2), article(3)], { content: "STORED" });
    const outcome = await run(f);
    expect(outcome).toEqual({ status: "skipped", week: WEEK, reason: "already-stored" });
    expect(f.loadArticles).not.toHaveBeenCalled();
    expect(llm).not.toHaveBeenCalled();
    expect(f.repo.save).not.toHaveBeenCalled();
    expect(f.repo.rows.get(WEEK)?.content).toBe("STORED");
  });

  it("replaces a stored week with force", async () => {
    llm.mockResolvedValue(completion(VALID_FULL));
    const f = makeRepo([article(1), article(2), article(3)], { content: "STORED" });
    const outcome = await run(f, { force: true });
    expect(outcome).toMatchObject({ status: "generated" });
    expect(f.repo.save).toHaveBeenCalledWith(expect.objectContaining({ week: WEEK }), true);
    expect(f.repo.rows.get(WEEK)?.content).not.toBe("STORED");
  });

  it("keeps the stored row when a forced run fails", async () => {
    llm.mockResolvedValue(new Response("upstream down", { status: 502 }));
    const f = makeRepo([article(1), article(2), article(3)], { content: "STORED" });
    await expect(run(f, { force: true })).rejects.toThrow(/OpenRouter API error \(502\)/);
    expect(f.repo.rows.get(WEEK)?.content).toBe("STORED");
  });

  it("reports already-stored when a concurrent run wrote the week first", async () => {
    llm.mockResolvedValue(completion(VALID_FULL));
    const f = makeRepo([article(1), article(2), article(3)]);
    f.repo.save.mockResolvedValue(false);
    expect(await run(f)).toEqual({ status: "skipped", week: WEEK, reason: "already-stored" });
  });
});

describe("generateWeeklyDigest validation and failure (#181)", () => {
  it("retries once with the failed checks named, then stores the second draft", async () => {
    llm.mockResolvedValueOnce(completion(words(40))).mockResolvedValueOnce(completion(VALID_FULL));
    const f = makeRepo([article(1), article(2), article(3)]);
    const outcome = await run(f);
    expect(outcome).toMatchObject({ status: "generated", attempts: 2 });
    expect(llm).toHaveBeenCalledTimes(2);
    expect(promptOf(1)).toContain("failed these checks");
    expect(promptOf(1)).toContain("word_count_below_min");
    expect(f.repo.rows.get(WEEK)?.metadata).toMatchObject({ attempts: 2, prompt_tokens: 2400 });
  });

  it("fails after exactly one retry, naming the checks, and stores nothing", async () => {
    // One check fails both times: a rank number in the text.
    const ranked = VALID_FULL.replace("## What mattered", "It is ranked #2 overall.\n\n## What mattered");
    llm.mockImplementation(async () => completion(ranked)); // a fresh Response per call
    const f = makeRepo([article(1), article(2), article(3)]);
    const error = await run(f).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(WeeklyDigestError);
    expect((error as WeeklyDigestError).failures).toEqual([expect.stringContaining("score_or_rank_number")]);
    expect(llm).toHaveBeenCalledTimes(2);
    expect(f.repo.save).not.toHaveBeenCalled();
  });

  it("does not retry a transport error and stores nothing", async () => {
    llm.mockResolvedValue(new Response("rate limited", { status: 429 }));
    const f = makeRepo([article(1), article(2), article(3)]);
    await expect(run(f)).rejects.toThrow(/OpenRouter API error \(429\)/);
    expect(llm).toHaveBeenCalledTimes(1);
    expect(f.repo.save).not.toHaveBeenCalled();
  });

  it("does not store a reply cut off at the token limit", async () => {
    llm.mockResolvedValue(completion(VALID_FULL, "length"));
    const f = makeRepo([article(1), article(2), article(3)]);
    await expect(run(f)).rejects.toThrow(/truncated/);
    expect(f.repo.save).not.toHaveBeenCalled();
  });
});

describe("generateWeeklyDigest dry run (#181)", () => {
  it("reports counts and writes nothing without an LLM call", async () => {
    const f = makeRepo([article(1), article(2), article(3)]);
    const outcome = await run(f, { dryRun: true });
    expect(outcome).toMatchObject({
      status: "dry-run",
      week: WEEK,
      tier: "full",
      articleCount: 3,
      newToolCount: 1,
    });
    expect(llm).not.toHaveBeenCalled();
    expect(f.repo.save).not.toHaveBeenCalled();
  });
});
