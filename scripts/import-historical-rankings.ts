#!/usr/bin/env tsx

/**
 * Import Historical Rankings Script
 *
 * Imports historical ranking JSON files from data/extracted-rankings/
 * into the ranking_versions table in the staging database.
 *
 * Usage: tsx scripts/import-historical-rankings.ts
 */

import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

// Type definitions for the JSON structure
interface RankingEntry {
  tool_id: string; // numeric string like "1", "2", "3"
  tool_name: string;
  position: number;
  score: number;
  tier: string;
  factor_scores: {
    agentic_capability: number;
    innovation: number;
    technical_performance: number;
    developer_adoption: number;
    market_traction: number;
    business_sentiment: number;
    development_velocity: number;
    platform_resilience: number;
  };
  movement: {
    change: number;
    direction: string;
    previous_position: number;
  };
}

interface HistoricalRankingFile {
  period: string; // e.g., "2025-06-01"
  algorithm_version: string;
  is_current: boolean;
  created_at: string;
  rankings: RankingEntry[];
}

interface ToolMapping {
  numericId: string;
  uuid: string;
  slug: string;
  name: string;
}

/**
 * Build mapping of numeric tool IDs to UUIDs from database
 */
async function buildToolMapping(sql: ReturnType<typeof neon>): Promise<Map<string, ToolMapping>> {
  console.log("\n📊 Building tool ID mapping from database...");

  const tools = await sql`
    SELECT id, slug, name, data
    FROM tools
    ORDER BY created_at
  `;

  const mapping = new Map<string, ToolMapping>();

  // Map by tool name for reliable matching
  const toolsByName = new Map<string, typeof tools[0]>();
  for (const tool of tools) {
    toolsByName.set(tool.name.toLowerCase(), tool);
  }

  // Known numeric ID mapping (based on historical data)
  // This maps the numeric IDs used in the JSON files to tool names
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

  // Build the mapping
  for (const [numericId, toolName] of Object.entries(numericToName)) {
    const tool = toolsByName.get(toolName.toLowerCase());
    if (tool) {
      mapping.set(numericId, {
        numericId,
        uuid: tool.id,
        slug: tool.slug,
        name: tool.name,
      });
    } else {
      console.warn(`⚠️  Warning: Tool "${toolName}" (ID: ${numericId}) not found in database`);
    }
  }

  console.log(`✅ Mapped ${mapping.size} tools from numeric IDs to UUIDs`);

  return mapping;
}

/**
 * Transform ranking entry to use UUID instead of numeric ID
 */
function transformRanking(
  ranking: RankingEntry,
  toolMapping: Map<string, ToolMapping>
): RankingEntry | null {
  const mapping = toolMapping.get(ranking.tool_id);

  if (!mapping) {
    console.warn(`⚠️  Skipping tool ${ranking.tool_name} (ID: ${ranking.tool_id}) - no UUID mapping found`);
    return null;
  }

  return {
    ...ranking,
    tool_id: mapping.uuid, // Replace numeric ID with UUID
  };
}

/**
 * Import a single historical ranking file
 */
async function importRankingFile(
  filePath: string,
  sql: ReturnType<typeof neon>,
  toolMapping: Map<string, ToolMapping>
): Promise<void> {
  const fileName = path.basename(filePath);
  console.log(`\n📁 Processing ${fileName}...`);

  // Read and parse JSON file
  const fileContent = fs.readFileSync(filePath, "utf-8");
  const data: HistoricalRankingFile = JSON.parse(fileContent);

  console.log(`   Period: ${data.period}`);
  console.log(`   Algorithm: ${data.algorithm_version}`);
  console.log(`   Rankings count: ${data.rankings.length}`);
  console.log(`   Created at: ${data.created_at}`);

  // Transform rankings to use UUIDs
  const transformedRankings: RankingEntry[] = [];
  let skippedCount = 0;

  for (const ranking of data.rankings) {
    const transformed = transformRanking(ranking, toolMapping);
    if (transformed) {
      transformedRankings.push(transformed);
    } else {
      skippedCount++;
    }
  }

  if (skippedCount > 0) {
    console.log(`   ⚠️  Skipped ${skippedCount} rankings due to missing tool mappings`);
  }

  console.log(`   ✅ Transformed ${transformedRankings.length} rankings`);

  // Generate version string from period (e.g., "2025-06-01" -> "2025-06")
  const version = data.period.substring(0, 7);

  // Generate timestamp if missing
  // Use the period as a basis: YYYY-MM -> use first day of next month at noon UTC
  const createdAt = data.created_at || (() => {
    const [year, month] = data.period.split("-").map(Number);
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    return new Date(nextYear, nextMonth - 1, 1, 12, 0, 0).toISOString();
  })();

  try {
    // Start transaction
    await sql`BEGIN`;

    // Delete existing version if it exists
    await sql`
      DELETE FROM ranking_versions
      WHERE version = ${version}
    `;

    // Insert new ranking version
    const result = await sql`
      INSERT INTO ranking_versions (
        version,
        rankings_snapshot,
        changes_summary,
        tools_affected,
        created_at,
        created_by
      ) VALUES (
        ${version},
        ${JSON.stringify(transformedRankings)},
        ${`Historical data import from ${fileName}`},
        ${transformedRankings.length},
        ${createdAt},
        ${"historical-import"}
      )
      RETURNING id, version
    `;

    // Commit transaction
    await sql`COMMIT`;

    console.log(`   ✅ Imported as version ${result[0].version} (ID: ${result[0].id})`);
    console.log(`   📊 Tools affected: ${transformedRankings.length}`);
  } catch (error) {
    // Rollback on error
    await sql`ROLLBACK`;
    throw error;
  }
}

/**
 * Main import function
 */
async function importHistoricalRankings() {
  const startTime = Date.now();

  console.log("🚀 Historical Rankings Import Script");
  console.log("=====================================");

  // Get staging database URL
  const DATABASE_URL = process.env.DATABASE_URL_STAGING || process.env.DATABASE_URL;

  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL_STAGING or DATABASE_URL environment variable is required");
  }

  console.log(`\n🔗 Connecting to staging database...`);
  console.log(`   Database: ${DATABASE_URL.split("@")[1]?.split("/")[0] || "unknown"}`);

  const sql = neon(DATABASE_URL);

  try {
    // Test connection
    await sql`SELECT NOW()`;
    console.log("✅ Database connection successful");

    // Build tool mapping
    const toolMapping = await buildToolMapping(sql);

    // Get all JSON files from data/extracted-rankings/
    const dataDir = path.join(process.cwd(), "data", "extracted-rankings");
    const files = fs
      .readdirSync(dataDir)
      .filter((f) => f.endsWith(".json"))
      .sort(); // Process in chronological order

    console.log(`\n📂 Found ${files.length} ranking files to import:`);
    files.forEach((f) => console.log(`   - ${f}`));

    // Import each file
    let successCount = 0;
    let errorCount = 0;

    for (const file of files) {
      const filePath = path.join(dataDir, file);
      try {
        await importRankingFile(filePath, sql, toolMapping);
        successCount++;
      } catch (error) {
        console.error(`❌ Error importing ${file}:`, error);
        errorCount++;
      }
    }

    // Summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log("\n" + "=".repeat(50));
    console.log("📊 Import Summary");
    console.log("=".repeat(50));
    console.log(`✅ Successfully imported: ${successCount} files`);
    console.log(`❌ Failed imports: ${errorCount} files`);
    console.log(`⏱️  Total duration: ${duration}s`);

    // Verify imports
    console.log("\n🔍 Verifying imported data...");
    const versions = await sql`
      SELECT version, tools_affected, created_at, created_by
      FROM ranking_versions
      WHERE created_by = 'historical-import'
      ORDER BY version
    `;

    console.log(`\n📋 Imported ranking versions:`);
    versions.forEach((v) => {
      console.log(`   ${v.version}: ${v.tools_affected} tools (${v.created_at})`);
    });

    console.log("\n✨ Historical rankings import completed successfully!");
  } catch (error) {
    console.error("\n❌ Import failed:", error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  importHistoricalRankings()
    .then(() => {
      console.log("\n👋 Done!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n💥 Fatal error:", error);
      process.exit(1);
    });
}

export { importHistoricalRankings };
