#!/usr/bin/env tsx

/**
 * Update tool logo URLs from /tools/ to /tool-logos/
 *
 * This fixes the route conflict where Next.js app/[lang]/tools/ was intercepting
 * static file requests for /tools/*.png files.
 */

import * as fs from 'fs';
import * as path from 'path';
import { getDb } from '../lib/db/connection';
import { sql as sqlRaw } from 'drizzle-orm';

const TOOLS_JSON_PATH = path.join(process.cwd(), 'data', 'json', 'tools', 'tools.json');

async function updateLogoUrls() {
  console.log('🔄 Updating tool logo URLs from /tools/ to /tool-logos/\n');

  // Update database
  console.log('📊 Updating database...');
  const db = getDb();

  // Get tools with old URLs (logo_url is in JSONB data field)
  const toolsWithOldUrls = await db.execute(sqlRaw`
    SELECT id, name, slug, data
    FROM tools
    WHERE data->>'logoUrl' LIKE '/tools/%'
  `);

  console.log(`   Found ${toolsWithOldUrls.rows.length} tools with /tools/ logo URLs`);

  // Update each tool
  for (const tool of toolsWithOldUrls.rows) {
    const data = tool.data as any;
    const oldUrl = data.logoUrl;
    const newUrl = oldUrl.replace('/tools/', '/tool-logos/');

    // Update the JSONB data field
    await db.execute(sqlRaw`
      UPDATE tools
      SET data = jsonb_set(data, '{logoUrl}', ${JSON.stringify(newUrl)}::jsonb),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${tool.id}
    `);
    console.log(`   ✅ ${tool.slug}: ${oldUrl} → ${newUrl}`);
  }

  // Update JSON file
  console.log('\n📄 Updating tools.json...');
  const toolsJson = JSON.parse(fs.readFileSync(TOOLS_JSON_PATH, 'utf-8'));

  let jsonUpdates = 0;
  for (const tool of toolsJson) {
    if (tool.logo_url && tool.logo_url.startsWith('/tools/')) {
      tool.logo_url = tool.logo_url.replace('/tools/', '/tool-logos/');
      jsonUpdates++;
    }
  }

  fs.writeFileSync(TOOLS_JSON_PATH, JSON.stringify(toolsJson, null, 2) + '\n');
  console.log(`   ✅ Updated ${jsonUpdates} logo URLs in tools.json`);

  // Verify files exist
  console.log('\n🔍 Verifying logo files exist...');
  const publicDir = path.join(process.cwd(), 'public', 'tool-logos');
  const logoFiles = fs.readdirSync(publicDir).filter(f => f.endsWith('.png'));
  console.log(`   ✅ Found ${logoFiles.length} PNG files in public/tool-logos/`);

  console.log('\n✅ Logo URL update complete!');
  console.log('\n📝 Summary:');
  console.log(`   - Database records updated: ${toolsWithOldUrls.length}`);
  console.log(`   - JSON records updated: ${jsonUpdates}`);
  console.log(`   - Logo files: ${logoFiles.length}`);
  console.log('\n🚀 Next steps:');
  console.log('   1. Test locally: npm run dev');
  console.log('   2. Verify: curl http://localhost:3000/tool-logos/cursor.png');
  console.log('   3. Commit changes: git add -A && git commit');
  console.log('   4. Deploy: git push');
}

updateLogoUrls().catch(console.error);
