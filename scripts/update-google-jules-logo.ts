#!/usr/bin/env tsx

/**
 * Update Google Jules Logo URL
 * Ensures Google Jules has the correct logo_url in production database
 */

import { getDb, closeDb } from '../lib/db/connection';
import { tools } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

async function updateGoogleJulesLogo() {
  const db = getDb();

  console.log('\n🎨 Updating Google Jules Logo URL...\n');

  try {
    // Get Google Jules tool
    const julesTool = await db
      .select()
      .from(tools)
      .where(eq(tools.slug, 'google-jules'))
      .limit(1);

    if (!julesTool.length) {
      console.log('❌ Google Jules tool not found');
      return;
    }

    const currentData = julesTool[0].data as any || {};
    console.log(`Current logo_url: ${currentData.logo_url || 'null'}`);

    // Update with correct logo URL
    const updatedData = {
      ...currentData,
      logo_url: '/tools/google-jules.png',
      metadata: {
        ...(currentData.metadata || {}),
        logo_url: '/tools/google-jules.png'
      }
    };

    const result = await db
      .update(tools)
      .set({
        data: updatedData,
        updatedAt: new Date()
      })
      .where(eq(tools.slug, 'google-jules'))
      .returning();

    if (result.length > 0) {
      const data = result[0].data as any;
      console.log('✅ Google Jules logo updated');
      console.log(`   Logo URL: ${data.logo_url}`);
      console.log(`   Tool: ${result[0].name}`);
      console.log(`   Slug: ${result[0].slug}`);
    } else {
      console.log('❌ Failed to update Google Jules');
    }

    console.log('\n🎉 Update complete');
  } catch (error) {
    console.error('❌ Error updating Google Jules:', error);
    throw error;
  } finally {
    await closeDb();
  }
}

updateGoogleJulesLogo();
