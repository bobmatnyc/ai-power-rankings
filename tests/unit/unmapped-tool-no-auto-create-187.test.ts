import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * #187: a tool name the catalogue lookup left unmapped never creates a tool row.
 *
 * Why: with `ToolMapper` gone, "Copilot" no longer maps to "GitHub Copilot", so it
 * missed `existingTools` and `identifyNewEntities` queued it as a new tool;
 * `ArticleDatabaseService` then called `createAutoTool`, inserting a pending_review row.
 * What: runs the live `ArticleDatabaseService.ingestArticle` path with a stubbed
 * repository and asserts `createAutoTool` is not called for an unmapped name, nor
 * when the mapping report is missing; a mapped name absent from the tool list is
 * still queued, so the path is unchanged for it.
 * Test: `npx vitest run tests/unit/unmapped-tool-no-auto-create-187.test.ts`. No database.
 */

const repo = vi.hoisted(() => ({
  createAutoTool: vi.fn(async () => ({})),
  createAutoCompany: vi.fn(async () => ({})),
}));

vi.mock("../../lib/db/connection", () => ({ getDb: () => ({}) }));
vi.mock("../../lib/db/repositories/articles.repository", () => ({
  ArticlesRepository: class {
    generateUniqueSlug = async () => "slug";
    createArticle = async () => ({ id: "a1", sourceUrl: null });
    createProcessingLog = async () => ({ id: "log1" });
    updateProcessingLog = async () => ({});
    updateArticle = async () => ({});
    saveRankingChanges = async () => ({});
    createAutoTool = repo.createAutoTool;
    createAutoCompany = repo.createAutoCompany;
  },
}));

import { ArticleDatabaseService } from "../../lib/services/article-db-service";
import type { ToolMappingReport } from "../../lib/services/tool-mention-catalogue";

const mention = (tool: string) => ({ tool, context: "c", sentiment: 0, relevance: 1 });

function report(over: Partial<ToolMappingReport>): ToolMappingReport {
  return { mapped: 0, unmapped: 0, unmappedNames: [], catalogueError: null, articleUnmapped: true, ...over };
}

async function ingest(toolMentions: ReturnType<typeof mention>[], toolMapping?: ToolMappingReport) {
  const service = new ArticleDatabaseService();
  const proto = service as unknown as Record<string, unknown>;
  proto["getAllTools"] = async () => [];
  proto["getCurrentRankings"] = async () => [];
  proto["getExistingToolNames"] = async () => ["GitHub Copilot"];
  proto["getExistingCompanyNames"] = async () => [];
  proto["createRankingsSnapshot"] = async () => null;
  await service.ingestArticle({
    type: "preprocessed",
    dryRun: false,
    preprocessedData: {
      article: {
        title: "t",
        summary: "s",
        content: "c",
        source: "src",
        tags: [],
        importance_score: 5,
        overall_sentiment: 0,
        tool_mentions: toolMentions,
        company_mentions: [],
        toolMapping,
      },
    },
  });
}

beforeEach(() => {
  vi.stubEnv("OPENROUTER_API_KEY", "test-key");
  repo.createAutoTool.mockClear();
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});

describe("unmapped tool names never reach createAutoTool (#187)", () => {
  it("creates no tool for 'Copilot', which the catalogue left unmapped", async () => {
    await ingest([mention("Copilot")], report({ unmapped: 1, unmappedNames: ["Copilot"] }));
    expect(repo.createAutoTool).not.toHaveBeenCalled();
  });

  it("creates no tool for any mention when the catalogue read failed", async () => {
    await ingest(
      [mention("Copilot"), mention("Cursor")],
      report({ unmapped: 2, unmappedNames: ["Copilot", "Cursor"], catalogueError: "db down" })
    );
    expect(repo.createAutoTool).not.toHaveBeenCalled();
  });

  it("creates no tool when the mapping report is missing (cannot prove the name mapped)", async () => {
    await ingest([mention("Copilot")], undefined);
    expect(repo.createAutoTool).not.toHaveBeenCalled();
  });

  it("still queues a mapped name that is absent from the tool list", async () => {
    await ingest([mention("Cursor")], report({ mapped: 1, articleUnmapped: false }));
    expect(repo.createAutoTool).toHaveBeenCalledTimes(1);
  });
});
