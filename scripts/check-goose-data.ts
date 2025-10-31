import { db } from '../lib/db';
import { tools } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

async function checkGooseData() {
  try {
    console.log('Checking Goose data in database...\n');

    const gooseData = await db.select().from(tools).where(eq(tools.slug, 'goose')).limit(1);

    if (gooseData.length === 0) {
      console.log('❌ No Goose tool found in database!');
      return;
    }

    const goose = gooseData[0];
    console.log('Goose data from database:');
    console.log(JSON.stringify(goose, null, 2));

    // Check for null/missing fields
    console.log('\n--- Field Validation ---');
    const fields = [
      'id', 'name', 'slug', 'category', 'status',
      'logo_url', 'website_url', 'github_repo',
      'description', 'tagline', 'info'
    ];

    fields.forEach(field => {
      const value = (goose as any)[field];
      if (value === null || value === undefined) {
        console.log(`❌ ${field}: NULL/UNDEFINED`);
      } else if (typeof value === 'string' && value.trim() === '') {
        console.log(`⚠️  ${field}: EMPTY STRING`);
      } else if (typeof value === 'object') {
        console.log(`✅ ${field}: ${JSON.stringify(value).substring(0, 50)}...`);
      } else {
        console.log(`✅ ${field}: ${value}`);
      }
    });

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }

  process.exit(0);
}

checkGooseData();
