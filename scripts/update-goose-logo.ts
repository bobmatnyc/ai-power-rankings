import { db } from '../lib/db';
import { tools } from '../lib/db/schema';
import { eq, sql } from 'drizzle-orm';

async function updateGooseLogo() {
  console.log('Starting Goose logo update...');

  try {
    // First, get the current tool data
    const gooseTool = await db.select()
      .from(tools)
      .where(eq(tools.slug, 'goose'))
      .limit(1);

    if (!gooseTool.length) {
      console.log('❌ Goose tool not found');
      return;
    }

    const currentData = gooseTool[0].data as any || {};

    // Update the data JSONB field with new values
    const updatedData = {
      ...currentData,
      logo_url: '/tools/goose.png',
      website_url: 'https://block.github.io/goose/',
      github_url: 'https://github.com/block/goose',
      metadata: {
        ...(currentData.metadata || {}),
        logo_url: '/tools/goose.png'
      }
    };

    const result = await db.update(tools)
      .set({ data: updatedData })
      .where(eq(tools.slug, 'goose'))
      .returning();

    if (result.length > 0) {
      const data = result[0].data as any;
      console.log('✅ Goose logo and URLs updated');
      console.log(`   - Logo: ${data.logo_url}`);
      console.log(`   - Website: ${data.website_url}`);
      console.log(`   - GitHub: ${data.github_url}`);
    } else {
      console.log('❌ Failed to update Goose');
    }

    console.log('\n🎉 Goose update complete');
  } catch (error) {
    console.error('❌ Error updating Goose:', error);
    throw error;
  } finally {
    process.exit(0);
  }
}

updateGooseLogo();
