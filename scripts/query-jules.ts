import { getDb, closeDb } from '../lib/db/connection';
import { tools } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

async function queryJules() {
  const db = getDb();

  console.log('🔍 Querying for Jules entries...\n');

  const julesEntries = await db
    .select()
    .from(tools)
    .where(eq(tools.name, 'Google Jules'));

  console.log(`Found ${julesEntries.length} Jules entries:\n`);

  julesEntries.forEach(entry => {
    console.log('─────────────────────────────────────');
    console.log(`ID: ${entry.id}`);
    console.log(`Slug: ${entry.slug}`);
    console.log(`Name: ${entry.name}`);
    console.log(`Status: ${entry.status}`);
    console.log(`Category: ${entry.category}`);
    console.log(`Created: ${entry.createdAt}`);
    console.log(`Updated: ${entry.updatedAt}`);
    const redirectTo = (entry.data as any)?.redirect_to || 'none';
    console.log(`Data redirect: ${redirectTo}`);
    console.log('─────────────────────────────────────\n');
  });
}

queryJules()
  .catch(console.error)
  .finally(async () => {
    await closeDb();
    process.exit(0);
  });
