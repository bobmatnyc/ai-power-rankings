/**
 * #480: deleting an article reverts exactly its own applied ranking deltas, in one transaction.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

interface ChangeRow {
  id: string;
  articleId: string;
  toolId: string;
  scoreChange: string;
  isApplied: boolean;
  rolledBack: boolean;
}
interface ToolRow {
  id: string;
  deltaScore: { overallScore: number };
  currentScore: { overallScore: number };
}
interface State {
  changes: ChangeRow[];
  tools: ToolRow[];
  articleStatus: Record<string, string>;
}

const h = vi.hoisted(() => ({
  state: null as unknown as State,
  failOnSetToolId: null as string | null,
  // Concurrent mode: transactions see each other's writes at once (no snapshot copy).
  live: false,
  repo: {
    createProcessingLog: vi.fn(),
    updateProcessingLog: vi.fn(),
    getArticleById: vi.fn(),
    rollbackArticleRankings: vi.fn(),
    deleteArticle: vi.fn(),
  },
}));

// Fake DB: a transaction works on a deep copy and commits it only when the callback returns.
const fakeDb = {
  transaction: async (fn: (tx: { state: State }) => Promise<void>) => {
    if (h.live) return fn({ state: h.state });
    const draft = structuredClone(h.state);
    await fn({ state: draft });
    h.state = draft;
  },
};

vi.mock("../db/connection", () => ({ getDb: () => fakeDb }));
vi.mock("../db/repositories/articles.repository", () => ({
  ArticlesRepository: vi.fn(() => h.repo),
}));
vi.mock("./article-ingestion.service", () => ({
  AIAnalyzer: vi.fn(),
  ContentExtractor: vi.fn(),
  RankingsCalculator: vi.fn(),
}));
vi.mock("./article-delete-revert", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./article-delete-revert")>();
  return {
    ...actual,
    createDeleteRevertStore: (tx: { state: State }) => ({
      // #480: atomic claim, like UPDATE ... WHERE NOT rolled_back RETURNING *.
      claimAppliedChanges: async (articleId: string) => {
        const claimed = tx.state.changes.filter(
          (c) => c.articleId === articleId && c.isApplied && !c.rolledBack
        );
        for (const c of claimed) {
          c.isApplied = false;
          c.rolledBack = true;
        }
        return structuredClone(claimed);
      },
      getToolForUpdate: async (toolId: string) => tx.state.tools.find((t) => t.id === toolId) ?? null,
      setToolScores: async (
        toolId: string,
        deltaScore: { overallScore: number },
        currentScore: { overallScore: number }
      ) => {
        if (toolId === h.failOnSetToolId) throw new Error("simulated DB failure");
        const tool = tx.state.tools.find((t) => t.id === toolId)!;
        tool.deltaScore = deltaScore;
        tool.currentScore = currentScore;
      },
      softDeleteArticle: async (articleId: string) => {
        if (!(articleId in tx.state.articleStatus)) return false;
        tx.state.articleStatus[articleId] = "deleted";
        return true;
      },
    }),
  };
});

import { ArticleDatabaseService } from "./article-db-service";

const tool = (id: string, delta: number, baseline: number): ToolRow => ({
  id,
  deltaScore: { overallScore: delta },
  currentScore: { overallScore: baseline + delta },
});

beforeEach(() => {
  h.failOnSetToolId = null;
  h.live = false;
  h.repo.createProcessingLog.mockResolvedValue({ id: "log-1" });
  h.repo.updateProcessingLog.mockResolvedValue(null);
  h.repo.getArticleById.mockResolvedValue({ id: "a1", rankingsSnapshot: { rankings: [] } });
  // Pre-fix behaviour flags rows only; it is no longer called on delete.
  h.repo.rollbackArticleRankings.mockResolvedValue(0);
  h.repo.deleteArticle.mockImplementation(async (id: string) => {
    h.state.articleStatus[id] = "deleted";
    return true;
  });
  // Tool t1: baseline 80; article a1 added +5, then article a2 added +2 later. Tool t2: a1 took -3.
  h.state = {
    tools: [tool("t1", 7, 80), tool("t2", -3, 70)],
    changes: [
      { id: "c1", articleId: "a1", toolId: "t1", scoreChange: "5.0000", isApplied: true, rolledBack: false },
      { id: "c2", articleId: "a1", toolId: "t2", scoreChange: "-3.0000", isApplied: true, rolledBack: false },
      { id: "c3", articleId: "a2", toolId: "t1", scoreChange: "2.0000", isApplied: true, rolledBack: false },
    ],
    articleStatus: { a1: "active", a2: "active", a3: "active" },
  };
});

describe("ArticleDatabaseService.deleteArticle (#480)", () => {
  it("reverts this article's deltas and keeps another article's later change", async () => {
    await new ArticleDatabaseService().deleteArticle("a1");

    const [t1, t2] = h.state.tools;
    expect(t1!.deltaScore.overallScore).toBe(2);
    expect(t1!.currentScore.overallScore).toBe(82);
    expect(t2!.deltaScore.overallScore).toBe(0);
    expect(t2!.currentScore.overallScore).toBe(70);
    expect(h.state.changes.map((c) => [c.id, c.rolledBack])).toEqual([
      ["c1", true],
      ["c2", true],
      ["c3", false],
    ]);
    expect(h.state.articleStatus.a1).toBe("deleted");
    expect(h.state.articleStatus.a2).toBe("active");
  });

  it("deletes an article with no applied changes as before", async () => {
    const before = structuredClone(h.state.tools);
    h.repo.getArticleById.mockResolvedValue({ id: "a3", rankingsSnapshot: null });

    await new ArticleDatabaseService().deleteArticle("a3");

    expect(h.state.articleStatus.a3).toBe("deleted");
    expect(h.state.tools).toEqual(before);
    expect(h.state.changes.every((c) => !c.rolledBack)).toBe(true);
  });

  it("rolls back the whole delete when the revert fails midway (fail-closed)", async () => {
    const before = structuredClone(h.state);
    h.failOnSetToolId = "t2"; // t1 is reverted first, then t2 fails

    await expect(new ArticleDatabaseService().deleteArticle("a1")).rejects.toThrow(
      "simulated DB failure"
    );

    expect(h.state).toEqual(before);
    expect(h.state.articleStatus.a1).toBe("active");
    expect(h.repo.updateProcessingLog).toHaveBeenCalledWith(
      "log-1",
      expect.objectContaining({ status: "failed" })
    );
  });

  it("does not revert rows already rolled back", async () => {
    h.state.changes[0]!.rolledBack = true;
    h.state.changes[0]!.isApplied = false;
    h.state.tools[0] = tool("t1", 2, 80); // c1 was already reverted earlier

    await new ArticleDatabaseService().deleteArticle("a1");

    expect(h.state.tools[0]!.deltaScore.overallScore).toBe(2);
    expect(h.state.tools[1]!.deltaScore.overallScore).toBe(0);
    expect(h.state.articleStatus.a1).toBe("deleted");
  });

  it("two concurrent deletes of one article revert its deltas once", async () => {
    h.live = true;
    const svc = new ArticleDatabaseService();

    await Promise.allSettled([svc.deleteArticle("a1"), svc.deleteArticle("a1")]);

    expect(h.state.tools[0]!.deltaScore.overallScore).toBe(2);
    expect(h.state.tools[1]!.deltaScore.overallScore).toBe(0);
  });

  it("records tools missing at revert time in the processing log", async () => {
    h.state.tools = h.state.tools.filter((t) => t.id !== "t2");

    await new ArticleDatabaseService().deleteArticle("a1");

    expect(h.repo.updateProcessingLog).toHaveBeenCalledWith(
      "log-1",
      expect.objectContaining({
        status: "completed",
        debugInfo: expect.objectContaining({ missingTools: ["t2"] }),
      })
    );
  });
});
