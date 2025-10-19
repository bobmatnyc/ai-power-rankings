#!/usr/bin/env tsx

import { closeDb, getDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

async function getAnythingMaxData() {
  const db = getDb();

  const result = await db.select().from(tools).where(eq(tools.slug, 'anything-max'));

  if (result.length === 0) {
    console.log("❌ Anything Max not found");
    await closeDb();
    return;
  }

  const tool = result[0];
  console.log("\nAnything Max Current Data:");
  console.log("=".repeat(80));
  console.log(`Name: ${tool.name}`);
  console.log(`Slug: ${tool.slug}`);
  console.log(`Category: ${tool.category}`);
  console.log(`Status: ${tool.status}`);
  console.log(`\nData Object:`);
  console.log(JSON.stringify(tool.data, null, 2));

  await closeDb();
}

getAnythingMaxData();
