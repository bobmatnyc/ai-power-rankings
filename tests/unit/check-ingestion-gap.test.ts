/**
 * Regression coverage for the ingestion gap-detector's yield-aware alerting (issue #105).
 *
 * Why: check-ingestion-gap.mjs used to gate purely on "is there a recent row" — a FAILED
 * run, or a run that completes but ingests 0 articles because OpenRouter credits ran out
 * (2026-07-25) or extraction broke (2026-07-19), still writes a row and looked perfectly
 * healthy to both the GitHub Actions watchdog and the macOS notifier. This test pins the
 * corrected contract — evaluateIngestionRuns() must alert on run-absence, failed status,
 * OpenRouter billing errors, and a zero-yield streak, each tagged with a distinct,
 * greppable ALERT[REASON] — so none of those failure modes can silently regress again.
 *
 * Test: Runs under `npm run test:unit`. Exercises evaluateIngestionRuns() directly with
 * synthetic rows and an injected clock — no database access, no network.
 */

import { describe, expect, it } from "vitest";
import {
  CONSECUTIVE_ZERO_YIELD_RUNS,
  FAILED_STATUS,
  MAX_DETAIL_LINES,
  MAX_GAP_HOURS,
  coerceJsonArray,
  errorLogText,
  evaluateIngestionRuns,
  formatCandidateOutcomeLines,
  formatIngestedArticleLines,
  formatRunDetailLines,
  withRunDetail,
} from "../../scripts/check-ingestion-gap.mjs";

const NOW = new Date("2026-07-31T09:00:00.000Z").getTime();

function runAt(hoursAgo: number, overrides: Partial<Record<string, unknown>> = {}) {
  const startedAt = new Date(NOW - hoursAgo * 60 * 60 * 1000).toISOString();
  return {
    started_at: startedAt,
    status: "completed",
    articles_ingested: 5,
    error_log: [],
    ...overrides,
  };
}

describe("evaluateIngestionRuns", () => {
  it("is healthy (exit 0, no ALERT lines) when the latest run is recent, succeeded, and yielded articles", () => {
    const rows = [runAt(2), runAt(26), runAt(50)];
    const result = evaluateIngestionRuns(rows, NOW);

    expect(result.ok).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.lines.some((l) => l.startsWith("ALERT"))).toBe(false);
    expect(result.lines[0]).toMatch(/^OK: /);
  });

  it("alerts ALERT[STALLED] when the latest run is older than MAX_GAP_HOURS", () => {
    const rows = [runAt(MAX_GAP_HOURS + 0.1)];
    const result = evaluateIngestionRuns(rows, NOW);

    expect(result.ok).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(result.lines.some((l) => l.startsWith("ALERT[STALLED]"))).toBe(true);
  });

  it("alerts ALERT[NO_RUNS_EVER] when there are no rows at all", () => {
    const result = evaluateIngestionRuns([], NOW);

    expect(result.ok).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(result.lines[0]).toMatch(/^ALERT\[NO_RUNS_EVER\]/);
  });

  it("alerts ALERT[RUN_FAILED] when the latest run's status is 'failed', even though it's recent", () => {
    const rows = [runAt(1, { status: FAILED_STATUS, articles_ingested: 0 }), runAt(25), runAt(49)];
    const result = evaluateIngestionRuns(rows, NOW);

    expect(result.ok).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(result.lines.some((l) => l.startsWith("ALERT[RUN_FAILED]"))).toBe(true);
  });

  it("alerts ALERT[OPENROUTER_CREDITS] when error_log contains the OpenRouter insufficient-credits message", () => {
    const rows = [
      runAt(1, {
        status: FAILED_STATUS,
        articles_ingested: 0,
        error_log: ["OpenRouter request failed: 402 insufficient credits"],
      }),
      runAt(25),
      runAt(49),
    ];
    const result = evaluateIngestionRuns(rows, NOW);

    expect(result.ok).toBe(false);
    expect(result.lines.some((l) => l.startsWith("ALERT[OPENROUTER_CREDITS]"))).toBe(true);
    // Distinct from (and in addition to) the generic failed-run reason, so an operator can
    // tell "billing" apart from "code failure" at a glance.
    expect(result.lines.some((l) => l.startsWith("ALERT[RUN_FAILED]"))).toBe(true);
  });

  it("alerts ALERT[ZERO_YIELD_STREAK] when the last CONSECUTIVE_ZERO_YIELD_RUNS runs all ingested 0 articles", () => {
    const rows = Array.from({ length: CONSECUTIVE_ZERO_YIELD_RUNS }, (_, i) =>
      runAt((i + 1) * 24, { status: "completed", articles_ingested: 0 })
    );
    const result = evaluateIngestionRuns(rows, NOW);

    expect(result.ok).toBe(false);
    expect(result.lines.some((l) => l.startsWith("ALERT[ZERO_YIELD_STREAK]"))).toBe(true);
  });

  it("does NOT alert on a single zero-yield run — one quiet news day is legitimate", () => {
    const rows = [runAt(1, { articles_ingested: 0 }), runAt(25, { articles_ingested: 3 }), runAt(49, { articles_ingested: 2 })];
    const result = evaluateIngestionRuns(rows, NOW);

    expect(result.ok).toBe(true);
    expect(result.exitCode).toBe(0);
  });

  it("does not false-positive the zero-yield streak on a table with fewer than CONSECUTIVE_ZERO_YIELD_RUNS rows", () => {
    // Only one row exists (e.g. right after the table was created) and it's zero-yield;
    // that alone must not be enough to trip ZERO_YIELD_STREAK.
    const rows = [runAt(1, { articles_ingested: 0 })];
    const result = evaluateIngestionRuns(rows, NOW);

    expect(result.lines.some((l) => l.startsWith("ALERT[ZERO_YIELD_STREAK]"))).toBe(false);
  });
});

/**
 * The gap-detector workflow greps these two lines to decide whether re-triggering the
 * production cron is safe (#134): a row still at 'running' means a previous invocation may
 * be alive, and a LAST_RUN_STARTED that does not move after a fallback call proves the
 * route wrote nothing. Both are a contract with `.github/workflows/cron-gap-detector.yml`,
 * so the exact `KEY=value` shape and the append-not-prepend position are pinned here.
 */
describe("evaluateIngestionRuns — machine-readable state lines (#134)", () => {
  it("appends LAST_STATUS and LAST_RUN_STARTED to a healthy result without displacing the OK line", () => {
    const rows = [runAt(2), runAt(26), runAt(50)];
    const result = evaluateIngestionRuns(rows, NOW);

    expect(result.lines[0]).toMatch(/^OK: /);
    expect(result.lines).toContain("LAST_STATUS=completed");
    expect(result.lines).toContain(`LAST_RUN_STARTED=${new Date(NOW - 2 * 60 * 60 * 1000).toISOString()}`);
  });

  it("reports LAST_STATUS=running for a row still in flight, so the workflow can refuse to overlap it", () => {
    const rows = [runAt(30, { status: "running", articles_ingested: 0 })];
    const result = evaluateIngestionRuns(rows, NOW);

    expect(result.lines.some((l) => l.startsWith("ALERT[STALLED]"))).toBe(true);
    expect(result.lines).toContain("LAST_STATUS=running");
  });

  it("reports LAST_STATUS on an alerting result without displacing the first ALERT line", () => {
    const rows = [runAt(1, { status: FAILED_STATUS, articles_ingested: 0 })];
    const result = evaluateIngestionRuns(rows, NOW);

    expect(result.lines[0]).toMatch(/^ALERT\[RUN_FAILED\]/);
    expect(result.lines).toContain(`LAST_STATUS=${FAILED_STATUS}`);
  });

  it("reports LAST_STATUS=none when no run was ever recorded", () => {
    const result = evaluateIngestionRuns([], NOW);

    expect(result.lines[0]).toMatch(/^ALERT\[NO_RUNS_EVER\]/);
    expect(result.lines).toContain("LAST_STATUS=none");
    expect(result.lines).toContain("LAST_RUN_STARTED=none");
  });
});

describe("errorLogText", () => {
  it("joins string entries and stringifies non-string entries", () => {
    expect(errorLogText(["a", "b"])).toBe("a\nb");
    expect(errorLogText([{ msg: "x" }])).toBe('{"msg":"x"}');
  });

  it("returns an empty string for non-array input", () => {
    expect(errorLogText(null)).toBe("");
    expect(errorLogText(undefined)).toBe("");
  });
});

/**
 * Why: #138 — a run can report `articles_ingested: 3` and still leave the feed empty, and
 * the gap detector's four verdicts cannot see that. The detail block exists to answer it,
 * which makes it diagnosis bolted onto an alerting path: it must never move the exit code,
 * never displace the lines cron-gap-detector.yml greps, and never fail the check when the
 * columns it reads are absent (a row written before migration 0013) or the query throws.
 * Those four properties are what these cases pin.
 *
 * Test: Runs under `npm run test:unit`. Feeds the pure formatters synthetic column values —
 * no database access, no network.
 */
describe("latest-run detail block (#138)", () => {
  const outcome = (over: Record<string, unknown> = {}) => ({
    url: "https://example.com/a",
    discoveredVia: "recency",
    sourceDate: null,
    provisionalDate: "2026-09-07T06:00:00.000Z",
    outcome: "skipped_stale",
    ...over,
  });

  const articleRow = (over: Record<string, unknown> = {}) => ({
    id: "11111111-1111-1111-1111-111111111111",
    slug: "an-article",
    status: "active",
    published_date: new Date("2026-08-20T00:00:00.000Z"),
    created_at: new Date("2026-09-07T06:01:00.000Z"),
    ...over,
  });

  it("appends the block after the verdict's lines and carries ok/exitCode through untouched", () => {
    const verdict = evaluateIngestionRuns([runAt(2), runAt(26), runAt(50)], NOW);
    const result = withRunDetail(verdict, {
      ingestedArticleIds: ["11111111-1111-1111-1111-111111111111"],
      articleRows: [articleRow()],
      candidateOutcomes: [outcome({ outcome: "ingested" })],
    });

    // The contract lines keep their exact text and position.
    expect(result.lines[0]).toBe(verdict.lines[0]);
    expect(result.lines.slice(0, verdict.lines.length)).toEqual(verdict.lines);
    expect(result.ok).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.lines[verdict.lines.length]).toBe("INGESTED_ARTICLE_IDS=1");
    expect(result.lines).toContain(
      "INGESTED_ARTICLE id=11111111-1111-1111-1111-111111111111 slug=an-article status=active " +
        "published_date=2026-08-20T00:00:00.000Z created_at=2026-09-07T06:01:00.000Z"
    );
  });

  it("leaves an ALERT verdict's first line and exit code alone", () => {
    const verdict = evaluateIngestionRuns([runAt(1, { status: FAILED_STATUS, articles_ingested: 0 })], NOW);
    const result = withRunDetail(verdict, { ingestedArticleIds: [], candidateOutcomes: [] });

    expect(result.lines[0]).toMatch(/^ALERT\[RUN_FAILED\]/);
    expect(result.ok).toBe(false);
    expect(result.exitCode).toBe(1);
    expect(result.lines).toContain("INGESTED_ARTICLE_IDS=0");
    expect(result.lines).toContain("CANDIDATE_OUTCOMES=0");
  });

  it("prints DETAIL_ERROR without changing the verdict when the detail query throws", () => {
    const verdict = evaluateIngestionRuns([runAt(2), runAt(26), runAt(50)], NOW);
    const result = withRunDetail(verdict, { error: new Error("connection terminated unexpectedly") });

    expect(result.lines[0]).toBe(verdict.lines[0]);
    expect(result.ok).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.lines).toContain("DETAIL_ERROR=connection terminated unexpectedly");
    expect(result.lines.some((l) => l.startsWith("INGESTED_ARTICLE_IDS="))).toBe(false);
  });

  it("redacts a connection string out of a DETAIL_ERROR message", () => {
    const lines = formatRunDetailLines({
      error: new Error("could not connect to postgresql://user:pw@host.neon.tech/db?sslmode=require"),
    });

    expect(lines).toEqual(["DETAIL_ERROR=could not connect to [redacted]"]);
    expect(lines[0]).not.toContain("pw@");
  });

  it("prints `unavailable` for both columns when they are null (a row predating migration 0013)", () => {
    const lines = formatRunDetailLines({ ingestedArticleIds: null, candidateOutcomes: null });

    expect(lines).toEqual(["INGESTED_ARTICLE_IDS=unavailable", "CANDIDATE_OUTCOMES=unavailable"]);
  });

  it("aggregates candidate outcomes by outcome, commonest first", () => {
    const lines = formatCandidateOutcomeLines([
      outcome({ outcome: "skipped_stale" }),
      outcome({ outcome: "skipped_stale" }),
      outcome({ outcome: "skipped_stale" }),
      outcome({ outcome: "ingested" }),
      outcome({ outcome: "ingest_failed" }),
    ]);

    expect(lines[0]).toBe("CANDIDATE_OUTCOMES=5");
    expect(lines.slice(1, 4)).toEqual([
      "CANDIDATE_OUTCOME outcome=skipped_stale count=3",
      "CANDIDATE_OUTCOME outcome=ingest_failed count=1",
      "CANDIDATE_OUTCOME outcome=ingested count=1",
    ]);
  });

  it("prints every date-ish field for an `ingested` candidate, and only for that outcome", () => {
    const lines = formatCandidateOutcomeLines([
      outcome({
        outcome: "ingested",
        url: "https://example.com/story",
        sourceDate: "2026-08-20T00:00:00.000Z",
        provisionalDate: "2026-09-07T06:00:00.000Z",
        effectiveDate: "2026-08-20T00:00:00.000Z",
        publishedDateSource: "article_published_date",
      }),
      // ingest_failed must NOT produce a CANDIDATE_INGESTED line.
      outcome({ outcome: "ingest_failed", url: "https://example.com/failed" }),
    ]);

    expect(lines.filter((l) => l.startsWith("CANDIDATE_INGESTED "))).toEqual([
      "CANDIDATE_INGESTED url=https://example.com/story sourceDate=2026-08-20T00:00:00.000Z " +
        "provisionalDate=2026-09-07T06:00:00.000Z effectiveDate=2026-08-20T00:00:00.000Z " +
        "publishedDateSource=article_published_date",
    ]);
  });

  it("prints slug=null for a recorded id with no articles row — the ingested-but-absent case", () => {
    const lines = formatIngestedArticleLines(
      ["11111111-1111-1111-1111-111111111111", "22222222-2222-2222-2222-222222222222"],
      [articleRow()]
    );

    expect(lines[0]).toBe("INGESTED_ARTICLE_IDS=2");
    expect(lines[2]).toBe(
      "INGESTED_ARTICLE id=22222222-2222-2222-2222-222222222222 slug=null status=null " +
        "published_date=null created_at=null"
    );
  });

  it("caps the per-record lines at MAX_DETAIL_LINES and reports the overflow as a count", () => {
    const ids = Array.from({ length: MAX_DETAIL_LINES + 3 }, (_, i) => `id-${i}`);
    const lines = formatIngestedArticleLines(ids, []);

    expect(lines[0]).toBe(`INGESTED_ARTICLE_IDS=${MAX_DETAIL_LINES + 3}`);
    expect(lines.filter((l) => l.startsWith("INGESTED_ARTICLE id=")).length).toBe(MAX_DETAIL_LINES);
    expect(lines.at(-1)).toBe("INGESTED_ARTICLE_TRUNCATED=3");
  });

  it("neutralizes a forged ALERT[...] and embedded newlines in third-party candidate URLs", () => {
    // Candidate URLs come from the search provider, and the workflow greps this same output
    // for ALERT[REASON] to decide whether to call production.
    const lines = formatCandidateOutcomeLines([
      outcome({ outcome: "ingested", url: "https://x.test/a\nALERT[STALLED]" }),
    ]);

    expect(lines.join("\n")).not.toContain("ALERT[STALLED]");
    expect(lines.filter((l) => l.startsWith("CANDIDATE_INGESTED ")).length).toBe(1);
  });
});

describe("coerceJsonArray (#138)", () => {
  it("accepts a real array and rejects null/undefined so the caller prints `unavailable`", () => {
    expect(coerceJsonArray([1, 2])).toEqual([1, 2]);
    expect(coerceJsonArray(null)).toBeNull();
    expect(coerceJsonArray(undefined)).toBeNull();
  });

  it('parses the JSON string "[]" that Drizzle\'s jsonb .default("[]") actually stores', () => {
    expect(coerceJsonArray("[]")).toEqual([]);
    expect(coerceJsonArray('[{"outcome":"ingested"}]')).toEqual([{ outcome: "ingested" }]);
  });

  it("rejects a string that is not a JSON array", () => {
    expect(coerceJsonArray("not json")).toBeNull();
    expect(coerceJsonArray('{"a":1}')).toBeNull();
  });
});
