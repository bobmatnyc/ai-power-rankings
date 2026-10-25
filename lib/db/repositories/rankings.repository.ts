/**
 * Rankings Repository
 * Handles data access for AI tool rankings from PostgreSQL database
 */

import { and, desc, eq, lt, sql } from "drizzle-orm";
import { COMBINED_LIST, type RankingList, type StoredRankingList } from "@/lib/rankings/lists";
import { getDb } from "../connection";
import { type NewRanking, type Ranking, rankings } from "../schema";
import { BaseRepository } from "./base.repository";

export interface RankingData {
  id: string;
  period: string;
  /** #186: the list this board ranks; 'combined' is the legacy one-board row (D55). */
  list?: StoredRankingList;
  algorithm_version: string;
  is_current: boolean;
  published_at: Date | null;
  data: any; // JSONB data containing the full rankings structure
  created_at: Date;
  updated_at: Date;
}

export class RankingsRepository extends BaseRepository<RankingData> {
  /**
   * Get the current board of one list (marked as is_current = true).
   * #186: every list has its own current row; callers that predate #186 read the
   * legacy combined board, so the default stays 'combined'.
   */
  async getCurrentRankings(list: StoredRankingList = COMBINED_LIST): Promise<RankingData | null> {
    const db = getDb();
    if (!db) {
      throw new Error("Database connection not available");
    }

    try {
      const result = await db
        .select()
        .from(rankings)
        .where(and(eq(rankings.isCurrent, true), eq(rankings.list, list)))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      return this.mapToRankingData(result[0]!);
    } catch (error) {
      console.error("Error fetching current rankings:", error);
      throw error;
    }
  }

  /**
   * Get rankings by period (e.g., '2025-09') for one list (#186: default 'combined').
   */
  async getByPeriod(period: string, list: StoredRankingList = COMBINED_LIST): Promise<RankingData | null> {
    const db = getDb();
    if (!db) {
      throw new Error("Database connection not available");
    }

    try {
      const result = await db
        .select()
        .from(rankings)
        .where(and(eq(rankings.period, period), eq(rankings.list, list)))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      return this.mapToRankingData(result[0]!);
    } catch (error) {
      console.error("Error fetching rankings by period:", error);
      throw error;
    }
  }

  /**
   * The latest ranking period strictly before `period`, or null when there is none.
   *
   * #193: the tool page's "change since last month" compares the current
   * period with this one. Read-only; one row.
   */
  async getLatestBefore(period: string, list: StoredRankingList = COMBINED_LIST): Promise<RankingData | null> {
    const db = getDb();
    if (!db) {
      throw new Error("Database connection not available");
    }

    const result = await db
      .select()
      .from(rankings)
      .where(and(lt(rankings.period, period), eq(rankings.list, list)))
      .orderBy(desc(rankings.period))
      .limit(1);

    return result[0] ? this.mapToRankingData(result[0]) : null;
  }

  /**
   * Get all legacy combined rankings, ordered by period descending.
   * #186: per-list rows are left out, so a period appears once, as before.
   */
  async findAll(): Promise<RankingData[]> {
    const list: StoredRankingList = COMBINED_LIST;
    const db = getDb();
    if (!db) {
      throw new Error("Database connection not available");
    }

    try {
      const result = await db
        .select()
        .from(rankings)
        .where(eq(rankings.list, list))
        .orderBy(desc(rankings.period));

      return result.map((r) => this.mapToRankingData(r));
    } catch (error) {
      console.error("Error fetching all rankings:", error);
      throw error;
    }
  }

  /**
   * #185: every stored board of one list, ordered by period descending. The public
   * history (trending) reads this; it never reads the combined rows.
   */
  async findAllForList(list: RankingList): Promise<RankingData[]> {
    const db = getDb();
    if (!db) {
      throw new Error("Database connection not available");
    }
    const result = await db
      .select()
      .from(rankings)
      .where(eq(rankings.list, list))
      .orderBy(desc(rankings.period));
    return result.map((r) => this.mapToRankingData(r));
  }

  /**
   * Create new rankings
   */
  async create(data: Partial<RankingData>): Promise<RankingData> {
    const db = getDb();
    if (!db) {
      throw new Error("Database connection not available");
    }

    try {
      const newRanking: NewRanking = {
        period: data.period!,
        ...(data.list ? { list: data.list } : {}),
        algorithmVersion: data.algorithm_version || "v1.0",
        isCurrent: data.is_current || false,
        publishedAt: data.published_at || null,
        data: data.data || [],
      };

      const result = await db.insert(rankings).values(newRanking).returning();

      return this.mapToRankingData(result[0]!);
    } catch (error) {
      console.error("Error creating rankings:", error);
      throw error;
    }
  }

  /**
   * Update rankings by ID
   */
  async update(id: string, data: Partial<RankingData>): Promise<RankingData | null> {
    const db = getDb();
    if (!db) {
      throw new Error("Database connection not available");
    }

    try {
      const updateData: Partial<NewRanking> = {};

      if (data.period !== undefined) updateData.period = data.period;
      if (data.algorithm_version !== undefined)
        updateData.algorithmVersion = data.algorithm_version;
      if (data.is_current !== undefined) updateData.isCurrent = data.is_current;
      if (data.published_at !== undefined) updateData.publishedAt = data.published_at;
      if (data.data !== undefined) updateData.data = data.data;

      const result = await db
        .update(rankings)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(rankings.id, id))
        .returning();

      if (result.length === 0) {
        return null;
      }

      return this.mapToRankingData(result[0]!);
    } catch (error) {
      console.error("Error updating rankings:", error);
      throw error;
    }
  }

  /**
   * Set current rankings (unset the other rows of the same list, set one as current).
   * #186: each list keeps its own current row, so only rows of the target's list are demoted.
   */
  async setAsCurrent(id: string): Promise<boolean> {
    const db = getDb();
    if (!db) {
      throw new Error("Database connection not available");
    }

    try {
      // Start a transaction
      await db.transaction(async (tx) => {
        const target = await tx.select().from(rankings).where(eq(rankings.id, id)).limit(1);
        // #93: an admin rebuild replaces a draft row (new id); nothing is demoted for a missing id.
        if (target.length === 0) {
          throw new Error(`Ranking ${id} not found; current ranking left unchanged`);
        }
        // #186: unset the current flag within the target's list only
        await tx
          .update(rankings)
          .set({ isCurrent: false })
          // (a row read without the column is a pre-0020 row: the column default, 'combined')
          .where(and(eq(rankings.isCurrent, true), eq(rankings.list, target[0]!.list ?? COMBINED_LIST)));

        // Set the specified ranking as current
        const promoted = await tx
          .update(rankings)
          .set({
            isCurrent: true,
            publishedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(rankings.id, id))
          .returning();

        // #93: an admin rebuild replaces a draft row (new id). If the id is gone,
        // throw so the transaction rolls back the demotion above.
        if (promoted.length === 0) {
          throw new Error(`Ranking ${id} not found; current ranking left unchanged`);
        }
      });

      return true;
    } catch (error) {
      console.error("Error setting current rankings:", error);
      throw error;
    }
  }

  /**
   * Delete rankings by period, for one list (#186: default 'combined')
   */
  async deleteByPeriod(period: string, list: StoredRankingList = COMBINED_LIST): Promise<boolean> {
    const db = getDb();
    if (!db) {
      throw new Error("Database connection not available");
    }

    try {
      await db.delete(rankings).where(and(eq(rankings.period, period), eq(rankings.list, list)));

      return true;
    } catch (error) {
      console.error("Error deleting rankings:", error);
      throw error;
    }
  }

  /**
   * Delete rankings by ID
   */
  async deleteById(id: string): Promise<boolean> {
    const db = getDb();
    if (!db) {
      throw new Error("Database connection not available");
    }

    try {
      await db.delete(rankings).where(eq(rankings.id, id));

      return true;
    } catch (error) {
      console.error("Error deleting rankings:", error);
      throw error;
    }
  }

  /**
   * Find ranking by ID (required by BaseRepository)
   */
  async findById(id: string): Promise<RankingData | null> {
    const db = getDb();
    if (!db) {
      throw new Error("Database connection not available");
    }

    try {
      const result = await db.select().from(rankings).where(eq(rankings.id, id)).limit(1);

      if (result.length === 0) {
        return null;
      }

      return this.mapToRankingData(result[0]!);
    } catch (error) {
      console.error("Error finding ranking by id:", error);
      throw error;
    }
  }

  /**
   * Delete ranking (required by BaseRepository)
   */
  async delete(id: string): Promise<boolean> {
    return this.deleteById(id);
  }

  /**
   * Count total number of rankings (required by BaseRepository)
   */
  async count(): Promise<number> {
    const db = getDb();
    if (!db) {
      throw new Error("Database connection not available");
    }

    try {
      const result = await db.select({ count: sql<number>`count(*)` }).from(rankings);

      return result[0]?.count || 0;
    } catch (error) {
      console.error("Error counting rankings:", error);
      throw error;
    }
  }

  /**
   * Map database record to RankingData
   */
  private mapToRankingData(ranking: Ranking): RankingData {
    return {
      id: ranking.id,
      period: ranking.period,
      list: ranking.list,
      algorithm_version: ranking.algorithmVersion,
      is_current: ranking.isCurrent,
      published_at: ranking.publishedAt,
      data: ranking.data,
      created_at: ranking.createdAt,
      updated_at: ranking.updatedAt,
    };
  }
}

// Create and export singleton instance
export const rankingsRepository = new RankingsRepository();
