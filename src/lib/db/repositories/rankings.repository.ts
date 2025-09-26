/**
 * Rankings Repository
 * Handles data access for AI tool rankings from PostgreSQL database
 */

import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "../connection";
import { type NewRanking, type Ranking, rankings } from "../schema";
import { BaseRepository } from "./base.repository";

export interface RankingData {
  id: string;
  period: string;
  algorithm_version: string;
  is_current: boolean;
  published_at: Date | null;
  data: any; // JSONB data containing the full rankings structure
  created_at: Date;
  updated_at: Date;
}

export class RankingsRepository extends BaseRepository<RankingData> {
  /**
   * Get current rankings (marked as is_current = true)
   */
  async getCurrentRankings(): Promise<RankingData | null> {
    const db = getDb();
    if (!db) {
      throw new Error("Database connection not available");
    }

    try {
      const result = await db
        .select()
        .from(rankings)
        .where(eq(rankings.isCurrent, true))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      return this.mapToRankingData(result[0]);
    } catch (error) {
      console.error("Error fetching current rankings:", error);
      throw error;
    }
  }

  /**
   * Get rankings by period (e.g., '2025-09')
   */
  async getByPeriod(period: string): Promise<RankingData | null> {
    const db = getDb();
    if (!db) {
      throw new Error("Database connection not available");
    }

    try {
      const result = await db
        .select()
        .from(rankings)
        .where(eq(rankings.period, period))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      return this.mapToRankingData(result[0]);
    } catch (error) {
      console.error("Error fetching rankings by period:", error);
      throw error;
    }
  }

  /**
   * Get all rankings, ordered by period descending
   */
  async findAll(): Promise<RankingData[]> {
    const db = getDb();
    if (!db) {
      throw new Error("Database connection not available");
    }

    try {
      const result = await db
        .select()
        .from(rankings)
        .orderBy(desc(rankings.period));

      return result.map(r => this.mapToRankingData(r));
    } catch (error) {
      console.error("Error fetching all rankings:", error);
      throw error;
    }
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
        algorithmVersion: data.algorithm_version || "v1.0",
        isCurrent: data.is_current || false,
        publishedAt: data.published_at || null,
        data: data.data || [],
      };

      const result = await db
        .insert(rankings)
        .values(newRanking)
        .returning();

      return this.mapToRankingData(result[0]);
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
      if (data.algorithm_version !== undefined) updateData.algorithmVersion = data.algorithm_version;
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

      return this.mapToRankingData(result[0]);
    } catch (error) {
      console.error("Error updating rankings:", error);
      throw error;
    }
  }

  /**
   * Set current rankings (unset all others, set one as current)
   */
  async setAsCurrent(id: string): Promise<boolean> {
    const db = getDb();
    if (!db) {
      throw new Error("Database connection not available");
    }

    try {
      // Start a transaction
      await db.transaction(async (tx) => {
        // Unset all current flags
        await tx
          .update(rankings)
          .set({ isCurrent: false });

        // Set the specified ranking as current
        await tx
          .update(rankings)
          .set({
            isCurrent: true,
            publishedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(rankings.id, id));
      });

      return true;
    } catch (error) {
      console.error("Error setting current rankings:", error);
      throw error;
    }
  }

  /**
   * Delete rankings by period
   */
  async deleteByPeriod(period: string): Promise<boolean> {
    const db = getDb();
    if (!db) {
      throw new Error("Database connection not available");
    }

    try {
      const result = await db
        .delete(rankings)
        .where(eq(rankings.period, period));

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
      const result = await db
        .delete(rankings)
        .where(eq(rankings.id, id));

      return true;
    } catch (error) {
      console.error("Error deleting rankings:", error);
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