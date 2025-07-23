#!/usr/bin/env npx tsx

import { ToolsRepository } from "./src/lib/json-db/tools-repository.js";

async function testToolsRepository() {
  const toolsRepository = new ToolsRepository();
  console.log("Testing Tools Repository with New Structure\n");

  try {
    // Test 1: getAll()
    console.log("1. Testing getAll()...");
    const allTools = await toolsRepository.getAll();
    console.log(`   ✓ Found ${allTools.length} tools`);
    if (allTools.length !== 30) {
      console.error(`   ✗ Expected 30 tools, got ${allTools.length}`);
    }

    // Test 2: getById()
    console.log("\n2. Testing getById()...");
    const testIds = ["claude-code", "cursor", "github-copilot"];
    for (const id of testIds) {
      const tool = await toolsRepository.getById(id);
      if (tool) {
        console.log(`   ✓ Found tool by ID: ${id} - ${tool.name}`);
      } else {
        console.error(`   ✗ Failed to find tool by ID: ${id}`);
      }
    }

    // Test 3: getBySlug()
    console.log("\n3. Testing getBySlug()...");
    const testSlugs = ["claude-code", "cursor", "github-copilot"];
    for (const slug of testSlugs) {
      const tool = await toolsRepository.getBySlug(slug);
      if (tool) {
        console.log(`   ✓ Found tool by slug: ${slug} - ${tool.name}`);
      } else {
        console.error(`   ✗ Failed to find tool by slug: ${slug}`);
      }
    }

    // Test 4: getByCategory()
    console.log("\n4. Testing getByCategory()...");
    const categories = ["Code Assistant", "IDE", "Code Completion", "Terminal Assistant"];
    for (const category of categories) {
      const tools = await toolsRepository.getByCategory(category);
      console.log(`   ✓ Category "${category}": ${tools.length} tools`);
    }

    // Test 5: Verify data integrity
    console.log("\n5. Testing data integrity...");
    const sampleTool = await toolsRepository.getById("claude-code");
    if (sampleTool) {
      const requiredFields = [
        "id",
        "name",
        "slug",
        "description",
        "features",
        "tags",
        "releaseDate",
        "lastUpdated",
      ];
      const missingFields = requiredFields.filter((field) => !(field in sampleTool));
      if (missingFields.length === 0) {
        console.log("   ✓ All required fields present in tool data");
      } else {
        console.error(`   ✗ Missing fields: ${missingFields.join(", ")}`);
      }
    }

    // Test 6: Check for duplicates
    console.log("\n6. Checking for duplicate IDs...");
    const ids = allTools.map((t) => t.id);
    const uniqueIds = new Set(ids);
    if (ids.length === uniqueIds.size) {
      console.log("   ✓ No duplicate IDs found");
    } else {
      console.error(`   ✗ Found ${ids.length - uniqueIds.size} duplicate IDs`);
    }
  } catch (error) {
    console.error("Error during testing:", error);
  }
}

testToolsRepository();
