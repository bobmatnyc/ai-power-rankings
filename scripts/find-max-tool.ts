#!/usr/bin/env tsx

import { closeDb, getDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { like, or } from "drizzle-orm";

async function findMaxTool() {
  const db = getDb();

  // Search for tools with "Max" or "Anything" in the name
  const result = await db.select().from(tools).where(
    or(
      like(tools.name, '%Max%'),
      like(tools.name, '%Anything%')
    )
  );

  console.log("Found tools:");
  result.forEach(t => {
    console.log(`\nName: ${t.name}`);
    console.log(`Slug: ${t.slug}`);
    console.log(`Category: ${t.category}`);
    console.log(`Status: ${t.status}`);
  });

  await closeDb();
}

findMaxTool();
