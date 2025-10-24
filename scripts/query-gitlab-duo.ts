#!/usr/bin/env tsx

/**
 * Query GitLab Duo data from database
 * Used to examine existing data before enhancement
 */

import { getDb, closeDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

async function queryGitLabDuo() {
  const db = getDb();
  console.log("🔍 Querying GitLab Duo from database...\n");

  try {
    const result = await db
      .select()
      .from(tools)
      .where(eq(tools.slug, "gitlab-duo"))
      .limit(1);

    if (result.length === 0) {
      console.log("❌ GitLab Duo not found in database");
      return null;
    }

    const tool = result[0];
    console.log("✅ GitLab Duo found!");
    console.log(`\nID: ${tool.id}`);
    console.log(`Slug: ${tool.slug}`);
    console.log(`Name: ${tool.name}`);
    console.log(`Category: ${tool.category}`);
    console.log(`Status: ${tool.status}`);
    console.log(`\nCurrent Score:`, tool.currentScore);
    console.log(`\nData Structure Keys:`, Object.keys(tool.data || {}));
    console.log(`\nFull Data:\n`);
    console.log(JSON.stringify(tool.data, null, 2));

    return tool;
  } catch (error) {
    console.error("❌ Error querying GitLab Duo:", error);
    throw error;
  } finally {
    await closeDb();
  }
}

queryGitLabDuo();
