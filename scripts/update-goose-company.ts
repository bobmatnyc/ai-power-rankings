import { getDb } from '../lib/db/connection';
import { tools } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

async function updateGooseCompany() {
  try {
    console.log('🔄 Updating Goose company/developer info...');

    const db = getDb();
    if (!db) throw new Error('Database not connected');

    // First, get current data
    const current = await db.select().from(tools).where(eq(tools.slug, 'goose')).limit(1);

    if (current.length === 0) {
      console.log('⚠️  No Goose tool found in database');
      return;
    }

    const currentData = current[0]?.data as Record<string, unknown>;
    console.log('Current info:', currentData?.info);

    // Update with Open Source company
    const info = (currentData?.info as Record<string, unknown>) || {};
    const updatedInfo = {
      ...info,
      company: {
        name: 'Block (Open Source)',
        url: 'https://github.com/block/goose'
      }
    };

    const updatedData = {
      ...currentData,
      info: updatedInfo,
    };

    const result = await db
      .update(tools)
      .set({
        data: updatedData,
        updatedAt: new Date(),
      })
      .where(eq(tools.slug, 'goose'))
      .returning();

    console.log('✅ Goose company updated:', ((result[0]?.data as any)?.info as any)?.company);
    console.log(`   Tool: ${result[0]?.name}`);
  } catch (error) {
    console.error('❌ Error updating Goose company:', error);
    process.exit(1);
  }
}

updateGooseCompany();
