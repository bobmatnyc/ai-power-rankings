#!/usr/bin/env npx tsx

import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import fs from "fs-extra";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function validateAllTools() {
  console.log("Validating all tool files...\n");

  const individualDir = path.join(__dirname, "data/json/tools/individual");
  const files = await fs.readdir(individualDir);
  const toolFiles = files.filter((f) => f.endsWith(".json"));

  console.log(`Found ${toolFiles.length} tool files\n`);

  let validCount = 0;
  let invalidCount = 0;
  const issues: Array<{ file: string; error: string }> = [];

  for (const file of toolFiles) {
    const filepath = path.join(individualDir, file);

    try {
      const content = await fs.readFile(filepath, "utf-8");
      const tool = JSON.parse(content);

      // Check required fields
      const requiredFields = [
        "id",
        "slug",
        "name",
        "category",
        "status",
        "info",
        "created_at",
        "updated_at",
      ];
      const missingFields = requiredFields.filter((field) => !(field in tool));

      if (missingFields.length > 0) {
        issues.push({
          file,
          error: `Missing required fields: ${missingFields.join(", ")}`,
        });
        invalidCount++;
      } else {
        // Check info object
        const requiredInfoFields = ["summary", "description", "website", "features"];
        const missingInfoFields = requiredInfoFields.filter((field) => !(field in tool.info));

        if (missingInfoFields.length > 0) {
          issues.push({
            file,
            error: `Missing required info fields: ${missingInfoFields.join(", ")}`,
          });
          invalidCount++;
        } else {
          validCount++;
        }
      }
    } catch (error) {
      issues.push({
        file,
        error: `Failed to parse JSON: ${error}`,
      });
      invalidCount++;
    }
  }

  console.log(`✅ Valid tools: ${validCount}`);
  console.log(`❌ Invalid tools: ${invalidCount}`);

  if (issues.length > 0) {
    console.log("\nIssues found:");
    for (const issue of issues) {
      console.log(`\n  File: ${issue.file}`);
      console.log(`  Error: ${issue.error}`);
    }
  }
}

validateAllTools();
