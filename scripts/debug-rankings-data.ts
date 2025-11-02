#!/usr/bin/env tsx

import { closeDb, getDb } from "@/lib/db/connection";
import { rankings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

async function debugRankingsData() {
  const db = getDb();

  const results = await db
    .select()
    .from(rankings)
    .where(eq(rankings.period, '2025-11'))
    .limit(1);

  if (results.length > 0) {
    console.log('Sample ranking record:');
    console.log(JSON.stringify(results[0], null, 2));
  }

  closeDb();
}

debugRankingsData().catch(console.error);
