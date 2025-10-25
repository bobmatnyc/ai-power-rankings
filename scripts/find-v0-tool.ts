#!/usr/bin/env tsx

import { closeDb, getDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { like, or } from "drizzle-orm";

async function findV0Tool() {
  const db = getDb();

  console.log("🔍 Searching for v0 tool...\n");

  // Search by various criteria
  const possibleMatches = await db
    .select()
    .from(tools)
    .where(
      or(
        like(tools.slug, "%v0%"),
        like(tools.name, "%v0%"),
        like(tools.name, "%Vercel%")
      )
    );

  console.log(`Found ${possibleMatches.length} possible matches:\n`);

  possibleMatches.forEach((tool) => {
    const data = tool.data as Record<string, any>;
    console.log(`Slug: ${tool.slug}`);
    console.log(`Name: ${tool.name}`);
    console.log(`Category: ${tool.category}`);
    console.log(`Company: ${data.company || 'N/A'}`);
    console.log(`Description: ${data.description || 'N/A'}`);
    console.log(`Overview: ${data.overview || 'N/A'}`);
    console.log("-".repeat(80));
  });
}

findV0Tool()
  .catch(console.error)
  .finally(() => closeDb());
