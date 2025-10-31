import { closeDb, getDb } from '@/lib/db/connection';
import { tools } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

async function updateFlintLogo() {
  const db = getDb();

  console.log('\n📝 Updating Flint logo...\n');

  const toolResults = await db.select().from(tools).where(eq(tools.slug, 'flint')).limit(1);
  if (toolResults.length === 0) {
    console.log('❌ Flint tool not found');
    return;
  }

  const tool = toolResults[0];
  const currentData = tool.data as any;

  await db.update(tools)
    .set({
      data: { ...currentData, logo_url: '/tools/flint.png' }
    })
    .where(eq(tools.id, tool.id));

  console.log('✅ Updated Flint logo URL to: /tools/flint.png');
  console.log('\n✨ Done!\n');
}

updateFlintLogo()
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  })
  .finally(() => {
    closeDb();
  });
