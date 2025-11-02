#!/usr/bin/env tsx

import { getDb } from '../lib/db/connection';
import { sql } from 'drizzle-orm';

async function checkLogoUrlField() {
  const db = getDb();

  const result = await db.execute(sql`
    SELECT name, slug,
           data->>'logo' as logo,
           data->>'logoUrl' as logo_url,
           data->>'website_url' as website_url
    FROM tools
    WHERE slug IN ('github-copilot', 'claude-code', 'cursor', 'cline')
    LIMIT 10
  `);

  console.log('Logo fields in database:');
  console.log(JSON.stringify(result.rows, null, 2));
}

checkLogoUrlField().catch(console.error);
