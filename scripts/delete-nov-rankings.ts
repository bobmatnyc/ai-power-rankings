#!/usr/bin/env tsx

import { closeDb, getDb } from "@/lib/db/connection";
import { rankings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

async function deleteNovemberRankings() {
  const db = getDb();

  console.log('🗑️  Deleting existing 2025-11 rankings...');

  const result = await db
    .delete(rankings)
    .where(eq(rankings.period, '2025-11'));

  console.log('✅ Deleted 2025-11 rankings');

  closeDb();
}

deleteNovemberRankings().catch(console.error);
