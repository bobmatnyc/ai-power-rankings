import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Article ingestion must not delete the stored what's-new summary.
 *
 * Why: The public summary GET no longer generates, so a summary deleted on
 * ingestion stayed missing (the page fell back to an older month) and an
 * admin's regeneration was wiped by the next ingestion run.
 * What: Runs a full (non-dry-run) `ingestArticle()` with the AI analyzer,
 * rankings calculator, current-state read and `ArticleDatabaseService`
 * replaced, and asserts the article is saved while
 * `WhatsNewSummaryService` is never constructed or asked to invalidate.
 * Test: `npx vitest run tests/unit/ingestion-keeps-summary.test.ts`. No
 * database access, no network.
 */

const summary = vi.hoisted(() => ({ construct: vi.fn(), invalidateSummary: vi.fn() }));
const saveArticle = vi.hoisted(() => vi.fn(async () => ({ id: "article-1" })));

vi.mock("../../lib/services/whats-new-summary.service", () => ({
  WhatsNewSummaryService: class {
    constructor() {
      summary.construct();
    }
    invalidateSummary = summary.invalidateSummary;
  },
}));
vi.mock("../../lib/services/article-db-service", () => ({
  ArticleDatabaseService: class {
    ingestArticle = saveArticle;
  },
}));

import { ArticleIngestionService } from "../../lib/services/article-ingestion.service";

function stubbedService(): ArticleIngestionService {
  const service = new ArticleIngestionService();
  Object.defineProperty(service, "aiAnalyzer", {
    value: {
      analyzeContent: vi.fn(async () => ({
        title: "t",
        summary: "s",
        source: "src",
        tags: [],
        category: "news",
        importance_score: 5,
        overall_sentiment: 0,
        tool_mentions: [],
        company_mentions: [],
      })),
    },
  });
  Object.defineProperty(service, "rankingsCalculator", {
    value: {
      calculateRankingChanges: () => [],
      identifyNewEntities: () => ({ newTools: [], newCompanies: [] }),
    },
  });
  Object.defineProperty(service, "getCurrentState", {
    value: async () => ({ currentRankings: [], existingTools: [], existingCompanies: [] }),
  });
  return service;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});

describe("article ingestion keeps the stored monthly summary", () => {
  it("saves the article without deleting the summary", async () => {
    await stubbedService().ingestArticle({ type: "text", input: "article body", dryRun: false });
    expect(saveArticle).toHaveBeenCalledTimes(1);
    expect(summary.invalidateSummary).not.toHaveBeenCalled();
    expect(summary.construct).not.toHaveBeenCalled();
  });
});
