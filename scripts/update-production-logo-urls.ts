#!/usr/bin/env tsx

/**
 * Update Production Logo URLs
 *
 * This script updates the logo_url field in the production database for all tools
 * that have PNG logos in /public/tools/. It checks for existing PNG files and updates
 * the database accordingly.
 */

import { getDb, closeDb } from '../lib/db/connection';
import { tools } from '../lib/db/schema';
import { eq } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

async function updateProductionLogoUrls() {
  const db = getDb();

  console.log('\n🎨 Updating Production Logo URLs...\n');
  console.log('='.repeat(80));

  // Verify we're using the right database
  const dbUrl = process.env.DATABASE_URL || '';
  const isProduction = dbUrl.includes('ep-dark-firefly-adp1p3v8');

  console.log('\n🔍 Database Connection Check:');
  console.log(`   URL: ${dbUrl.substring(0, 50)}...`);
  console.log(`   Is Production: ${isProduction ? '✅ YES' : '⚠️  NO'}`);

  if (!isProduction) {
    console.log('\n⚠️  WARNING: This does not appear to be the production database!');
    console.log('   Expected: ep-dark-firefly-adp1p3v8');
    console.log('\n   Continue anyway? (The script will proceed in 3 seconds)');
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  // Step 1: Scan for available PNG logos
  console.log('\n📁 Step 1: Scanning for PNG Logos\n');

  const publicToolsDir = path.join(process.cwd(), 'public', 'tools');
  const pngFiles: string[] = [];

  try {
    const files = fs.readdirSync(publicToolsDir);
    files.forEach(file => {
      if (file.endsWith('.png')) {
        pngFiles.push(file.replace('.png', ''));
      }
    });

    console.log(`   Found ${pngFiles.length} PNG logos in /public/tools/`);
    console.log(`   Sample: ${pngFiles.slice(0, 5).join(', ')}...`);
  } catch (error) {
    console.error('   ❌ Error reading public/tools directory:', error);
    await closeDb();
    return;
  }

  // Step 2: Get all active tools from database
  console.log('\n📋 Step 2: Loading Active Tools from Database\n');

  const allTools = await db
    .select({
      id: tools.id,
      slug: tools.slug,
      name: tools.name,
      data: tools.data,
    })
    .from(tools)
    .where(eq(tools.status, 'active'));

  console.log(`   Found ${allTools.length} active tools in database`);

  // Step 3: Update logo URLs for tools with PNG files
  console.log('\n🔄 Step 3: Updating Logo URLs\n');

  let updatedCount = 0;
  let skippedCount = 0;
  let noLogoCount = 0;

  for (const tool of allTools) {
    const toolData = tool.data as any || {};
    const currentLogoUrl = toolData.logo_url || toolData.metadata?.logo_url;
    const expectedLogoUrl = `/tools/${tool.slug}.png`;

    // Check if PNG exists for this tool
    if (pngFiles.includes(tool.slug)) {
      // Check if logo URL needs updating
      if (currentLogoUrl === expectedLogoUrl) {
        skippedCount++;
        continue; // Already has correct logo URL
      }

      // Update the logo URL in the data JSONB field
      const updatedData = {
        ...toolData,
        logo_url: expectedLogoUrl,
        metadata: {
          ...(toolData.metadata || {}),
          logo_url: expectedLogoUrl
        }
      };

      await db.update(tools)
        .set({
          data: updatedData,
          updatedAt: new Date()
        })
        .where(eq(tools.id, tool.id));

      updatedCount++;
      console.log(`   ✅ Updated: ${tool.slug.padEnd(30)} → ${expectedLogoUrl}`);
    } else {
      noLogoCount++;
      // Tool doesn't have a PNG logo yet
      if (updatedCount + skippedCount + noLogoCount <= 10) {
        console.log(`   ⊘  No logo: ${tool.slug}`);
      }
    }
  }

  // Step 4: Summary
  console.log('\n' + '='.repeat(80));
  console.log('✅ Logo URL Update Complete!');
  console.log('='.repeat(80));

  console.log('\n📊 Summary:');
  console.log(`   Total Active Tools:    ${allTools.length}`);
  console.log(`   Available PNG Logos:   ${pngFiles.length}`);
  console.log(`   Updated:               ${updatedCount}`);
  console.log(`   Already Correct:       ${skippedCount}`);
  console.log(`   No Logo Available:     ${noLogoCount}`);
  console.log(`   Timestamp:             ${new Date().toISOString()}`);

  // Step 5: Verify updates
  console.log('\n🔍 Step 5: Verification Sample (First 5 Updated)\n');

  if (updatedCount > 0) {
    // Get 5 updated tools to verify
    const verifyTools = await db
      .select({
        slug: tools.slug,
        name: tools.name,
        data: tools.data,
      })
      .from(tools)
      .where(eq(tools.status, 'active'))
      .limit(5);

    verifyTools.forEach(tool => {
      const toolData = tool.data as any || {};
      const logoUrl = toolData.logo_url || toolData.metadata?.logo_url;
      if (logoUrl && logoUrl.includes('.png')) {
        console.log(`   ✓ ${tool.slug}: ${logoUrl}`);
      }
    });
  }

  console.log('\n🎉 Logo URLs updated in production database!');
  console.log('   Logos will display on next deployment.\n');
}

updateProductionLogoUrls()
  .catch((error) => {
    console.error('\n❌ Logo update error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await closeDb();
  });
