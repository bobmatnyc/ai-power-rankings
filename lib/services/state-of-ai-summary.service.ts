/**
 * State of AI Summary reads (read-only since #182).
 *
 * Why: #182 merged the two monthly generators. This service's generator, which
 *   wrote a 400-600-word editorial into `state_of_ai_summaries`, is removed;
 *   every caller now reaches `WhatsNewSummaryService` in
 *   `whats-new-summary.service.ts`, which writes `monthly_report_versions`.
 *   The table's existing rows stay readable for `/api/state-of-ai/current`
 *   until the merged report has a version, and for the crawl monitor.
 * What: Reads only. No method inserts, updates or deletes a row.
 * Test: `tests/unit/monthly-report-182.test.ts`.
 */

import { getDb } from "@/lib/db/connection";
import { stateOfAiSummaries } from "@/lib/db/schema";
import type { StateOfAiSummary } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";

export class StateOfAiSummaryService {
  /**
   * Get current month and year
   */
  private getCurrentMonthYear(): { month: number; year: number } {
    const now = new Date();
    return {
      month: now.getMonth() + 1, // 1-12
      year: now.getFullYear(),
    };
  }

  /**
   * Get existing State of AI summary
   */
  async getSummary(month?: number, year?: number): Promise<StateOfAiSummary | null> {
    const db = getDb();
    if (!db) {
      throw new Error("Database connection not available");
    }

    const { month: targetMonth, year: targetYear } = month && year
      ? { month, year }
      : this.getCurrentMonthYear();

    const result = await db
      .select()
      .from(stateOfAiSummaries)
      .where(
        and(
          eq(stateOfAiSummaries.month, targetMonth),
          eq(stateOfAiSummaries.year, targetYear)
        )
      )
      .limit(1);

    return result.length > 0 ? result[0] : null;
  }

  /**
   * Get current month's summary or fallback to previous month
   */
  async getCurrentSummary(): Promise<StateOfAiSummary | null> {
    const db = getDb();
    if (!db) {
      throw new Error("Database connection not available");
    }

    const { month: currentMonth, year: currentYear } = this.getCurrentMonthYear();

    // Try current month first
    let result = await db
      .select()
      .from(stateOfAiSummaries)
      .where(
        and(
          eq(stateOfAiSummaries.month, currentMonth),
          eq(stateOfAiSummaries.year, currentYear)
        )
      )
      .limit(1);

    if (result.length > 0) {
      return result[0];
    }

    // Fallback to most recent summary
    result = await db
      .select()
      .from(stateOfAiSummaries)
      .orderBy(desc(stateOfAiSummaries.year), desc(stateOfAiSummaries.month))
      .limit(1);

    return result.length > 0 ? result[0] : null;
  }

  /**
   * List all State of AI summaries
   */
  async listSummaries(limit = 12): Promise<StateOfAiSummary[]> {
    const db = getDb();
    if (!db) {
      throw new Error("Database connection not available");
    }

    return await db
      .select()
      .from(stateOfAiSummaries)
      .orderBy(desc(stateOfAiSummaries.year), desc(stateOfAiSummaries.month))
      .limit(limit);
  }
}
