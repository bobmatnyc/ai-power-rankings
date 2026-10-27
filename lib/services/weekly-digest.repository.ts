/**
 * The database boundary of the weekly digest (#181).
 *
 * Why: the generate-and-store service must be testable without a database, and
 * the pages and the sitemap must read digests without an OpenRouter key (the
 * same split as `whats-new-summary.service.ts`, #54).
 * What: `WeeklyDigestRepository` is the port the service uses: one stored-row
 * read, the week's article and new-tool reads, and a save that either inserts
 * or, with `overwrite`, replaces the week's row. `getStoredDigest` and
 * `listDigests` are the page readers; they throw when the database is
 * unavailable or a read fails, never an empty result.
 * Test: the service is tested over an in-memory repository in
 * `tests/unit/weekly-digest-service-181.test.ts`; the readers through the pages
 * in `tests/unit/weekly-digest-display-181.test.tsx`.
 */

import { and, desc, eq, gte, lte } from "drizzle-orm";
import { articles } from "@/lib/db/article-schema";
import { getDb } from "@/lib/db/connection";
import { type NewWeeklyDigest, type WeeklyDigest, tools, weeklyDigests } from "@/lib/db/schema";
import type { DigestArticle, DigestNewTool } from "@/lib/services/weekly-digest-input";

/** Most articles one digest reads, by importance then date; keeps the prompt bounded. */
export const MAX_DIGEST_ARTICLES = 25;
/** Most new tools one digest lists. */
export const MAX_DIGEST_NEW_TOOLS = 10;

export interface DigestWindowRange {
  start: Date;
  end: Date;
}

export interface WeeklyDigestRepository {
  getByWeek(week: string): Promise<WeeklyDigest | null>;
  loadArticles(window: DigestWindowRange): Promise<DigestArticle[]>;
  loadNewTools(window: DigestWindowRange): Promise<DigestNewTool[]>;
  /** True when a row was written; false when the week already had one and `overwrite` is off. */
  save(row: NewWeeklyDigest, overwrite: boolean): Promise<boolean>;
}

function requireDb(): NonNullable<ReturnType<typeof getDb>> {
  const db = getDb();
  if (!db) {
    throw new Error("Database connection not available");
  }
  return db;
}

/** The drizzle implementation of the port. */
export function createWeeklyDigestRepository(): WeeklyDigestRepository {
  return {
    getByWeek: getStoredDigest,

    async loadArticles(window) {
      // #181: the importance score only orders the cap; it is never sent to the model.
      return requireDb()
        .select({
          id: articles.id,
          slug: articles.slug,
          title: articles.title,
          summary: articles.summary,
          publishedAt: articles.publishedDate,
          toolMentions: articles.toolMentions,
        })
        .from(articles)
        .where(
          and(
            eq(articles.status, "active"),
            gte(articles.publishedDate, window.start),
            lte(articles.publishedDate, window.end)
          )
        )
        .orderBy(desc(articles.importanceScore), desc(articles.publishedDate))
        .limit(MAX_DIGEST_ARTICLES);
    },

    async loadNewTools(window) {
      return requireDb()
        .select({ id: tools.id, name: tools.name, category: tools.category })
        .from(tools)
        .where(
          and(eq(tools.status, "active"), gte(tools.createdAt, window.start), lte(tools.createdAt, window.end))
        )
        .orderBy(desc(tools.createdAt))
        .limit(MAX_DIGEST_NEW_TOOLS);
    },

    async save(row, overwrite) {
      const insert = requireDb().insert(weeklyDigests).values(row);
      if (overwrite) {
        const replaced = await insert
          .onConflictDoUpdate({
            target: weeklyDigests.week,
            set: {
              windowStart: row.windowStart,
              windowEnd: row.windowEnd,
              content: row.content,
              dataHash: row.dataHash,
              metadata: row.metadata,
              generatedAt: row.generatedAt ?? new Date(),
              updatedAt: new Date(),
            },
          })
          .returning();
        return replaced.length > 0;
      }
      // #181: a concurrent second fire loses the insert and writes nothing.
      const inserted = await insert.onConflictDoNothing({ target: weeklyDigests.week }).returning();
      return inserted.length > 0;
    },
  };
}

/** The stored digest for `week` (`YYYY-Www`), or null when no row exists. */
export async function getStoredDigest(week: string): Promise<WeeklyDigest | null> {
  const rows = await requireDb().select().from(weeklyDigests).where(eq(weeklyDigests.week, week)).limit(1);
  return rows[0] ?? null;
}

/** Stored digests, newest week first. `YYYY-Www` sorts chronologically as text. */
export async function listDigests(limit = 8): Promise<WeeklyDigest[]> {
  return requireDb().select().from(weeklyDigests).orderBy(desc(weeklyDigests.week)).limit(limit);
}

/** Every stored week and when its row last changed, newest first; the sitemap reads this. */
export async function listDigestWeeks(): Promise<Array<{ week: string; updatedAt: Date }>> {
  return requireDb()
    .select({ week: weeklyDigests.week, updatedAt: weeklyDigests.updatedAt })
    .from(weeklyDigests)
    .orderBy(desc(weeklyDigests.week));
}
