/**
 * #480: reverting one article's own ranking effect when the article is deleted.
 *
 * Why: ingestion and recalculation write one `article_rankings_changes` row per tool
 * and move that tool's `overallScore` (in `deltaScore` and `currentScore`) by the
 * row's `scoreChange`. Deleting the article must undo exactly that movement, and
 * nothing else: a whole-board restore from `articles.rankings_snapshot` would erase
 * later changes from other articles and the monthly job.
 * What: `revertArticleAndSoftDelete` first claims the article's applied, not-yet-rolled-back
 * rows in one `UPDATE ... RETURNING` (a concurrent delete then claims nothing), subtracts the
 * summed `scoreChange` of the claimed rows from each affected tool under a row lock
 * (`SELECT ... FOR UPDATE`, so a concurrent score write is not lost), and soft-deletes the article. The caller runs it inside one DB
 * transaction, so any thrown error leaves all three steps unapplied.
 * Test: lib/services/article-db-service.delete-revert.test.ts
 */

import { and, eq } from "drizzle-orm";
import { type ArticleRankingsChange, articleRankingsChanges, articles } from "@/lib/db/article-schema";
import { tools } from "@/lib/db/schema";

/** Score fields of a tool row that the ingest path writes. */
export interface ToolScoreRow {
  id: string;
  deltaScore: unknown;
  currentScore: unknown;
}

/** The DB operations the revert needs, all bound to one transaction. */
export interface DeleteRevertStore {
  /** Atomically marks the article's applied, not-rolled-back rows rolled back; returns them. */
  claimAppliedChanges(articleId: string): Promise<ArticleRankingsChange[]>;
  /** Reads the tool row and locks it until the transaction ends. */
  getToolForUpdate(toolId: string): Promise<ToolScoreRow | null>;
  setToolScores(toolId: string, deltaScore: object, currentScore: object): Promise<void>;
  softDeleteArticle(articleId: string): Promise<boolean>;
}

// biome-ignore lint/suspicious/noExplicitAny: drizzle's transaction type differs between the HTTP and pool drivers
type Tx = any;

/** Binds `DeleteRevertStore` to a drizzle transaction handle. */
export function createDeleteRevertStore(tx: Tx): DeleteRevertStore {
  return {
    async claimAppliedChanges(articleId) {
      return tx
        .update(articleRankingsChanges)
        .set({ isApplied: false, rolledBack: true, rolledBackAt: new Date() })
        .where(
          and(
            eq(articleRankingsChanges.articleId, articleId),
            eq(articleRankingsChanges.isApplied, true),
            eq(articleRankingsChanges.rolledBack, false)
          )
        )
        .returning();
    },
    async getToolForUpdate(toolId) {
      const [row] = await tx
        .select({ id: tools.id, deltaScore: tools.deltaScore, currentScore: tools.currentScore })
        .from(tools)
        .where(eq(tools.id, toolId))
        .limit(1)
        .for("update");
      return row ?? null;
    },
    async setToolScores(toolId, deltaScore, currentScore) {
      await tx
        .update(tools)
        .set({ deltaScore, currentScore, scoreUpdatedAt: new Date(), updatedAt: new Date() })
        .where(eq(tools.id, toolId));
    },
    async softDeleteArticle(articleId) {
      const rows = await tx
        .update(articles)
        .set({ status: "deleted", updatedAt: new Date() })
        .where(eq(articles.id, articleId))
        .returning({ id: articles.id });
      return rows.length > 0;
    },
  };
}

function overallScoreOf(score: unknown): number {
  const value = (score as { overallScore?: unknown } | null)?.overallScore;
  const n = typeof value === "number" ? value : Number.parseFloat(String(value ?? "0"));
  if (!Number.isFinite(n)) throw new Error(`Non-numeric overallScore: ${String(value)}`);
  return n;
}

function parseScoreChange(change: ArticleRankingsChange): number {
  const n = Number.parseFloat(change.scoreChange ?? "0");
  if (!Number.isFinite(n)) {
    throw new Error(`Ranking change ${change.id} has a non-numeric score_change: ${change.scoreChange}`);
  }
  return n;
}

/**
 * Reverts the article's own applied ranking deltas, marks them rolled back, and
 * soft-deletes the article. Returns the rows rolled back and the ids of affected tools
 * that no longer exist.
 * Throws on any failure; the caller's transaction then discards every step.
 */
export async function revertArticleAndSoftDelete(
  store: DeleteRevertStore,
  articleId: string
): Promise<{ rolledBack: number; missingTools: string[] }> {
  // #480: claim first; only rows this transaction claimed are summed, so a second delete reverts nothing.
  const changes = (await store.claimAppliedChanges(articleId)).filter((c) => c.articleId === articleId);
  const missingTools: string[] = [];

  const deltaByTool = new Map<string, number>();
  for (const change of changes) {
    deltaByTool.set(change.toolId, (deltaByTool.get(change.toolId) ?? 0) + parseScoreChange(change));
  }

  for (const [toolId, delta] of deltaByTool) {
    if (delta === 0) continue;
    const tool = await store.getToolForUpdate(toolId);
    if (!tool) {
      missingTools.push(toolId);
      // The tool row is gone, so no score of it carries this article's effect.
      console.warn(`[ArticleDelete] #480: tool ${toolId} not found; nothing to revert`);
      continue;
    }
    const deltaScore = {
      ...((tool.deltaScore as object | null) ?? {}),
      overallScore: overallScoreOf(tool.deltaScore) - delta,
    };
    const currentScore = {
      ...((tool.currentScore as object | null) ?? {}),
      overallScore: overallScoreOf(tool.currentScore) - delta,
    };
    await store.setToolScores(toolId, deltaScore, currentScore);
  }

  if (!(await store.softDeleteArticle(articleId))) {
    throw new Error(`Article ${articleId} not found for soft delete`);
  }
  return { rolledBack: changes.length, missingTools };
}
