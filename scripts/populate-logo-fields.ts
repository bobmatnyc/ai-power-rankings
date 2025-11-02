#!/usr/bin/env tsx

/**
 * Populate the logo field in tools database
 *
 * This script sets the logo field to /tool-icons/{slug}.png for tools
 * that have logo files in public/tool-icons/
 */

import * as fs from 'fs';
import * as path from 'path';
import { getDb } from '../lib/db/connection';
import { sql } from 'drizzle-orm';

async function populateLogoFields() {
  console.log('🖼️  Populating logo fields in tools database\n');

  const db = getDb();
  const publicDir = path.join(process.cwd(), 'public', 'tool-icons');

  // Get list of logo files
  if (!fs.existsSync(publicDir)) {
    console.error('❌ Error: public/tool-icons/ directory not found');
    process.exit(1);
  }

  const logoFiles = fs.readdirSync(publicDir)
    .filter(f => f.endsWith('.png'))
    .map(f => path.basename(f, '.png'));

  console.log(`📁 Found ${logoFiles.length} logo files in public/tool-icons/\n`);

  // Get all tools
  const allTools = await db.execute(sql`
    SELECT id, name, slug, data
    FROM tools
  `);

  console.log(`📊 Found ${allTools.rows.length} tools in database\n`);

  let updatedCount = 0;
  let skippedCount = 0;

  // Update each tool that has a matching logo file
  for (const tool of allTools.rows) {
    const toolSlug = tool.slug as string;

    if (logoFiles.includes(toolSlug)) {
      const logoPath = `/tool-icons/${toolSlug}.png`;

      await db.execute(sql`
        UPDATE tools
        SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{logo}', ${JSON.stringify(logoPath)}::jsonb),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${tool.id}
      `);

      console.log(`   ✅ ${toolSlug}: ${logoPath}`);
      updatedCount++;
    } else {
      console.log(`   ⏭️  ${toolSlug}: No logo file found`);
      skippedCount++;
    }
  }

  console.log('\n✅ Logo field population complete!');
  console.log('\n📝 Summary:');
  console.log(`   - Tools updated: ${updatedCount}`);
  console.log(`   - Tools skipped: ${skippedCount}`);
  console.log(`   - Logo files available: ${logoFiles.length}`);
  console.log('\n🔍 Verification:');
  console.log('   Run: npx tsx scripts/check-logo-fields.ts');
  console.log('\n🚀 Next:');
  console.log('   Restart dev server and test the API');
}

populateLogoFields().catch(console.error);
