import { describe, expect, it } from "vitest";
import { AutomatedIngestionService } from "./automated-ingestion.service";
import { buildRunSummary, emptyRunCounts } from "./ingestion-run-summary";

/**
 * Same-event drop count in the run summary (#366).
 *
 * Why: production keeps only warn-level lines, and the drop reason ("same event"
 * vs "title similarity") was logged at info, so no live run could show the
 * same-event drops.
 *
 * What: filters a batch holding one same-event pair and one title-similarity pair,
 * then checks `sameEventDuplicates` is the same-event share of `semanticDuplicates`
 * and that the "Run summary" object carries it.
 *
 * Test: `npx vitest run lib/services/automated-ingestion.same-event-count.test.ts`.
 */

type Candidate = { title: string; url: string; publishedDate: string | null };

const OCT_29 = "2026-10-29T12:00:00Z";
const OCT_30 = "2026-10-30T09:00:00Z";

const BATCH: Array<[string, string]> = [
  // Same event, titles below the word-overlap floor (the #366 cluster).
  ["Hijacked Claude Code Extension on Cursor Marketplace Planted Persistent Backdoor", OCT_29],
  ["Anthropic VS Code Extension on Cursor Backdoored for Nearly 12 Hours", OCT_29],
  // Title similarity.
  ["OpenAI Releases GPT-5 Model for Developers Worldwide", OCT_30],
  ["OpenAI Releases GPT-5 Model for Developers Worldwide Today", OCT_30],
];

describe("sameEventDuplicates in the run summary (#366)", () => {
  it("counts the same-event drop apart from the title-similarity drop", async () => {
    const service = new AutomatedIngestionService() as unknown as {
      filterSemanticDuplicates(
        articles: Candidate[],
        existing: never[],
        runCounts: { sameEventDuplicates: number }
      ): Promise<Candidate[]>;
    };
    const runCounts = emptyRunCounts();
    const articles = BATCH.map(([title, publishedDate], i) => ({
      title,
      publishedDate,
      url: `https://outlet-${i}.example.com/story`,
    }));

    const kept = await service.filterSemanticDuplicates(articles, [], runCounts);
    runCounts.semanticDuplicates = articles.length - kept.length; // as the service assigns it

    expect(runCounts.semanticDuplicates).toBe(2);
    expect(runCounts.sameEventDuplicates).toBe(1);

    const summary = buildRunSummary(
      { runId: "r", status: "completed", errors: [], durationMs: 1, dryRun: false },
      runCounts
    );
    expect(summary).toMatchObject({ sameEventDuplicates: 1, semanticDuplicates: 2 });
  });
});
