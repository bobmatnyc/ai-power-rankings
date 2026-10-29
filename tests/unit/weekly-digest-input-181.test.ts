import { describe, expect, it } from "vitest";
import { META_DESCRIPTION_MAX_CHARS, countWords } from "../../lib/article-summary";
import type { ChangelogEntry } from "../../lib/data/changelog-generator";
import {
  articleSummaryForPrompt,
  assembleDigest,
  buildDigestPrompt,
  calculateDigestHash,
  digestTier,
  siteChangesForWindow,
} from "../../lib/services/weekly-digest-input";
import { validateDigest } from "../../lib/weekly-digest-validate";
import { windowForWeek } from "../../lib/weekly-digest-window";

/**
 * Pure input handling for the weekly digest (#181).
 *
 * Why: the digest has three branches by article count, summaries that are
 * validated or truncated, a window of site changes, and a hash that is the
 * same for the same inputs.
 * What: calls the pure helpers directly; no database, no network.
 * Test: `npx vitest run tests/unit/weekly-digest-input-181.test.ts`.
 */

const WINDOW = windowForWeek("2026-W43")!;

/** An 80-120 word single-paragraph summary (a post-#179 summary). */
const GOOD = `${Array.from({ length: 99 }, () => "plain").join(" ")} end.`;

describe("digestTier (#181)", () => {
  it.each([
    [0, null],
    [1, "short"],
    [2, "short"],
    [3, "full"],
    [20, "full"],
  ])("%i articles gives %s", (count, tier) => {
    expect(digestTier(count)).toBe(tier);
  });
});

describe("articleSummaryForPrompt (#181)", () => {
  it("passes a validated summary through unchanged", () => {
    expect(articleSummaryForPrompt({ title: "T", summary: GOOD })).toBe(GOOD);
  });

  it("truncates a longer pre-#179 summary with toMetaDescription", () => {
    const long = Array.from({ length: 450 }, (_, i) => `word${i}`).join(" ");
    const out = articleSummaryForPrompt({ title: "T", summary: long });
    expect(Array.from(out).length).toBeLessThanOrEqual(META_DESCRIPTION_MAX_CHARS);
    expect(out.endsWith("…")).toBe(true);
    expect(countWords(out)).toBeLessThan(40);
  });

  it("uses a multi-paragraph summary only in truncated form", () => {
    const out = articleSummaryForPrompt({ title: "T", summary: `${GOOD}\n\nSecond paragraph.` });
    expect(out).not.toContain("\n");
    expect(Array.from(out).length).toBeLessThanOrEqual(META_DESCRIPTION_MAX_CHARS);
  });

  it("falls back to the title when there is no summary", () => {
    expect(articleSummaryForPrompt({ title: "Only a title", summary: null })).toBe("Only a title");
    expect(articleSummaryForPrompt({ title: "Only a title", summary: "  " })).toBe("Only a title");
  });
});

function entry(partial: Partial<ChangelogEntry>): ChangelogEntry {
  return {
    id: "id",
    version: "Unreleased",
    date: "2026-10-21T10:00:00.000Z",
    dateSource: "commit",
    section: "Added",
    scope: "tools",
    title: "tool pages list linked models",
    description: "long description",
    changeType: "feature",
    ...partial,
  };
}

describe("siteChangesForWindow (#181)", () => {
  it("keeps entries dated inside the window, edges included, and drops the rest", () => {
    const entries = [
      entry({ id: "a", date: "2026-10-19T00:00:00.000Z", title: "first edge" }),
      entry({ id: "b", date: "2026-10-25T23:59:59.999Z", title: "last edge" }),
      entry({ id: "c", date: "2026-10-18T23:59:59.999Z", title: "before" }),
      entry({ id: "d", date: "2026-10-26T00:00:00.000Z", title: "after" }),
    ];
    expect(siteChangesForWindow(WINDOW, entries).map((c) => c.title)).toEqual(["first edge", "last edge"]);
  });

  it("drops an issue reference from the title", () => {
    const [change] = siteChangesForWindow(WINDOW, [entry({ title: "summaries are validated (#180)" })]);
    expect(change?.title).toBe("summaries are validated");
  });
});

describe("calculateDigestHash (#181)", () => {
  const base = { week: "2026-W43", articleIds: ["b", "a"], toolIds: ["t1"], changeIds: ["c1"] };

  it("is the same for the same ids in any order", () => {
    expect(calculateDigestHash(base)).toBe(calculateDigestHash({ ...base, articleIds: ["a", "b"] }));
    expect(calculateDigestHash(base)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes when an input id or the week changes", () => {
    expect(calculateDigestHash(base)).not.toBe(calculateDigestHash({ ...base, articleIds: ["a", "b", "c"] }));
    expect(calculateDigestHash(base)).not.toBe(calculateDigestHash({ ...base, week: "2026-W44" }));
  });
});

describe("short-tier prompt and word floor (#181)", () => {
  /** A plain sentence of `n` words. */
  const sentence = (n: number) => `${Array.from({ length: n - 1 }, () => "word").join(" ")} done.`;
  const articlesOf = (count: number) =>
    Array.from({ length: count }, (_, i) => ({
      id: `a${i}`,
      slug: `story-${i}`,
      // #339: a real article title used as link text runs to about six words.
      title: `Story ${i} ships a new agent`,
      summary: GOOD,
      publishedAt: null,
      toolMentions: [],
    }));

  // #339: a draft that follows the prompt's sentence counts at realistic sentence
  // lengths (16 and 20 words) must land inside 80-120 for one and for two articles.
  it.each([
    [1, 16],
    [1, 20],
    [2, 16],
    [2, 20],
  ])("a compliant %i-article digest at %i words per sentence passes validation", (count, perSentence) => {
    const articles = articlesOf(count);
    const { system } = buildDigestPrompt({ window: WINDOW, tier: "short", articles, newTools: [], siteChanges: [] });
    const opening = Number(/opening paragraph of (\d+) sentences?/.exec(system)?.[1]);
    const perBullet = Number(/One bullet per article, each (\d+) sentences?/.exec(system)?.[1]);
    expect(opening).toBeGreaterThan(0);
    expect(perBullet).toBeGreaterThan(0);
    // The prompt names a word target inside the validator's range.
    const target = Number(/aim for about (\d+) words/.exec(system)?.[1]);
    expect(target).toBeGreaterThanOrEqual(80);
    expect(target).toBeLessThanOrEqual(120);

    const body = [
      Array.from({ length: opening }, () => sentence(perSentence)).join(" "),
      "",
      ...articles.map(
        (a) =>
          `- ${Array.from({ length: perBullet }, () => sentence(perSentence)).join(" ")} [${a.title}](/en/news/${a.slug})`
      ),
    ].join("\n");
    const context = { tier: "short" as const, allowedSlugs: new Set(articles.map((a) => a.slug)), hasNewAndChanged: false };
    expect(validateDigest(body, context)).toEqual([]);
  });
});

describe("prompt names the banned rank forms (#339)", () => {
  // #339: the first draft avoids a rank form only when the prompt names it.
  const BANNED = ['"#1"', '"No. 1"', '"number one"', '"top 5"', '"ranked third"', '"first place"'];

  it.each(["short", "full"] as const)("the %s-tier system prompt names each banned form, and the validator rejects each", (tier) => {
    const articles = Array.from({ length: tier === "short" ? 1 : 3 }, (_, i) => ({
      id: `a${i}`,
      slug: `s-${i}`,
      title: `T ${i}`,
      summary: GOOD,
      publishedAt: null,
      toolMentions: [],
    }));
    const { system } = buildDigestPrompt({ window: WINDOW, tier, articles, newTools: [], siteChanges: [] });
    for (const form of BANNED) {
      expect(system).toContain(form);
      const body = `${GOOD} It is ${form.slice(1, -1)} now.`;
      const failures = validateDigest(body, { tier: "short", allowedSlugs: new Set(), hasNewAndChanged: false });
      expect(failures.some((f) => f.startsWith("score_or_rank_number"))).toBe(true);
    }
  });
});

describe("assembleDigest (#181)", () => {
  it("builds the title and the source list in code around the model body", () => {
    const text = assembleDigest(
      WINDOW,
      "Body paragraph.",
      [
        { slug: "alpha-launch", title: "Alpha [beta] launch" },
        { slug: "gamma", title: "Gamma" },
      ]
    );
    expect(text.startsWith("# AI coding tools: week of Oct 19 to Oct 25, 2026\n\nBody paragraph.")).toBe(true);
    expect(text).toContain("## Sources");
    expect(text).toContain("- [Alpha \\[beta\\] launch](/en/news/alpha-launch)");
    expect(text).toContain("- [Gamma](/en/news/gamma)");
  });

  it("names both years when the week spans 1 January", () => {
    const w = windowForWeek("2026-W01")!;
    expect(assembleDigest(w, "b", [])).toContain("week of Dec 29, 2025 to Jan 4, 2026");
  });
});
