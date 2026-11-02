import { getTableName } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * #185 M1: article ingestion refuses when the database has no current list board.
 *
 * Why: after v8 activation the rank lookup reads the per-list boards. Before the first
 *   per-list publish there are none; ingestion then carried on with an empty rank set
 *   and recorded snapshots and rank changes against it (fail-open).
 * What: a database stand-in answers every read with no rows and an articles repository
 *   stand-in records every write. With the database present and no list boards, a
 *   complete ingestion rejects with `NoCurrentListBoardsError` and writes nothing, and
 *   the ingestion preview's state read rejects too. With no database at all the preview
 *   state is still the empty state, as before.
 * Test: `npx vitest run tests/unit/article-empty-boards-185.test.ts`. No network.
 */

const state = vi.hoisted(() => ({ dbPresent: true, reads: [] as string[], writes: [] as string[] }));

vi.mock("server-only", () => ({}));
vi.mock("../../lib/startup-validation", () => ({ getOpenRouterApiKey: () => "test-key" }));
vi.mock("../../lib/db/connection", () => {
  const rows = (table: unknown) => {
    state.reads.push(getTableName(table as never));
    return Object.assign(Promise.resolve([]), { limit: async () => [], orderBy: async () => [] });
  };
  const write = (op: string) => (table: unknown) => {
    state.writes.push(`${op}:${getTableName(table as never)}`);
    const done = Object.assign(Promise.resolve([]), { returning: async () => [] });
    return { values: () => done, set: () => ({ where: () => done }), where: () => done };
  };
  const client = {
    select: () => ({ from: (table: unknown) => Object.assign(rows(table), { where: () => rows(table) }) }),
    insert: write("insert"),
    update: write("update"),
    delete: write("delete"),
  };
  return { getDb: () => (state.dbPresent ? client : null) };
});
vi.mock("../../lib/db/repositories/articles.repository", () => ({
  // Every repository call is a write or a lookup the test records; none should be reached.
  ArticlesRepository: class {
    constructor() {
      return new Proxy(this, {
        get: (_t, key) => async () => {
          state.writes.push(`articlesRepo.${String(key)}`);
          return { id: "x" };
        },
      });
    }
  },
}));

import { NoCurrentListBoardsError } from "../../lib/rankings/list-boards";
import { ArticleDatabaseService } from "../../lib/services/article-db-service";
import { ArticleIngestionService } from "../../lib/services/article-ingestion.service";

beforeEach(() => {
  state.dbPresent = true;
  state.reads = [];
  state.writes = [];
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const PREPROCESSED = {
  type: "preprocessed" as const,
  dryRun: false,
  preprocessedData: {
    article: { title: "A story", summary: "s", content: "c", tool_mentions: [], company_mentions: [] },
    predictedChanges: [{ toolId: "t1", toolName: "Tool", currentRank: 1, predictedRank: 1, rankChange: 0, scoreChange: 1 }],
    newTools: [],
    newCompanies: [],
  },
};

describe("no current list board with the database present (#185 M1)", () => {
  it("a complete ingestion refuses and writes no article, snapshot or rank change", async () => {
    const service = new ArticleDatabaseService();
    await expect(service.ingestArticle(PREPROCESSED as never)).rejects.toBeInstanceOf(NoCurrentListBoardsError);
    expect(state.reads).toContain("rankings");
    expect(state.writes).toEqual([]);
  });

  it("the ingestion preview's state read refuses", async () => {
    const service = new ArticleIngestionService() as unknown as { getCurrentState(dryRun: boolean): Promise<unknown> };
    await expect(service.getCurrentState(true)).rejects.toBeInstanceOf(NoCurrentListBoardsError);
  });
});

describe("no database (#185 M1: unchanged)", () => {
  it("the ingestion preview's state is still the empty state", async () => {
    state.dbPresent = false;
    const service = new ArticleIngestionService() as unknown as { getCurrentState(dryRun: boolean): Promise<unknown> };
    await expect(service.getCurrentState(true)).resolves.toEqual({
      currentRankings: [],
      existingTools: [],
      existingCompanies: [],
    });
  });
});
