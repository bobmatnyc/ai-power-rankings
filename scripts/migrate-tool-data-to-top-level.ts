#!/usr/bin/env tsx

/**
 * Migration Script: Extract Tool Data from Nested JSONB to Top-Level Fields
 *
 * Purpose: Extract tool metadata from nested `data.info` JSONB structure
 * to top-level fields for better queryability and application compatibility.
 *
 * Context: Research found 42 tools have rich data in nested JSONB but missing
 * top-level fields. The application expects top-level fields for display.
 *
 * Usage:
 *   npm run migrate-tool-data              # Dry run (preview changes)
 *   npm run migrate-tool-data -- --execute # Apply changes
 *   npm run migrate-tool-data -- --execute --verbose # With detailed logging
 */

import { closeDb, getDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// ============= Types =============

interface ToolDataStructure {
  id: string;
  slug?: string;
  name?: string;
  description?: string;
  tagline?: string;
  logo_url?: string;
  website_url?: string;
  github_repo?: string;
  pricing_model?: string;
  info?: {
    description?: string;
    tagline?: string;
    logo_url?: string;
    website_url?: string;
    github_repo?: string;
    pricing_model?: string;
    website?: string;
    summary?: string;
    product?: {
      description?: string;
      tagline?: string;
    };
    metadata?: {
      logo_url?: string;
      image_url?: string;
    };
    links?: {
      website?: string;
      github?: string;
    };
    pricing?: {
      model?: string;
      pricing_model?: string;
    };
    business?: {
      pricing_model?: string;
    };
  };
  [key: string]: any;
}

interface ExtractionResult {
  toolId: string;
  slug: string;
  name: string;
  fieldsExtracted: string[];
  changes: Record<string, { from: any; to: any }>;
}

interface MigrationStats {
  totalTools: number;
  toolsWithNestedData: number;
  toolsUpdated: number;
  fieldsExtracted: {
    description: number;
    tagline: number;
    logo_url: number;
    website_url: number;
    github_repo: number;
    pricing_model: number;
  };
  errors: Array<{ toolId: string; error: string }>;
}

// ============= Configuration =============

const FIELD_MAPPINGS = [
  {
    topLevel: "description",
    paths: [
      "info.product.description",
      "info.description",
      "info.summary",
    ],
  },
  {
    topLevel: "tagline",
    paths: ["info.product.tagline", "info.tagline"],
  },
  {
    topLevel: "logo_url",
    paths: ["info.metadata.logo_url", "info.metadata.image_url", "info.logo_url"],
  },
  {
    topLevel: "website_url",
    paths: ["info.links.website", "info.website_url", "info.website"],
  },
  {
    topLevel: "github_repo",
    paths: ["info.links.github", "info.github_repo"],
  },
  {
    topLevel: "pricing_model",
    paths: [
      "info.pricing.model",
      "info.pricing.pricing_model",
      "info.business.pricing_model",
      "info.pricing_model",
    ],
  },
];

// ============= Helper Functions =============

/**
 * Extract value from nested object path
 */
function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((curr, key) => curr?.[key], obj);
}

/**
 * Check if a value is meaningful (not empty/null/undefined)
 */
function isMeaningfulValue(value: any): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return true;
  if (typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return false;
}

/**
 * Extract fields from nested JSONB data to top-level
 */
function extractFieldsFromNestedData(
  toolData: ToolDataStructure,
  skipExisting = true
): { updatedData: ToolDataStructure; fieldsExtracted: string[] } {
  const updatedData = { ...toolData };
  const fieldsExtracted: string[] = [];

  for (const mapping of FIELD_MAPPINGS) {
    const topLevelField = mapping.topLevel;
    const currentValue = toolData[topLevelField];

    // Skip if top-level field already has meaningful data
    if (skipExisting && isMeaningfulValue(currentValue)) {
      continue;
    }

    // Try each path until we find a meaningful value
    for (const path of mapping.paths) {
      const extractedValue = getNestedValue(toolData, path);

      if (isMeaningfulValue(extractedValue)) {
        updatedData[topLevelField] = extractedValue;
        fieldsExtracted.push(topLevelField);
        break; // Stop after first successful extraction
      }
    }
  }

  return { updatedData, fieldsExtracted };
}

/**
 * Analyze what would be extracted from a tool
 */
function analyzeToolExtraction(
  toolData: ToolDataStructure,
  dbSlug?: string,
  dbName?: string
): ExtractionResult {
  const { updatedData, fieldsExtracted } = extractFieldsFromNestedData(toolData);

  const changes: Record<string, { from: any; to: any }> = {};
  for (const field of fieldsExtracted) {
    changes[field] = {
      from: toolData[field] || null,
      to: updatedData[field],
    };
  }

  return {
    toolId: toolData.id,
    slug: dbSlug || toolData.slug || "unknown",
    name: dbName || toolData.name || "unknown",
    fieldsExtracted,
    changes,
  };
}

/**
 * Update tool in database with extracted fields
 */
async function updateToolWithExtractedFields(
  toolDbId: string,
  toolData: ToolDataStructure
): Promise<{ success: boolean; fieldsExtracted: string[]; error?: string }> {
  try {
    const { updatedData, fieldsExtracted } = extractFieldsFromNestedData(toolData);

    if (fieldsExtracted.length === 0) {
      return { success: true, fieldsExtracted: [] };
    }

    const db = getDb();
    if (!db) throw new Error("Database not connected");

    // Update the tool's data JSONB with extracted fields
    await db
      .update(tools)
      .set({
        data: updatedData,
        updatedAt: new Date(),
      })
      .where(eq(tools.id, toolDbId));

    return { success: true, fieldsExtracted };
  } catch (error) {
    return {
      success: false,
      fieldsExtracted: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============= Main Migration Logic =============

/**
 * Run migration in dry-run mode (preview changes)
 */
async function runDryRun(verbose = false): Promise<MigrationStats> {
  console.log("🔍 Running dry-run analysis...\n");

  const db = getDb();
  if (!db) throw new Error("Database not connected");

  const allTools = await db.select().from(tools);

  const stats: MigrationStats = {
    totalTools: allTools.length,
    toolsWithNestedData: 0,
    toolsUpdated: 0,
    fieldsExtracted: {
      description: 0,
      tagline: 0,
      logo_url: 0,
      website_url: 0,
      github_repo: 0,
      pricing_model: 0,
    },
    errors: [],
  };

  const extractionResults: ExtractionResult[] = [];

  for (const tool of allTools) {
    const toolData = tool.data as ToolDataStructure;

    // Check if tool has nested info data
    if (toolData.info && Object.keys(toolData.info).length > 0) {
      stats.toolsWithNestedData++;

      const result = analyzeToolExtraction(toolData, tool.slug, tool.name);

      if (result.fieldsExtracted.length > 0) {
        stats.toolsUpdated++;
        extractionResults.push(result);

        // Count field extractions
        for (const field of result.fieldsExtracted) {
          if (field in stats.fieldsExtracted) {
            stats.fieldsExtracted[field as keyof typeof stats.fieldsExtracted]++;
          }
        }
      }
    }
  }

  // Display results
  console.log("📊 Dry-Run Statistics:");
  console.log(`   Total tools: ${stats.totalTools}`);
  console.log(`   Tools with nested data: ${stats.toolsWithNestedData}`);
  console.log(`   Tools that would be updated: ${stats.toolsUpdated}`);
  console.log("\n📈 Fields to be extracted:");
  for (const [field, count] of Object.entries(stats.fieldsExtracted)) {
    if (count > 0) {
      console.log(`   ${field}: ${count} tools`);
    }
  }

  if (verbose && extractionResults.length > 0) {
    console.log("\n\n📝 Detailed Changes Preview:\n");
    for (const result of extractionResults) {
      console.log(`\n═══ ${result.name} (${result.slug}) ═══`);
      console.log(`Tool ID: ${result.toolId}`);
      console.log(`Fields to extract: ${result.fieldsExtracted.join(", ")}`);

      for (const [field, change] of Object.entries(result.changes)) {
        console.log(`\n  ${field}:`);
        console.log(`    FROM: ${JSON.stringify(change.from)}`);
        console.log(`    TO:   ${JSON.stringify(change.to).substring(0, 100)}${JSON.stringify(change.to).length > 100 ? "..." : ""}`);
      }
    }
  }

  return stats;
}

/**
 * Execute migration (apply changes to database)
 */
async function executeMigration(verbose = false): Promise<MigrationStats> {
  console.log("⚙️  Executing migration...\n");

  const db = getDb();
  if (!db) throw new Error("Database not connected");

  const allTools = await db.select().from(tools);

  const stats: MigrationStats = {
    totalTools: allTools.length,
    toolsWithNestedData: 0,
    toolsUpdated: 0,
    fieldsExtracted: {
      description: 0,
      tagline: 0,
      logo_url: 0,
      website_url: 0,
      github_repo: 0,
      pricing_model: 0,
    },
    errors: [],
  };

  let processedCount = 0;

  for (const tool of allTools) {
    const toolData = tool.data as ToolDataStructure;
    processedCount++;

    if (verbose && processedCount % 10 === 0) {
      console.log(`   Processing: ${processedCount}/${allTools.length}...`);
    }

    // Check if tool has nested info data
    if (!toolData.info || Object.keys(toolData.info).length === 0) {
      continue;
    }

    stats.toolsWithNestedData++;

    // Analyze what would be extracted
    const analysis = analyzeToolExtraction(toolData);
    if (analysis.fieldsExtracted.length === 0) {
      continue;
    }

    // Update the tool
    const result = await updateToolWithExtractedFields(tool.id, toolData);

    if (result.success) {
      stats.toolsUpdated++;

      // Count field extractions
      for (const field of result.fieldsExtracted) {
        if (field in stats.fieldsExtracted) {
          stats.fieldsExtracted[field as keyof typeof stats.fieldsExtracted]++;
        }
      }

      if (verbose) {
        console.log(`   ✓ Updated ${tool.name} (${result.fieldsExtracted.join(", ")})`);
      }
    } else {
      stats.errors.push({
        toolId: toolData.id,
        error: result.error || "Unknown error",
      });
      console.error(`   ✗ Failed to update ${tool.name}: ${result.error}`);
    }
  }

  // Display results
  console.log("\n✅ Migration completed!");
  console.log("\n📊 Final Statistics:");
  console.log(`   Total tools: ${stats.totalTools}`);
  console.log(`   Tools with nested data: ${stats.toolsWithNestedData}`);
  console.log(`   Tools updated: ${stats.toolsUpdated}`);
  console.log(`   Errors: ${stats.errors.length}`);
  console.log("\n📈 Fields extracted:");
  for (const [field, count] of Object.entries(stats.fieldsExtracted)) {
    if (count > 0) {
      console.log(`   ${field}: ${count} tools`);
    }
  }

  if (stats.errors.length > 0) {
    console.log("\n⚠️  Errors encountered:");
    for (const error of stats.errors) {
      console.log(`   Tool ${error.toolId}: ${error.error}`);
    }
  }

  return stats;
}

/**
 * Verify migration results
 */
async function verifyMigration(): Promise<void> {
  console.log("\n🔍 Verifying migration results...\n");

  const db = getDb();
  if (!db) throw new Error("Database not connected");

  const allTools = await db.select().from(tools);

  let toolsWithMissingFields = 0;
  const missingFieldsReport: Record<string, number> = {
    description: 0,
    tagline: 0,
    logo_url: 0,
    website_url: 0,
    github_repo: 0,
    pricing_model: 0,
  };

  for (const tool of allTools) {
    const toolData = tool.data as ToolDataStructure;
    let hasMissingFields = false;

    for (const field of Object.keys(missingFieldsReport)) {
      if (!isMeaningfulValue(toolData[field])) {
        missingFieldsReport[field]++;
        hasMissingFields = true;
      }
    }

    if (hasMissingFields) {
      toolsWithMissingFields++;
    }
  }

  console.log("📊 Verification Results:");
  console.log(`   Total tools: ${allTools.length}`);
  console.log(`   Tools with missing fields: ${toolsWithMissingFields}`);
  console.log("\n📉 Still missing by field:");
  for (const [field, count] of Object.entries(missingFieldsReport)) {
    console.log(`   ${field}: ${count} tools`);
  }

  if (toolsWithMissingFields === 0) {
    console.log("\n✅ All tools have complete field data!");
  }
}

// ============= CLI Entry Point =============

async function main() {
  const args = process.argv.slice(2);
  const execute = args.includes("--execute") || args.includes("-e");
  const verbose = args.includes("--verbose") || args.includes("-v");
  const verify = args.includes("--verify");

  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║  Tool Data Migration: JSONB to Top-Level Fields           ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  try {
    if (verify) {
      await verifyMigration();
    } else if (execute) {
      console.log("⚠️  EXECUTING MIGRATION - Changes will be applied to the database\n");
      await executeMigration(verbose);
      await verifyMigration();
    } else {
      console.log("📋 DRY-RUN MODE - No changes will be made to the database");
      console.log("   Use --execute flag to apply changes\n");
      await runDryRun(verbose);
      console.log("\n\n💡 To apply these changes, run:");
      console.log("   tsx scripts/migrate-tool-data-to-top-level.ts --execute");
    }
  } catch (error) {
    console.error("\n❌ Migration failed:");
    console.error(error);
    process.exit(1);
  } finally {
    await closeDb();
  }
}

// Run if called directly
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export {
  analyzeToolExtraction,
  executeMigration,
  extractFieldsFromNestedData,
  runDryRun,
  verifyMigration,
};
