import { getDb } from '../lib/db/connection';
import { tools } from '../lib/db/schema';
import { eq, sql } from 'drizzle-orm';

async function updateGooseLogo() {
  try {
    console.log('🔄 Updating Goose logo path...');

    const db = getDb();
    if (!db) throw new Error('Database not connected');

    // First, get current data
    const current = await db.select().from(tools).where(eq(tools.slug, 'goose')).limit(1);

    if (current.length === 0) {
      console.log('⚠️  No Goose tool found in database');
      return;
    }

    console.log('Current logo_url:', (current[0]?.data as any)?.logo_url);

    // Update logo_url in the data JSONB field
    const currentData = current[0]?.data as Record<string, unknown>;
    const updatedData = {
      ...currentData,
      logo_url: '/tools/goose.png',
    };

    const result = await db
      .update(tools)
      .set({
        data: updatedData,
        updatedAt: new Date(),
      })
      .where(eq(tools.slug, 'goose'))
      .returning();

    if (result.length > 0) {
      console.log('✅ Goose logo path updated:', (result[0]?.data as any)?.logo_url);
      console.log(`   Tool: ${result[0]?.name}`);
    }
  } catch (error) {
    console.error('❌ Error updating Goose logo:', error);
    process.exit(1);
  }
}

updateGooseLogo();
