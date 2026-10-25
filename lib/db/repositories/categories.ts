/**
 * Categories Repository
 * Server-side category fetching to eliminate client-side API waterfall
 * Reduces FCP by 300-800ms by moving category computation to server
 *
 * Quick Win #3: Added Next.js cache wrapper for 50-200ms TTFB improvement
 * Categories change infrequently, so we can cache them with 5-minute revalidation
 */

import { currentListBoardsWhere, listBoardEntries } from "@/lib/rankings/list-boards";
import { unstable_cache } from "next/cache";
import { getDb } from "../connection";
import { rankings } from "../schema";

export interface Category {
  id: string;
  name: string;
  count: number;
}

/**
 * Get category display name from category ID
 * This is a simplified version - can be enhanced with i18n later
 */
function getCategoryName(categoryId: string): string {
  return categoryId
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Internal function to fetch categories with counts from current rankings
 * This runs on the server during SSR/SSG, eliminating client-side fetch waterfall
 * #185: counts the tools of every list's current board (each tool once); a failed read throws.
 * Test: `tests/unit/list-boards-185.test.ts`.
 */
async function _getCategoriesWithCounts(): Promise<Category[]> {
  try {
    const db = getDb();
    if (!db) {
      console.warn("[Categories] Database connection not available, returning default");
      return [{ id: "all", name: "All Categories", count: 0 }];
    }

    // #185: every list's current board, never the combined one. A tool is ranked in at
    // most one list, so each ranked tool is counted once.
    const listRows = await db.select().from(rankings).where(currentListBoardsWhere());

    if (listRows.length === 0) {
      console.warn("[Categories] No current rankings data found");
      return [{ id: "all", name: "All Categories", count: 0 }];
    }

    const rankingsArray: any[] = listBoardEntries(listRows);

    // Count tools by category
    const categoryMap: Record<string, number> = {};

    for (const ranking of rankingsArray) {
      // Try different possible category field names
      const category = ranking.tool?.category || ranking.category;
      if (category && typeof category === "string") {
        categoryMap[category] = (categoryMap[category] || 0) + 1;
      }
    }

    // Convert to array and sort by count
    const categories: Category[] = Object.entries(categoryMap)
      .map(([id, count]) => ({
        id,
        name: getCategoryName(id),
        count: count as number,
      }))
      .sort((a, b) => b.count - a.count);

    // Add "All Categories" at the beginning
    const allCategories: Category[] = [
      {
        id: "all",
        name: "All Categories",
        count: rankingsArray.length
      },
      ...categories,
    ];

    console.log(
      `[Categories] Fetched ${categories.length} categories from ${rankingsArray.length} tools`
    );

    return allCategories;
  } catch (error) {
    // #185: a failed list-board read is rethrown, not cached as an empty category list.
    console.error("[Categories] Failed to fetch categories:", error);
    throw error;
  }
}

/**
 * Cached version of getCategoriesWithCounts
 * Categories change only when rankings update (infrequent), so we cache them
 * with 5-minute revalidation to improve TTFB by 50-200ms
 */
export const getCategoriesWithCounts = unstable_cache(
  _getCategoriesWithCounts,
  ["categories-with-counts"],
  {
    revalidate: 300, // Revalidate every 5 minutes
    tags: ["categories"], // Cache tag for manual invalidation if needed
  }
);
