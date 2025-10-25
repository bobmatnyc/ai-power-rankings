#!/usr/bin/env tsx

import { getDb, closeDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const db = getDb();
  const [tool] = await db.select().from(tools).where(eq(tools.slug, "aider")).limit(1);

  if (!tool) {
    console.log("Tool not found");
    return;
  }

  console.log("Aider tool data:");
  console.log(JSON.stringify(tool.data, null, 2));

  closeDb();
}

main();
