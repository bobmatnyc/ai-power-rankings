#!/usr/bin/env tsx

import { closeDb, getDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";

async function checkTools() {
  const db = getDb();

  const slugs = ['greptile', 'graphite', 'gitlab-duo'];
  const result = await db.select().from(tools).where(inArray(tools.slug, slugs));

  for (const tool of result) {
    console.log("\n" + "=".repeat(80));
    console.log(`TOOL: ${tool.name}`);
    console.log("=".repeat(80));
    console.log(`Slug: ${tool.slug}`);
    console.log(`Category: ${tool.category}`);
    console.log(`\nData:`);
    console.log(JSON.stringify(tool.data, null, 2));
  }

  await closeDb();
}

checkTools();
