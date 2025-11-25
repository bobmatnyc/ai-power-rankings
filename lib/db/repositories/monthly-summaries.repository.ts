/**
 * Monthly Summaries Database Repository
 * Handles all database operations for What's New monthly reports
 */

import { desc, eq } from "drizzle-orm";
import { getDb } from "../connection";
import { monthlySummaries, type MonthlySummary } from "../schema";

export class MonthlySummariesRepository {
  /**
   * Get the latest monthly summary
   */
  async getLatest(): Promise<MonthlySummary | null> {
    const db = getDb();
    if (!db) {
      throw new Error("Database connection not available");
    }

    const results = await db
      .select()
      .from(monthlySummaries)
      .orderBy(desc(monthlySummaries.period))
      .limit(1);

    return results[0] || null;
  }

  /**
   * Get a specific monthly summary by period (YYYY-MM)
   */
  async getByPeriod(period: string): Promise<MonthlySummary | null> {
    const db = getDb();
    if (!db) {
      throw new Error("Database connection not available");
    }

    const results = await db
      .select()
      .from(monthlySummaries)
      .where(eq(monthlySummaries.period, period))
      .limit(1);

    return results[0] || null;
  }

  /**
   * Get all monthly summaries ordered by period (newest first)
   */
  async getAll(): Promise<MonthlySummary[]> {
    const db = getDb();
    if (!db) {
      throw new Error("Database connection not available");
    }

    return db
      .select()
      .from(monthlySummaries)
      .orderBy(desc(monthlySummaries.period));
  }

  /**
   * Get paginated monthly summaries
   */
  async getPaginated(limit: number, offset: number): Promise<{
    summaries: MonthlySummary[];
    total: number;
  }> {
    const db = getDb();
    if (!db) {
      throw new Error("Database connection not available");
    }

    const [summaries, countResult] = await Promise.all([
      db
        .select()
        .from(monthlySummaries)
        .orderBy(desc(monthlySummaries.period))
        .limit(limit)
        .offset(offset),
      db.select({ count: monthlySummaries.id }).from(monthlySummaries),
    ]);

    return {
      summaries,
      total: countResult.length,
    };
  }

  /**
   * Get previous month's summary relative to a given period
   */
  async getPrevious(currentPeriod: string): Promise<MonthlySummary | null> {
    const db = getDb();
    if (!db) {
      throw new Error("Database connection not available");
    }

    const results = await db
      .select()
      .from(monthlySummaries)
      .where(eq(monthlySummaries.period, this.getPreviousPeriod(currentPeriod)))
      .limit(1);

    return results[0] || null;
  }

  /**
   * Get next month's summary relative to a given period
   */
  async getNext(currentPeriod: string): Promise<MonthlySummary | null> {
    const db = getDb();
    if (!db) {
      throw new Error("Database connection not available");
    }

    const results = await db
      .select()
      .from(monthlySummaries)
      .where(eq(monthlySummaries.period, this.getNextPeriod(currentPeriod)))
      .limit(1);

    return results[0] || null;
  }

  /**
   * Helper: Calculate previous period (YYYY-MM)
   */
  private getPreviousPeriod(period: string): string {
    const [year, month] = period.split("-").map(Number);
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    return `${prevYear}-${String(prevMonth).padStart(2, "0")}`;
  }

  /**
   * Helper: Calculate next period (YYYY-MM)
   */
  private getNextPeriod(period: string): string {
    const [year, month] = period.split("-").map(Number);
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
  }

  /**
   * Format period for display (e.g., "2025-01" -> "January 2025")
   */
  formatPeriod(period: string): string {
    const [year, month] = period.split("-");
    const date = new Date(`${year}-${month}-01`);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
    });
  }

  /**
   * Extract excerpt from content (first 200 characters)
   */
  extractExcerpt(content: string, maxLength: number = 200): string {
    // Remove markdown headers and formatting
    const plainText = content
      .replace(/^#{1,6}\s+/gm, "") // Remove headers
      .replace(/\*\*(.*?)\*\*/g, "$1") // Remove bold
      .replace(/\*(.*?)\*/g, "$1") // Remove italic
      .replace(/\[(.*?)\]\(.*?\)/g, "$1") // Remove links
      .trim();

    if (plainText.length <= maxLength) {
      return plainText;
    }

    return plainText.substring(0, maxLength).trim() + "...";
  }
}
