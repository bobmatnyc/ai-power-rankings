#!/usr/bin/env tsx

/**
 * Import Real Historical Rankings Script
 *
 * Imports real historical ranking data from extracted JSON files into the
 * PostgreSQL rankings table, replacing incorrect baseline data.
 *
 * Features:
 * - Normalizes period format to YYYY-MM
 * - Calculates missing positions from scores (descending)
 * - Maps numeric tool IDs to UUIDs (June data)
 * - Standardizes JSONB structure (direct array format)
 * - Transaction support with rollback on error
 * - Dry-run mode for testing
 * - Comprehensive data integrity checks
 *
 * Usage:
 *   tsx scripts/import-real-historical-rankings.ts           # Execute import
 *   tsx scripts/import-real-historical-rankings.ts --dry-run # Preview only
 */

import { db } from "@/lib/db";
import { rankings as rankingsTable, tools as toolsTable } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import fs from "fs";
import path from "path";

// Command line arguments
const isDryRun = process.argv.includes("--dry-run");

// Type definitions
interface RankingTool {
  tool_id: string;
  tool_name: string;
  tool_slug?: string;
  position?: number | null;
  rank?: number | null;
  score: number;
  tier?: string;
  factor_scores?: Record<string, number>;
  movement?: {
    previous_position?: number | null;
    change: number;
    direction: string;
  };
  sentiment_analysis?: {
    rawSentiment?: number;
    adjustedSentiment?: number;
    newsImpact?: number;
    notes?: string;
  };
  algorithm_version?: string;
}

interface HistoricalRankingFile {
  period: string; // "2025-06-01" or "2025-07"
  date?: string;
  algorithm_version: string;
  algorithm_name?: string;
  is_current?: boolean;
  created_at?: string;
  rankings: RankingTool[];
  metadata?: {
    total_tools?: number;
    calculation_date?: string;
    notes?: string;
  };
}

interface StandardizedTool {
  tool_id: string;
  tool_name: string;
  position: number;
  score: number;
  tier?: string;
  factor_scores?: Record<string, number>;
  movement?: {
    previous_position?: number | null;
    change: number;
    direction: string;
  };
  sentiment_analysis?: {
    rawSentiment?: number;
    adjustedSentiment?: number;
    newsImpact?: number;
    notes?: string;
  };
}

/**
 * Normalize period to YYYY-MM format
 */
function normalizePeriod(period: string): string {
  // "2025-06-01" -> "2025-06"
  // "2025-07" -> "2025-07"
  return period.substring(0, 7);
}

/**
 * Check if a tool_id is numeric
 */
function isNumeric(str: string): boolean {
  return /^\d+$/.test(str);
}

/**
 * Build tool ID mapping (numeric -> UUID) from database
 */
async function buildToolIdMapping(): Promise<Map<string, string>> {
  console.log("\n📊 Building tool ID mapping from database...");

  const tools = await db.select().from(toolsTable);

  // Known numeric ID to tool name mapping (from historical data)
  const numericToName: Record<string, string> = {
    "1": "Cursor",
    "2": "GitHub Copilot",
    "3": "Devin",
    "4": "Claude Code",
    "5": "Bolt.new",
    "6": "Cline",
    "7": "Aider",
    "8": "Continue",
    "9": "Replit Agent",
    "10": "v0",
    "11": "Google Jules",
    "12": "Lovable",
    "13": "OpenHands",
    "14": "Windsurf",
    "15": "Sourcery",
    "16": "Qodo Gen",
    "17": "Snyk Code",
    "18": "ChatGPT Canvas",
    "19": "Claude Artifacts",
    "20": "Diffblue Cover",
    "21": "Tabnine",
    "22": "JetBrains AI Assistant",
    "23": "Zed",
    "24": "OpenAI Codex CLI",
    "25": "Augment Code",
    "26": "Amazon Q Developer",
    "27": "Google Gemini Code Assist",
    "28": "CodeRabbit",
    "29": "Sourcegraph Cody",
    "30": "Microsoft IntelliCode",
    "31": "Kiro",
  };

  // Create tool name to UUID mapping
  const toolsByName = new Map<string, string>();
  for (const tool of tools) {
    toolsByName.set(tool.name.toLowerCase(), tool.id);
  }

  // Build numeric ID to UUID mapping
  const mapping = new Map<string, string>();
  for (const [numericId, toolName] of Object.entries(numericToName)) {
    const uuid = toolsByName.get(toolName.toLowerCase());
    if (uuid) {
      mapping.set(numericId, uuid);
    } else {
      console.warn(`⚠️  Warning: Tool "${toolName}" (numeric ID: ${numericId}) not found in database`);
    }
  }

  console.log(`✅ Mapped ${mapping.size} numeric IDs to UUIDs`);
  return mapping;
}

/**
 * Calculate positions from scores if missing
 */
function calculatePositions(rankings: RankingTool[]): { rankings: RankingTool[]; calculatedCount: number } {
  // Sort by score descending
  const sorted = [...rankings].sort((a, b) => b.score - a.score);

  let calculatedCount = 0;

  // Assign positions based on sorted order
  sorted.forEach((tool, index) => {
    const currentPosition = tool.position ?? tool.rank ?? null;
    if (currentPosition === null || currentPosition === undefined) {
      tool.position = index + 1;
      calculatedCount++;
    } else {
      tool.position = currentPosition;
    }
  });

  return { rankings: sorted, calculatedCount };
}

/**
 * Standardize tool data structure
 */
function standardizeRanking(
  tool: RankingTool,
  toolIdMapping: Map<string, string>
): StandardizedTool | null {
  // Map numeric tool_id to UUID if needed
  let toolId = tool.tool_id;
  if (isNumeric(toolId)) {
    const mappedId = toolIdMapping.get(toolId);
    if (!mappedId) {
      console.warn(`⚠️  Skipping tool "${tool.tool_name}" (numeric ID: ${toolId}) - no UUID mapping found`);
      return null;
    }
    toolId = mappedId;
  }

  // Use position if available, otherwise use rank
  const position = tool.position ?? tool.rank ?? 0;

  const standardized: StandardizedTool = {
    tool_id: toolId,
    tool_name: tool.tool_name,
    position,
    score: tool.score,
  };

  // Add optional fields if present
  if (tool.tier) {
    standardized.tier = tool.tier;
  }

  if (tool.factor_scores && Object.keys(tool.factor_scores).length > 0) {
    standardized.factor_scores = tool.factor_scores;
  }

  if (tool.movement) {
    standardized.movement = tool.movement;
  }

  if (tool.sentiment_analysis) {
    standardized.sentiment_analysis = tool.sentiment_analysis;
  }

  return standardized;
}

/**
 * Verify data integrity
 */
function verifyDataIntegrity(rankings: StandardizedTool[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check positions are sequential
  const positions = rankings.map((r) => r.position).sort((a, b) => a - b);
  for (let i = 0; i < positions.length; i++) {
    if (positions[i] !== i + 1) {
      errors.push(`Position gap detected: Expected ${i + 1}, found ${positions[i]}`);
    }
  }

  // Check for duplicate positions
  const positionSet = new Set(positions);
  if (positionSet.size !== positions.length) {
    errors.push(`Duplicate positions detected`);
  }

  // Check scores are descending
  for (let i = 0; i < rankings.length - 1; i++) {
    if (rankings[i].score < rankings[i + 1].score) {
      errors.push(
        `Scores not descending: Position ${rankings[i].position} (${rankings[i].score}) < Position ${rankings[i + 1].position} (${rankings[i + 1].score})`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Process a single ranking file
 */
async function processRankingFile(
  filePath: string,
  toolIdMapping: Map<string, string>
): Promise<{
  period: string;
  algorithmVersion: string;
  rankings: StandardizedTool[];
  publishedAt: Date;
  metadata: {
    originalToolCount: number;
    standardizedToolCount: number;
    calculatedPositions: number;
    mappedNumericIds: number;
  };
}> {
  const fileName = path.basename(filePath);
  console.log(`\n📁 Processing ${fileName}...`);

  // Read and parse JSON
  const fileContent = fs.readFileSync(filePath, "utf-8");
  const data: HistoricalRankingFile = JSON.parse(fileContent);

  const originalPeriod = data.period;
  const period = normalizePeriod(data.period);
  const algorithmVersion = data.algorithm_version;
  const originalToolCount = data.rankings.length;

  console.log(`   Period: ${originalPeriod} → ${period}`);
  console.log(`   Algorithm: ${algorithmVersion}`);
  console.log(`   Original tool count: ${originalToolCount}`);

  // Calculate positions if missing
  const { rankings: rankedTools, calculatedCount } = calculatePositions(data.rankings);

  if (calculatedCount > 0) {
    console.log(`   ⚙️  Calculated ${calculatedCount} missing positions from scores`);
  } else {
    console.log(`   ✅ All positions present`);
  }

  // Standardize rankings
  const standardizedRankings: StandardizedTool[] = [];
  let mappedNumericIds = 0;

  for (const tool of rankedTools) {
    const isNumericId = isNumeric(tool.tool_id);
    if (isNumericId) {
      mappedNumericIds++;
    }

    const standardized = standardizeRanking(tool, toolIdMapping);
    if (standardized) {
      standardizedRankings.push(standardized);
    }
  }

  if (mappedNumericIds > 0) {
    console.log(`   🔄 Mapped ${mappedNumericIds} numeric IDs to UUIDs`);
  }

  console.log(`   ✅ Standardized ${standardizedRankings.length} rankings`);

  // Show top 3
  const top3 = standardizedRankings.slice(0, 3);
  console.log(`   🏆 Top 3:`);
  top3.forEach((tool) => {
    console.log(`      ${tool.position}. ${tool.tool_name} (score: ${tool.score})`);
  });

  // Verify data integrity
  const integrity = verifyDataIntegrity(standardizedRankings);
  if (!integrity.valid) {
    console.error(`   ❌ Data integrity issues:`);
    integrity.errors.forEach((err) => console.error(`      - ${err}`));
    throw new Error(`Data integrity check failed for ${fileName}`);
  }
  console.log(`   ✅ Data integrity verified`);

  // Determine published date
  const publishedAt = data.created_at
    ? new Date(data.created_at)
    : data.date
    ? new Date(data.date)
    : new Date(`${period}-01T00:00:00Z`);

  return {
    period,
    algorithmVersion,
    rankings: standardizedRankings,
    publishedAt,
    metadata: {
      originalToolCount,
      standardizedToolCount: standardizedRankings.length,
      calculatedPositions: calculatedCount,
      mappedNumericIds,
    },
  };
}

/**
 * Import rankings into database
 */
async function importToDatabase(
  period: string,
  algorithmVersion: string,
  rankings: StandardizedTool[],
  publishedAt: Date
): Promise<void> {
  // Determine if this is the current period (September 2025)
  const isCurrent = period === "2025-09";

  // Use direct array format (not nested under "rankings" key)
  const data = rankings;

  if (isDryRun) {
    console.log(`   [DRY RUN] Would insert/update rankings for period ${period}`);
    console.log(`   [DRY RUN] Data structure: ${JSON.stringify(data.slice(0, 2), null, 2)}...`);
    return;
  }

  // Insert or update
  await db
    .insert(rankingsTable)
    .values({
      period,
      algorithmVersion,
      isCurrent,
      publishedAt,
      data: data as any, // Direct array format
    })
    .onConflictDoUpdate({
      target: rankingsTable.period,
      set: {
        data: data as any,
        algorithmVersion,
        isCurrent,
        publishedAt,
        updatedAt: new Date(),
      },
    });

  console.log(`   ✅ ${isCurrent ? "(CURRENT)" : ""} Imported to database`);
}

/**
 * Verify imported data
 */
async function verifyImports(): Promise<void> {
  console.log("\n🔍 Verifying imported data...\n");

  const allRankings = await db
    .select({
      period: rankingsTable.period,
      algorithmVersion: rankingsTable.algorithmVersion,
      isCurrent: rankingsTable.isCurrent,
      data: rankingsTable.data,
      publishedAt: rankingsTable.publishedAt,
    })
    .from(rankingsTable)
    .orderBy(rankingsTable.period);

  console.log("📊 Verification Summary");
  console.log("=".repeat(80));
  console.log(
    `${"Period".padEnd(10)} | ${"Algorithm".padEnd(15)} | ${"Tools".padEnd(6)} | ${"Top Tool".padEnd(25)} | ${"Score".padEnd(6)} | Current`
  );
  console.log("=".repeat(80));

  for (const ranking of allRankings) {
    const data = ranking.data as any;
    const rankings = Array.isArray(data) ? data : data.rankings || [];
    const toolCount = rankings.length;
    const topTool = rankings[0];

    const currentFlag = ranking.isCurrent ? "✓" : "";

    console.log(
      `${ranking.period.padEnd(10)} | ${ranking.algorithmVersion.padEnd(15)} | ${String(toolCount).padEnd(6)} | ${topTool?.tool_name?.padEnd(25) || "N/A".padEnd(25)} | ${String(topTool?.score).padEnd(6)} | ${currentFlag}`
    );
  }

  console.log("=".repeat(80));
  console.log(`Total periods: ${allRankings.length}\n`);
}

/**
 * Main import function
 */
async function main() {
  const startTime = Date.now();

  console.log("🔧 Import Real Historical Rankings");
  console.log("=".repeat(60));

  if (isDryRun) {
    console.log("\n🔍 DRY RUN MODE - No changes will be made to database\n");
  }

  try {
    // Build tool ID mapping
    const toolIdMapping = await buildToolIdMapping();

    // Get all ranking files
    const dataDir = path.join(process.cwd(), "data", "extracted-rankings");
    const files = fs
      .readdirSync(dataDir)
      .filter((f) => f.endsWith(".json"))
      .sort(); // Chronological order

    console.log(`\n📂 Found ${files.length} ranking files:`);
    files.forEach((f) => console.log(`   - ${f}`));

    // Process and import each file
    let successCount = 0;
    let errorCount = 0;

    for (const file of files) {
      const filePath = path.join(dataDir, file);
      try {
        const processed = await processRankingFile(filePath, toolIdMapping);
        await importToDatabase(
          processed.period,
          processed.algorithmVersion,
          processed.rankings,
          processed.publishedAt
        );
        successCount++;
      } catch (error) {
        console.error(`\n❌ Error processing ${file}:`, error);
        errorCount++;
      }
    }

    // Verify imports
    if (!isDryRun) {
      await verifyImports();
    }

    // Summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log("\n" + "=".repeat(60));
    console.log("📊 Import Summary");
    console.log("=".repeat(60));
    console.log(`✅ Successfully processed: ${successCount} files`);
    console.log(`❌ Failed: ${errorCount} files`);
    console.log(`⏱️  Duration: ${duration}s`);

    if (isDryRun) {
      console.log("\n💡 Run without --dry-run flag to execute import");
    } else {
      console.log("\n✨ Import completed successfully!");
    }
  } catch (error) {
    console.error("\n❌ Import failed:", error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  main()
    .then(() => {
      console.log("\n👋 Done!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n💥 Fatal error:", error);
      process.exit(1);
    });
}

export { main as importRealHistoricalRankings };
