#!/usr/bin/env tsx
/**
 * Seed Script: Populate database with initial tools data
 */

import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { getDb } from "../src/lib/db/connection";
import { rankings, tools } from "../src/lib/db/schema";

const TOOLS_FILE = path.join(process.cwd(), "src", "data", "seed", "tools.json");

async function seedDatabase() {
  console.log("🚀 Starting database seed...");

  try {
    const db = await getDb();

    // Load tools data
    const toolsData = JSON.parse(fs.readFileSync(TOOLS_FILE, "utf-8"));
    console.log(`📦 Found ${toolsData.length} tools to seed`);

    // Create a mapping of tool IDs to UUIDs
    const toolIdMap = new Map<string, string>();

    // Insert tools
    for (const tool of toolsData) {
      const toolUuid = randomUUID();
      toolIdMap.set(tool.id, toolUuid);

      console.log(`  Adding: ${tool.name}`);

      // Store the original ID in the data field for reference
      const toolDataWithOriginalId = { ...tool, original_id: tool.id };

      await db
        .insert(tools)
        .values({
          id: toolUuid,
          slug: tool.slug,
          name: tool.name,
          category: tool.category,
          status: tool.status || "active",
          data: toolDataWithOriginalId, // Store full data in JSONB with original_id
        })
        .onConflictDoUpdate({
          target: tools.slug, // Use slug for conflict resolution since it's unique
          set: {
            name: tool.name,
            category: tool.category,
            status: tool.status || "active",
            data: toolDataWithOriginalId,
            updatedAt: new Date(),
          },
        });
    }

    console.log("✅ Tools seeded successfully!");

    // Create initial rankings
    console.log("\n📊 Creating initial rankings...");

    const rankingsData = {
      rankings: [
        {
          tool_id: toolIdMap.get("cursor"),
          tool_slug: "cursor",
          position: 1,
          score: 95,
          tier: "S",
          factor_scores: {
            agentic_capability: 90,
            innovation: 95,
            developer_adoption: 85,
            enterprise_readiness: 75,
          },
        },
        {
          tool_id: toolIdMap.get("windsurf"),
          tool_slug: "windsurf",
          position: 2,
          score: 92,
          tier: "S",
          factor_scores: {
            agentic_capability: 95,
            innovation: 90,
            developer_adoption: 70,
            enterprise_readiness: 65,
          },
        },
        {
          tool_id: toolIdMap.get("github-copilot"),
          tool_slug: "github-copilot",
          position: 3,
          score: 88,
          tier: "A",
          factor_scores: {
            agentic_capability: 75,
            innovation: 80,
            developer_adoption: 95,
            enterprise_readiness: 90,
          },
        },
        {
          tool_id: toolIdMap.get("claude-dev"),
          tool_slug: "claude-dev",
          position: 4,
          score: 85,
          tier: "A",
          factor_scores: {
            agentic_capability: 88,
            innovation: 85,
            developer_adoption: 65,
            enterprise_readiness: 55,
          },
        },
        {
          tool_id: toolIdMap.get("aider"),
          tool_slug: "aider",
          position: 5,
          score: 82,
          tier: "A",
          factor_scores: {
            agentic_capability: 85,
            innovation: 78,
            developer_adoption: 60,
            enterprise_readiness: 50,
          },
        },
      ],
    };

    // Insert rankings
    const currentPeriod = new Date().toISOString().slice(0, 7); // YYYY-MM format
    const rankingsUuid = randomUUID();

    await db
      .insert(rankings)
      .values({
        id: rankingsUuid,
        period: currentPeriod,
        algorithmVersion: "v7.1",
        isCurrent: true,
        data: rankingsData,
      })
      .onConflictDoUpdate({
        target: rankings.period, // Use period for conflict resolution
        set: {
          data: rankingsData,
          updatedAt: new Date(),
        },
      });

    console.log("✅ Rankings created successfully!");

    console.log("\n🎉 Database seeding complete!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
}

seedDatabase();
