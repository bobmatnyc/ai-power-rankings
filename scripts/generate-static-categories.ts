#!/usr/bin/env tsx
/**
 * Generate Static Categories
 *
 * This script fetches categories from the database and writes them to a static file.
 * Run this script during the build process to update categories without blocking requests.
 *
 * Usage:
 *   npm run generate-categories
 *   or
 *   tsx scripts/generate-static-categories.ts
 */

import { writeFileSync } from "fs";
import { join } from "path";
import { eq } from "drizzle-orm";
import { getDb } from "../lib/db/connection";
import { rankings } from "../lib/db/schema";

interface Category {
  id: string;
  name: string;
  count: number;
}

/**
 * Get category display name from category ID
 */
function getCategoryName(categoryId: string): string {
  return categoryId
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Fetch categories directly from database (without unstable_cache)
 */
async function fetchCategoriesFromDb(): Promise<Category[]> {
  try {
    const db = getDb();
    if (!db) {
      console.warn("[Categories] Database connection not available, returning default");
      return [{ id: "all", name: "All Categories", count: 0 }];
    }

    // Fetch current rankings (marked as is_current = true)
    const currentRankings = await db
      .select()
      .from(rankings)
      .where(eq(rankings.isCurrent, true))
      .limit(1);

    if (!currentRankings[0]?.data) {
      console.warn("[Categories] No current rankings data found");
      return [{ id: "all", name: "All Categories", count: 0 }];
    }

    // Parse the rankings data (JSONB field)
    const rankingsData: any = currentRankings[0].data;
    let rankingsArray: any[] = [];

    // Handle different data structures in JSONB field
    if (Array.isArray(rankingsData)) {
      rankingsArray = rankingsData;
    } else if (rankingsData && typeof rankingsData === "object") {
      if (rankingsData.rankings && Array.isArray(rankingsData.rankings)) {
        rankingsArray = rankingsData.rankings;
      } else if (rankingsData.data && Array.isArray(rankingsData.data)) {
        rankingsArray = rankingsData.data;
      }
    }

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
    console.error("[Categories] Failed to fetch categories:", error);
    // Return minimal fallback on error
    return [{ id: "all", name: "All Categories", count: 0 }];
  }
}

async function generateStaticCategories() {
  console.log("[Generate Categories] Fetching categories from database...");

  try {
    const categories = await fetchCategoriesFromDb();

    console.log(`[Generate Categories] Fetched ${categories.length} categories`);

    const outputPath = join(process.cwd(), "lib/data/static-categories.ts");
    const fileContent = `/**
 * Static Categories Data
 * Generated at build time from database
 *
 * DO NOT EDIT MANUALLY
 * Run 'npm run generate-categories' to update this file
 *
 * Generated: ${new Date().toISOString()}
 */

export interface Category {
  id: string;
  name: string;
  count: number;
}

export const STATIC_CATEGORIES: Category[] = ${JSON.stringify(categories, null, 2)};
`;

    writeFileSync(outputPath, fileContent, "utf-8");
    console.log(`[Generate Categories] ✓ Static categories written to ${outputPath}`);
    console.log("[Generate Categories] Categories:", categories.map(c => `${c.name} (${c.count})`).join(", "));

    process.exit(0);
  } catch (error) {
    console.error("[Generate Categories] ✗ Failed to generate static categories:", error);
    process.exit(1);
  }
}

generateStaticCategories();
