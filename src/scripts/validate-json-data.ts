#!/usr/bin/env tsx
/**
 * Validate JSON Data Script
 * Validates all JSON data files against their schemas
 */

import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import {
  CompanySchema,
  NewsArticleSchema,
  RankingPeriodSchema,
  ToolSchema,
} from "../lib/json-db/schemas";
import { loggers } from "../lib/logger";

const JSON_DATA_DIR = path.join(process.cwd(), "data", "json");

interface ValidationResult {
  file: string;
  valid: boolean;
  errors?: string[];
}

interface ValidationSummary {
  totalFiles: number;
  validFiles: number;
  invalidFiles: number;
  errors: ValidationResult[];
}

async function validateFile(filePath: string, schema: z.ZodSchema): Promise<ValidationResult> {
  const relativePath = path.relative(JSON_DATA_DIR, filePath);

  try {
    const content = await fs.readFile(filePath, "utf-8");
    const data = JSON.parse(content);

    // Handle array vs single object
    if (Array.isArray(data)) {
      for (let i = 0; i < data.length; i++) {
        schema.parse(data[i]);
      }
    } else {
      schema.parse(data);
    }

    return {
      file: relativePath,
      valid: true,
    };
  } catch (error) {
    const errors: string[] = [];

    if (error instanceof z.ZodError) {
      errors.push(...error.errors.map((e) => `${e.path.join(".")}: ${e.message}`));
    } else if (error instanceof SyntaxError) {
      errors.push(`JSON parse error: ${error.message}`);
    } else {
      errors.push(`Unknown error: ${String(error)}`);
    }

    return {
      file: relativePath,
      valid: false,
      errors,
    };
  }
}

async function validateTools(): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  try {
    const toolsFile = path.join(JSON_DATA_DIR, "tools.json");
    const result = await validateFile(toolsFile, z.array(ToolSchema));
    results.push(result);
  } catch (error) {
    loggers.validation.error("Error validating tools", { error });
  }

  return results;
}

async function validateCompanies(): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  try {
    const companiesFile = path.join(JSON_DATA_DIR, "companies.json");
    const result = await validateFile(companiesFile, z.array(CompanySchema));
    results.push(result);
  } catch (error) {
    loggers.validation.error("Error validating companies", { error });
  }

  return results;
}

async function validateNews(): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  try {
    const newsDir = path.join(JSON_DATA_DIR, "news");
    const newsFile = path.join(newsDir, "articles.json");

    if (await fileExists(newsFile)) {
      const result = await validateFile(newsFile, z.array(NewsArticleSchema));
      results.push(result);
    }
  } catch (error) {
    loggers.validation.error("Error validating news", { error });
  }

  return results;
}

async function validateRankings(): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  try {
    const rankingsDir = path.join(JSON_DATA_DIR, "rankings");
    const files = await fs.readdir(rankingsDir);

    for (const file of files) {
      if (file.endsWith(".json") && file !== "current.json") {
        const filePath = path.join(rankingsDir, file);
        const result = await validateFile(filePath, RankingPeriodSchema);
        results.push(result);
      }
    }
  } catch (error) {
    loggers.validation.error("Error validating rankings", { error });
  }

  return results;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function validateAllData(): Promise<ValidationSummary> {
  loggers.validation.info("Starting JSON data validation...");

  const allResults: ValidationResult[] = [];

  // Validate each data type
  allResults.push(...(await validateTools()));
  allResults.push(...(await validateCompanies()));
  allResults.push(...(await validateNews()));
  allResults.push(...(await validateRankings()));

  // Calculate summary
  const summary: ValidationSummary = {
    totalFiles: allResults.length,
    validFiles: allResults.filter((r) => r.valid).length,
    invalidFiles: allResults.filter((r) => !r.valid).length,
    errors: allResults.filter((r) => !r.valid),
  };

  loggers.validation.info("Validation completed", summary);

  return summary;
}

async function checkDataIntegrity(): Promise<void> {
  loggers.validation.info("Checking data integrity...");

  // Load data
  const toolsFile = path.join(JSON_DATA_DIR, "tools.json");
  const companiesFile = path.join(JSON_DATA_DIR, "companies.json");

  const tools = JSON.parse(await fs.readFile(toolsFile, "utf-8"));
  const companies = JSON.parse(await fs.readFile(companiesFile, "utf-8"));

  const companyIds = new Set(companies.map((c: { id: string }) => c.id));
  const toolIds = new Set(tools.map((t: { id: string }) => t.id));

  // Check tool company references
  const orphanedTools = tools.filter(
    (tool: { company_id?: string }) => tool.company_id && !companyIds.has(tool.company_id)
  );

  if (orphanedTools.length > 0) {
    loggers.validation.warn("Found tools with invalid company references", {
      count: orphanedTools.length,
      tools: orphanedTools.map((t: { id: string; name: string; company_id?: string }) => ({
        id: t.id,
        name: t.name,
        company_id: t.company_id,
      })),
    });
  }

  // Check ranking tool references
  const rankingsDir = path.join(JSON_DATA_DIR, "rankings");
  const rankingFiles = await fs.readdir(rankingsDir);

  for (const file of rankingFiles) {
    if (file.endsWith(".json") && file !== "current.json") {
      const filePath = path.join(rankingsDir, file);
      const period = JSON.parse(await fs.readFile(filePath, "utf-8"));

      if (period.rankings) {
        const orphanedRankings = period.rankings.filter(
          (r: { tool_id: string }) => !toolIds.has(r.tool_id)
        );

        if (orphanedRankings.length > 0) {
          loggers.validation.warn(`Found rankings with invalid tool references in ${file}`, {
            count: orphanedRankings.length,
            toolIds: orphanedRankings.map((r: { tool_id: string }) => r.tool_id),
          });
        }
      }
    }
  }
}

// Run if called directly
if (require.main === module) {
  validateAllData()
    .then(async (summary) => {
      console.log("\n📊 Validation Summary:");
      console.log(`   Total files: ${summary.totalFiles}`);
      console.log(`   Valid files: ${summary.validFiles} ✅`);
      console.log(`   Invalid files: ${summary.invalidFiles} ❌`);

      if (summary.errors.length > 0) {
        console.log("\n❌ Validation Errors:");
        for (const error of summary.errors) {
          console.log(`\n   File: ${error.file}`);
          if (error.errors) {
            for (const e of error.errors) {
              console.log(`   - ${e}`);
            }
          }
        }
      }

      // Check data integrity
      await checkDataIntegrity();

      process.exit(summary.invalidFiles > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error("❌ Validation failed:", error);
      process.exit(1);
    });
}

export { validateAllData, checkDataIntegrity };
