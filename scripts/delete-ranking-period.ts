#!/usr/bin/env tsx

import { getDb, closeDb } from "../lib/db/connection";
import { rankings } from "../lib/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const period = process.argv[2] || "2025-11";
  const db = getDb();

  console.log(`Deleting ranking period: ${period}`);

  const deleted = await db.delete(rankings).where(eq(rankings.period, period));
  console.log(`✓ Deleted ranking period ${period}`);

  await closeDb();
}

main();
