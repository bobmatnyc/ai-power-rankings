#!/usr/bin/env tsx
/**
 * Data-Driven Tool Content Updater
 *
 * Usage: npx tsx scripts/update-tools.ts --file data/tool-updates/phase4-9-tools.json
 *
 * This script reads tool data from JSON files and updates the database.
 * Replaces 48+ individual update scripts with a single parametrized approach.
 */

import { getDb } from '../lib/db/connection';
import { tools } from '../lib/db/schema';
import { eq } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

interface ToolUpdateData {
  slug: string;
  data: any;
}

interface ToolUpdateFile {
  phase: string;
  description: string;
  tools: ToolUpdateData[];
}

async function updateTools(filePath: string) {
  const db = getDb();
  if (db === null) {
    console.log('❌ No database connection');
    process.exit(1);
  }

  try {
    // Read and parse JSON file
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.join(process.cwd(), filePath);

    if (!fs.existsSync(absolutePath)) {
      console.error(`❌ File not found: ${absolutePath}`);
      process.exit(1);
    }

    const fileContent = fs.readFileSync(absolutePath, 'utf-8');
    const updateData: ToolUpdateFile = JSON.parse(fileContent);

    console.log(`\n🔄 ${updateData.phase}: ${updateData.description}`);
    console.log(`📦 Updating ${updateData.tools.length} tool(s)...\n`);

    let successCount = 0;
    let errorCount = 0;

    // Update each tool
    for (const toolUpdate of updateData.tools) {
      try {
        await db
          .update(tools)
          .set({
            data: toolUpdate.data,
            updatedAt: new Date()
          })
          .where(eq(tools.slug, toolUpdate.slug));

        console.log(`✅ ${toolUpdate.slug}: Updated successfully`);
        successCount++;
      } catch (error) {
        console.error(`❌ ${toolUpdate.slug}: Update failed -`, error);
        errorCount++;
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📦 Total: ${updateData.tools.length}`);

    if (errorCount > 0) {
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Error updating tools:', error);
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const fileIndex = args.indexOf('--file');

if (fileIndex === -1 || fileIndex === args.length - 1) {
  console.error('Usage: npx tsx scripts/update-tools.ts --file <path-to-json>');
  console.error('Example: npx tsx scripts/update-tools.ts --file data/tool-updates/phase4-9-tools.json');
  process.exit(1);
}

const filePath = args[fileIndex + 1];
updateTools(filePath);
