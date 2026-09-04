import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regression tests for #132 phase D — per-candidate outcomes on the run row.
 *
 * Why: the run row carried counts only, and `articlesSkippedStale` was not even
 * mapped in updateRun — it was computed every run and silently dropped. So "a
 * fresh candidate existed and failed to insert" and "no fresh candidate
 * existed" produced identical rows. The 2026-09-03 run passed 5 candidates
 * through quality and ingested 3; which two failed, and why, was unknowable.
 *
 * What: A fake `getDb()` simulates the automated_ingestion_runs table the same
 * way automated-ingestion.run-finalization.test.ts does, and additionally
 * records every `.set()` payload so a test can assert what the second write of
 * a two-attempt sequence actually carried. The error arms cover the two ways
 * the new fields must not be able to take a terminal write down with them: the
 * migration not being applied yet (Postgres 42703), and an outcome list that
 * cannot be serialized.
 *
 * Test: `npx vitest run lib/services/automated-ingestion.candidate-outcomes.test.ts`.
 */

const RUN_ID = "run-132-fixture";

// vi.mock() factories are hoisted above ordinary `const` declarations, so any
// mock state the factory closes over must be created via vi.hoisted() — see
// the same note in automated-ingestion.run-finalization.test.ts.
const { simulatedRow, updateBehavior, setPayloads, duplicateUrls, resetDbFixture } = vi.hoisted(
  () => {
    const row: Record<string, unknown> = {};
    const payloads: Record<string, unknown>[] = [];
    const dupes: string[] = [];
    const behavior: {
      failWith: (payload: Record<string, unknown>, callIndex: number) => unknown;
    } = { failWith: () => undefined };

    function reset(): void {
      for (const key of Object.keys(row)) delete row[key];
      Object.assign(row, {
        status: "running",
        completedAt: null,
        articlesDiscovered: 0,
        articlesPassedQuality: 0,
        articlesIngested: 0,
        articlesSkipped: 0,
        articlesSkippedSemantic: 0,
        articlesSkippedStale: 0,
        candidateOutcomes: [],
        rankingChanges: 0,
        estimatedCostUsd: "0",
      });
      payloads.length = 0;
      dupes.length = 0;
      behavior.failWith = () => undefined;
    }

    return {
      simulatedRow: row,
      updateBehavior: behavior,
      setPayloads: payloads,
      duplicateUrls: dupes,
      resetDbFixture: reset,
    };
  }
);

// Relative path — tsconfig excludes *.test.ts from `include`, so the "@/..."
// alias never resolves inside this file itself.
vi.mock("../db/connection", () => {
  let updateCallIndex = 0;

  return {
    getDb: () => ({
      insert: () => ({
        values: (data: Record<string, unknown>) => ({
          returning: async () => {
            Object.assign(simulatedRow, data);
            return [{ id: RUN_ID, ...data }];
          },
        }),
      }),
      update: () => ({
        set: (data: Record<string, unknown>) => ({
          where: () => ({
            returning: async () => {
              updateCallIndex += 1;
              setPayloads.push(data);
              const failure = updateBehavior.failWith(data, updateCallIndex);
              if (failure) throw failure;
              Object.assign(simulatedRow, data);
              return [{ id: RUN_ID, ...simulatedRow }];
            },
          }),
        }),
      }),
      // checkDuplicates: `await ...where(...)`
      // getRecentArticleTitles: `...where(...).orderBy(...)`
      // updateRun's existence check: `...where(...).limit(1)`
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: () => Promise.resolve([]),
            limit: () => Promise.resolve([{ status: simulatedRow.status }]),
            then: (resolve: (value: unknown[]) => void) =>
              resolve(duplicateUrls.map((url) => ({ sourceUrl: url }))),
          }),
        }),
      }),
    }),
  };
});

import {
  AutomatedIngestionService,
  CANDIDATE_OUTCOME_LIMIT,
  isUndefinedNewRunColumnError,
  serializeCandidateOutcomes,
  type CandidateOutcome,
} from "./automated-ingestion.service";
import type { TavilySearchService } from "./tavily-search.service";
import type { BraveSearchService } from "./brave-search.service";
import type { ArticleQualityService } from "./article-quality.service";
import type { ArticleIngestionService } from "./article-ingestion.service";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysAgo(days: number): string {
  return new Date(Date.now() - days * MS_PER_DAY).toISOString();
}

/** One discovery result with enough content to skip the extraction chain. */
function searchResult(
  title: string,
  url: string,
  publishedDate: string | null,
  discoveredVia: "recency" | "window"
) {
  return {
    title,
    url,
    description: "A discovery fixture.",
    source: "example.com",
    publishedDate,
    content:
      "A vendor announced something today. This fixture body exists only to " +
      "clear the 100-character sufficiency threshold so no extraction call is " +
      "attempted during the test run.",
    score: 0.9,
    discoveredVia,
  };
}

function injectServices(
  service: AutomatedIngestionService,
  results: ReturnType<typeof searchResult>[],
  ingestArticle: ReturnType<typeof vi.fn>
): void {
  const internal = service as unknown as {
    _tavilySearchService: Partial<TavilySearchService>;
    _braveSearchService: Partial<BraveSearchService>;
    _articleQualityService: Partial<ArticleQualityService>;
    _articleIngestionService: Partial<ArticleIngestionService>;
  };

  internal._tavilySearchService = {
    isConfigured: () => true,
    searchAINews: vi.fn().mockResolvedValue(results),
  } as unknown as Partial<TavilySearchService>;

  internal._braveSearchService = {
    isAvailable: () => false,
    searchAINews: vi.fn(),
  } as unknown as Partial<BraveSearchService>;

  internal._articleQualityService = {
    batchAssess: vi.fn().mockResolvedValue([]),
  } as unknown as Partial<ArticleQualityService>;

  internal._articleIngestionService = {
    ingestArticle,
  } as unknown as Partial<ArticleIngestionService>;
}

/** A Postgres undefined_column error, as node-postgres surfaces it. */
function undefinedColumnError(column: string): Error & { code: string } {
  const error = new Error(
    `column "${column}" of relation "automated_ingestion_runs" does not exist`
  ) as Error & { code: string };
  error.code = "42703";
  return error;
}

describe("serializeCandidateOutcomes (#132)", () => {
  it("caps the persisted list", () => {
    const outcomes: CandidateOutcome[] = Array.from({ length: 150 }, (_, i) => ({
      url: `https://example.com/${i}`,
      discoveredVia: "window" as const,
      sourceDate: null,
      provisionalDate: null,
      outcome: "skipped_stale" as const,
    }));

    expect(serializeCandidateOutcomes(outcomes)).toHaveLength(CANDIDATE_OUTCOME_LIMIT);
  });

  it("throws on a list the jsonb column could not hold", () => {
    const circular: Record<string, unknown> = { url: "https://example.com/a" };
    circular.self = circular;

    // Match on the circular-structure message specifically: a bare toThrow()
    // would also pass against a build where the function does not exist.
    expect(() => serializeCandidateOutcomes([circular as unknown as CandidateOutcome])).toThrow(
      /circular/i
    );
  });
});

describe("isUndefinedNewRunColumnError (#132)", () => {
  it("recognizes a 42703 naming candidate_outcomes", () => {
    expect(isUndefinedNewRunColumnError(undefinedColumnError("candidate_outcomes"))).toBe(true);
  });

  it("recognizes a 42703 naming articles_skipped_stale", () => {
    expect(isUndefinedNewRunColumnError(undefinedColumnError("articles_skipped_stale"))).toBe(true);
  });

  it("rejects a 42703 naming some other column", () => {
    expect(isUndefinedNewRunColumnError(undefinedColumnError("ranking_changes"))).toBe(false);
  });

  it("rejects a connection failure", () => {
    expect(isUndefinedNewRunColumnError(new Error("Connection terminated unexpectedly"))).toBe(
      false
    );
  });
});

describe("AutomatedIngestionService - candidate outcomes (#132)", () => {
  let service: AutomatedIngestionService;
  let ingestArticle: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    resetDbFixture();
    service = new AutomatedIngestionService();
    ingestArticle = vi.fn().mockResolvedValue({ id: "article-1", rankingChangesApplied: 0 });
  });

  /**
   * The core diagnostic gap. A run with one ingest, one stale skip and one URL
   * duplicate must read back as exactly that — pre-fix the row carried three
   * counters, no stale count at all, and no per-candidate detail.
   */
  it("persists the stale count and one outcome entry per candidate", async () => {
    duplicateUrls.push("https://example.com/already-have-it");
    injectServices(
      service,
      [
        searchResult(
          "Agentic coding assistant ships terminal mode",
          "https://example.com/fresh",
          daysAgo(21),
          "recency"
        ),
        searchResult(
          "Funding round closes for infrastructure vendor",
          "https://example.com/stale",
          daysAgo(60),
          "window"
        ),
        searchResult(
          "Editor plugin adds inline review widget",
          "https://example.com/already-have-it",
          daysAgo(2),
          "window"
        ),
      ],
      ingestArticle
    );

    const result = await service.runDailyDiscovery({ skipQualityCheck: true, maxArticles: 5 });

    expect(result.articlesIngested).toBe(1);
    expect(simulatedRow.articlesSkippedStale).toBe(1);

    const persisted = simulatedRow.candidateOutcomes as CandidateOutcome[];
    const byUrl = new Map(persisted.map((entry) => [entry.url, entry]));

    expect(byUrl.get("https://example.com/stale")?.outcome).toBe("skipped_stale");
    expect(byUrl.get("https://example.com/already-have-it")?.outcome).toBe("skipped_duplicate");
    expect(byUrl.get("https://example.com/fresh")?.outcome).toBe("ingested");
    expect(byUrl.get("https://example.com/fresh")?.discoveredVia).toBe("recency");
  });

  it("records an ingest failure as its own outcome", async () => {
    ingestArticle.mockRejectedValue(new Error("insert exploded"));
    injectServices(
      service,
      [
        searchResult(
          "Agentic coding assistant ships terminal mode",
          "https://example.com/fresh",
          daysAgo(1),
          "window"
        ),
      ],
      ingestArticle
    );

    await service.runDailyDiscovery({ skipQualityCheck: true, maxArticles: 5 });

    const persisted = simulatedRow.candidateOutcomes as CandidateOutcome[];
    expect(persisted).toHaveLength(1);
    expect(persisted[0].outcome).toBe("ingest_failed");
    expect(persisted[0].reason).toContain("insert exploded");
  });
});

describe("AutomatedIngestionService.updateRun - #132 error arms", () => {
  let service: AutomatedIngestionService;

  beforeEach(() => {
    resetDbFixture();
    service = new AutomatedIngestionService();
  });

  const terminalWrite = {
    status: "completed" as const,
    articlesDiscovered: 7,
    articlesIngested: 2,
    articlesSkippedStale: 3,
    candidateOutcomes: [
      {
        url: "https://example.com/a",
        discoveredVia: "recency" as const,
        sourceDate: null,
        provisionalDate: null,
        outcome: "ingested" as const,
      },
    ],
  };

  /**
   * Deploy-before-migration. Without the retry arm the first 42703 takes the
   * terminal status and every existing counter down with it, recreating the
   * stuck-'running' rows #124 fixed.
   */
  it("retries without the new columns when the migration has not been applied", async () => {
    // The fixture's own call index spans the whole file, so count attempts
    // locally: only this test's FIRST write must fail.
    let attempts = 0;
    updateBehavior.failWith = () => {
      attempts += 1;
      return attempts === 1 ? undefinedColumnError("candidate_outcomes") : undefined;
    };

    await service.updateRun(RUN_ID, terminalWrite);

    expect(setPayloads).toHaveLength(2);
    const second = setPayloads[1];
    expect(second.status).toBe("completed");
    expect(second.articlesDiscovered).toBe(7);
    expect(second.articlesIngested).toBe(2);
    expect(second.completedAt).toBeInstanceOf(Date);
    expect("candidateOutcomes" in second).toBe(false);
    expect("articlesSkippedStale" in second).toBe(false);

    expect(simulatedRow.status).toBe("completed");
    expect(simulatedRow.articlesIngested).toBe(2);
  });

  /**
   * The arm must be narrow. A dropped connection is not a schema problem, so
   * updateRun still throws and finalizeRun's retry (not this arm) handles it.
   */
  it("does not strip the new columns for any other error class", async () => {
    updateBehavior.failWith = () => new Error("Connection terminated unexpectedly");

    await expect(service.updateRun(RUN_ID, terminalWrite)).rejects.toThrow(
      /Connection terminated unexpectedly/
    );

    expect(setPayloads).toHaveLength(1);
    expect(setPayloads[0].articlesSkippedStale).toBe(3);
  });

  /**
   * The outcome list is diagnostic detail. Serializing it must never be able to
   * cost the run its terminal status and counters.
   */
  it("still lands the terminal status and counters when the outcome list cannot be serialized", async () => {
    const circular: Record<string, unknown> = { url: "https://example.com/a" };
    circular.self = circular;

    await service.updateRun(RUN_ID, {
      ...terminalWrite,
      candidateOutcomes: [circular as unknown as CandidateOutcome],
    });

    expect(setPayloads).toHaveLength(1);
    expect(setPayloads[0].status).toBe("completed");
    expect(setPayloads[0].articlesIngested).toBe(2);
    expect(setPayloads[0].articlesSkippedStale).toBe(3);
    expect("candidateOutcomes" in setPayloads[0]).toBe(false);

    expect(simulatedRow.status).toBe("completed");
    expect(simulatedRow.articlesIngested).toBe(2);
  });
});
