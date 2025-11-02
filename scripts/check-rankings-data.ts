#!/usr/bin/env tsx

import { getDb } from '../lib/db/connection';
import { sql } from 'drizzle-orm';

async function checkRankingsData() {
  const db = getDb();

  const result = await db.execute(sql`
    SELECT period, is_current,
           jsonb_pretty(data) as data_preview
    FROM rankings
    WHERE is_current = true
    LIMIT 1
  `);

  console.log('Current rankings data:');
  console.log(JSON.stringify(result.rows[0], null, 2));
}

checkRankingsData().catch(console.error);
