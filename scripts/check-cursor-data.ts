import { getDb } from '../lib/db/connection';
import { tools } from '../lib/db/schema';
import { sql } from 'drizzle-orm';

async function checkCursorData() {
  const db = getDb();
  console.log('🔍 Checking Cursor data in database...\n');

  // Use raw SQL to query
  const result = await db.execute(
    sql`SELECT data FROM tools WHERE data->>'slug' = 'cursor' LIMIT 1`
  );

  if (result.rows.length > 0) {
    const toolData = result.rows[0].data as any;
    console.log('📦 Cursor data:');
    console.log('   Name:', toolData.name);
    console.log('   Tagline:', toolData.tagline || 'NULL');
    console.log('   Features:', toolData.features ? `${toolData.features.length} items` : 'NULL');
    console.log('   Supported Languages:', toolData.supported_languages ? `${toolData.supported_languages.length} items` : 'NULL');
    console.log('   IDE Support:', toolData.ide_support || 'NULL');
    console.log('\n   Full tagline value:', JSON.stringify(toolData.tagline));
    console.log('   Full features:', JSON.stringify(toolData.features?.slice(0, 3)));
  } else {
    console.log('❌ No Cursor tool found');
  }

  process.exit(0);
}

checkCursorData();
