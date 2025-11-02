#!/usr/bin/env tsx

/**
 * Fix logo paths from /tools/ to /tool-icons/
 *
 * Previous migration script may have set incorrect paths
 */

import { getDb } from '../lib/db/connection';
import { sql } from 'drizzle-orm';

async function fixLogoPaths() {
  console.log('🔧 Fixing logo paths from /tools/ to /tool-icons/\n');

  const db = getDb();

  // Get tools with old /tools/ paths in logo field
  const toolsWithOldPaths = await db.execute(sql`
    SELECT id, name, slug, data->>'logo' as logo
    FROM tools
    WHERE data->>'logo' LIKE '/tools/%'
  `);

  console.log(`📊 Found ${toolsWithOldPaths.rows.length} tools with /tools/ paths\n`);

  let updatedCount = 0;

  for (const tool of toolsWithOldPaths.rows) {
    const oldPath = tool.logo as string;
    const newPath = oldPath.replace('/tools/', '/tool-icons/');

    await db.execute(sql`
      UPDATE tools
      SET data = jsonb_set(data, '{logo}', ${JSON.stringify(newPath)}::jsonb),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${tool.id}
    `);

    console.log(`   ✅ ${tool.slug}: ${oldPath} → ${newPath}`);
    updatedCount++;
  }

  console.log('\n✅ Logo path fix complete!');
  console.log(`   - Tools updated: ${updatedCount}`);
  console.log('\n🔍 Verification:');
  console.log('   Run: npx tsx scripts/check-logo-fields.ts');
}

fixLogoPaths().catch(console.error);
