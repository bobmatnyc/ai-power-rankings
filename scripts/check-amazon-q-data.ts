import { getDb } from '../lib/db/connection';
import { tools } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

async function checkAmazonQData() {
  const db = getDb();
  if (db === null) {
    console.log('No DB connection');
    return;
  }

  const tool = await db
    .select()
    .from(tools)
    .where(eq(tools.slug, 'amazon-q-developer'))
    .limit(1);

  if (tool.length === 0) {
    console.log('Amazon Q Developer not found');
    return;
  }

  console.log('\n=== AMAZON Q DEVELOPER CURRENT DATA ===\n');
  console.log('Name:', tool[0].name);
  console.log('Slug:', tool[0].slug);
  console.log('Category:', tool[0].category);
  console.log('Status:', tool[0].status);
  console.log('\nData:', JSON.stringify(tool[0].data, null, 2));
}

checkAmazonQData();
