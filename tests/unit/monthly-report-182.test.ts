/**
 * #182: one monthly generator, read-only predecessor tables, word bounds.
 *
 * Why: two generators wrote two monthly reports into two tables. #182 keeps
 *   one generator (`WhatsNewSummaryService`, 300-450 words, append-only
 *   versions) and leaves `monthly_summaries` and `state_of_ai_summaries`
 *   readable but never written.
 * What: checks the word counter and its bounds; scans `app/`, `lib/` and
 *   `scripts/` for any write to a predecessor table and for any remaining
 *   call of the removed generator; drives the monthly cron, the admin
 *   "State of AI" route, `/api/state-of-ai/current` and the summary GET with
 *   the generator and the readers replaced, and checks each reaches the merged
 *   generator or reader with the right arguments.
 * Test: `npx vitest run tests/unit/monthly-report-182.test.ts`. No database,
 *   no network.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generateMonthlySummary: vi.fn(),
  getStoredSummaryVersion: vi.fn(),
  getLatestStoredSummary: vi.fn(),
  getCurrentSummary: vi.fn(),
  requireAdmin: vi.fn(),
}));

vi.mock("../../lib/services/whats-new-summary.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/services/whats-new-summary.service")>()),
  WhatsNewSummaryService: class {
    generateMonthlySummary = mocks.generateMonthlySummary;
    getCachedSummary = vi.fn(async () => null);
    getLatestSummary = vi.fn(async () => null);
  },
  getStoredSummaryVersion: mocks.getStoredSummaryVersion,
}));

vi.mock("../../lib/services/monthly-report.repository", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/services/monthly-report.repository")>()),
  getLatestStoredSummary: mocks.getLatestStoredSummary,
}));

vi.mock("../../lib/services/state-of-ai-summary.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/services/state-of-ai-summary.service")>();
  class ReadOnlyStateOfAi extends actual.StateOfAiSummaryService {
    override getCurrentSummary = mocks.getCurrentSummary;
  }
  return { StateOfAiSummaryService: ReadOnlyStateOfAi, ActualStateOfAi: actual.StateOfAiSummaryService };
});

vi.mock("../../lib/api-auth", () => ({ requireAdmin: mocks.requireAdmin }));

import {
  MONTHLY_REPORT_MAX_WORDS,
  MONTHLY_REPORT_MIN_WORDS,
  MonthlyReportLengthError,
  assertReportWordCount,
  countReportWords,
} from "../../lib/services/monthly-report-words";
import * as stateOfAiModule from "../../lib/services/state-of-ai-summary.service";
import { GET as monthlyCron } from "../../app/api/cron/monthly-summary/route";
import { POST as adminGenerate } from "../../app/api/admin/state-of-ai/generate/route";
import { GET as stateOfAiCurrent } from "../../app/api/state-of-ai/current/route";
import { GET as summaryGet } from "../../app/api/whats-new/summary/route";

const ROOT = path.resolve(__dirname, "../..");
const SECRET = "cron-secret-fixture-182";

function words(n: number): string {
  return Array.from({ length: n }, (_, i) => `word${i}`).join(" ");
}

function report(period: string, version: number) {
  return {
    id: `id-${period}-${version}`,
    period,
    version,
    content: `# ${period}\n\n${words(320)}`,
    dataHash: "hash",
    metadata: { word_count: 321 },
    generatedBy: "user_admin_1",
    generatedAt: new Date("2026-10-01T08:00:00Z"),
    createdAt: new Date("2026-10-01T08:00:00Z"),
    updatedAt: new Date("2026-10-01T08:00:00Z"),
  };
}

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  vi.stubEnv("CRON_SECRET", SECRET);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("#182 word bounds", () => {
  it("counts the words a reader sees: link text yes, URLs and markers no, hyphenated once", () => {
    const markdown = [
      "# July 2026",
      "",
      "- **Cursor** shipped an AI-powered [agent mode](https://example.test/a).",
      "See https://example.test/b ---",
    ].join("\n");
    // July 2026 Cursor shipped an AI-powered agent mode. See
    expect(countReportWords(markdown)).toBe(9);
  });

  it.each([
    { n: MONTHLY_REPORT_MIN_WORDS - 1, ok: false },
    { n: MONTHLY_REPORT_MIN_WORDS, ok: true },
    { n: MONTHLY_REPORT_MAX_WORDS, ok: true },
    { n: MONTHLY_REPORT_MAX_WORDS + 1, ok: false },
  ])("a $n-word report is accepted: $ok", ({ n, ok }) => {
    const check = () => assertReportWordCount(words(n));
    if (ok) expect(check()).toBe(n);
    else expect(check).toThrow(MonthlyReportLengthError);
  });

  it("names the bounds 300-450", () => {
    expect([MONTHLY_REPORT_MIN_WORDS, MONTHLY_REPORT_MAX_WORDS]).toEqual([300, 450]);
  });
});

describe("#182 one generator; predecessor tables read-only", () => {
  function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) return name === "migrations" ? [] : sourceFiles(full);
      return /\.(ts|tsx|js|mjs)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
    });
  }
  const files = ["app", "lib", "scripts"].flatMap((dir) => sourceFiles(path.join(ROOT, dir)));

  it("no source file inserts, updates or deletes a predecessor table", () => {
    const write =
      /\.(insert|update|delete)\(\s*(monthlySummaries|stateOfAiSummaries)\b|\b(INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+"?(monthly_summaries|state_of_ai_summaries)\b/i;
    const writers = files.filter((file) => write.test(readFileSync(file, "utf8")));
    expect(writers.map((file) => path.relative(ROOT, file))).toEqual([]);
  });

  it("the State of AI generator is gone and nothing calls it", () => {
    const actual = (stateOfAiModule as unknown as { ActualStateOfAi: { prototype: object } }).ActualStateOfAi;
    expect("generateStateOfAi" in actual.prototype).toBe(false);
    const callers = files.filter((file) => readFileSync(file, "utf8").includes("generateStateOfAi"));
    expect(callers.map((file) => path.relative(ROOT, file))).toEqual([]);
  });
});

describe("#182 callers reach the merged generator", () => {
  it("the monthly cron generates the closed month, unforced, as the monthly cron", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-01T08:00:00Z"));
    mocks.generateMonthlySummary.mockResolvedValue({ summary: report("2026-09", 3), isNew: true, generationTimeMs: 5 });

    const res = await monthlyCron(
      new Request("https://aipowerranking.com/api/cron/monthly-summary", {
        headers: { authorization: `Bearer ${SECRET}` },
      })
    );

    expect(res.status).toBe(200);
    expect(mocks.generateMonthlySummary).toHaveBeenCalledWith("2026-09", false, "cron-monthly-summary");
    const body = await res.json();
    expect(body.summary).toMatchObject({ period: "2026-09", version: 3, month: 9, year: 2026 });
  });

  it("the monthly cron rolls January back to December of the previous year", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2027-01-01T08:00:00Z"));
    mocks.generateMonthlySummary.mockResolvedValue({ summary: report("2026-12", 1), isNew: false, generationTimeMs: 1 });

    await monthlyCron(
      new Request("https://aipowerranking.com/api/cron/monthly-summary", {
        headers: { authorization: `Bearer ${SECRET}` },
      })
    );

    expect(mocks.generateMonthlySummary).toHaveBeenCalledWith("2026-12", false, "cron-monthly-summary");
  });

  it("the admin State of AI route delegates with the admin as generator and keeps month/year", async () => {
    mocks.requireAdmin.mockResolvedValue({ userId: "user_admin_1" });
    mocks.generateMonthlySummary.mockResolvedValue({ summary: report("2026-09", 2), isNew: true, generationTimeMs: 5 });

    const res = await adminGenerate(
      new NextRequest("http://localhost/api/admin/state-of-ai/generate", {
        method: "POST",
        body: JSON.stringify({ month: 9, year: 2026, forceRegenerate: true }),
      })
    );

    expect(res.status).toBe(201);
    expect(mocks.generateMonthlySummary).toHaveBeenCalledWith("2026-09", true, "user_admin_1");
    const body = await res.json();
    expect(body.summary).toMatchObject({ month: 9, year: 2026, version: 2, generatedBy: "user_admin_1" });
  });
});

describe("#182 reads", () => {
  it("/api/state-of-ai/current serves the merged report once it has a version", async () => {
    mocks.getLatestStoredSummary.mockResolvedValue(report("2026-10", 1));

    const body = await (await stateOfAiCurrent()).json();

    expect(body.summary).toMatchObject({ month: 10, year: 2026, content: report("2026-10", 1).content });
    expect(mocks.getCurrentSummary).not.toHaveBeenCalled();
  });

  it.each([
    { label: "no stored report", latest: null },
    { label: "only a pre-merge monthly_summaries row", latest: { ...report("2026-10", 0), content: "legacy" } },
  ])("/api/state-of-ai/current reads the legacy editorial when there is $label", async ({ latest }) => {
    mocks.getLatestStoredSummary.mockResolvedValue(latest);
    mocks.getCurrentSummary.mockResolvedValue({
      id: "soa-1",
      month: 8,
      year: 2026,
      content: "August editorial",
      generatedAt: new Date("2026-08-01T08:00:00Z"),
      metadata: {},
    });

    const body = await (await stateOfAiCurrent()).json();

    expect(body.summary).toMatchObject({ month: 8, year: 2026, content: "August editorial" });
  });

  it("the summary GET returns an exact stored version", async () => {
    mocks.getStoredSummaryVersion.mockResolvedValue(report("2026-09", 1));

    const res = await summaryGet(new NextRequest("http://localhost/api/whats-new/summary?period=2026-09&version=1"));

    expect(res.status).toBe(200);
    expect(mocks.getStoredSummaryVersion).toHaveBeenCalledWith("2026-09", 1);
    expect((await res.json()).summary).toMatchObject({ period: "2026-09", version: 1 });
  });

  it.each(["?version=1", "?period=2026-09&version=latest", "?period=2026-09&version=-1"])(
    "the summary GET rejects %s with 400",
    async (query) => {
      const res = await summaryGet(new NextRequest(`http://localhost/api/whats-new/summary${query}`));
      expect(res.status).toBe(400);
      expect(mocks.getStoredSummaryVersion).not.toHaveBeenCalled();
    }
  );
});
