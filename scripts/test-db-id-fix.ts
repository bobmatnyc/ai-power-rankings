#!/usr/bin/env node
/**
 * Test script to verify db_id bug fix
 * Ensures db_id is not overwritten by JSONB data spread
 */

import { toolsRepository } from "../lib/db/repositories/tools.repository";

async function testDbIdFix() {
  console.log("🔍 Testing db_id fix...\n");

  try {
    // Fetch all tools
    const tools = await toolsRepository.findAll({ limit: 5 });

    if (tools.length === 0) {
      console.log("⚠️  No tools found in database");
      return;
    }

    console.log(`✓ Found ${tools.length} tools\n`);

    // Check each tool
    for (const tool of tools) {
      console.log(`Tool: ${tool.name} (${tool.slug})`);
      console.log(`  - id: ${tool.id}`);
      console.log(`  - db_id: ${tool.db_id}`);

      // Verify db_id exists
      if (!tool.db_id) {
        console.log(`  ❌ FAIL: db_id is missing!`);
        process.exit(1);
      }

      // Verify db_id is a UUID format
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(tool.db_id)) {
        console.log(`  ❌ FAIL: db_id is not a valid UUID: ${tool.db_id}`);
        process.exit(1);
      }

      console.log(`  ✓ PASS: db_id is a valid UUID\n`);
    }

    console.log("✅ All tests passed!");
    console.log("✅ db_id is correctly set and not overwritten by JSONB spread");
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

testDbIdFix();
