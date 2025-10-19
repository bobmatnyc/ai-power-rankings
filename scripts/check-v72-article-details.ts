import { getDb, closeDb } from '@/lib/db/connection';
import { news } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const db = getDb();
  const article = await db.select().from(news).where(eq(news.slug, 'algorithm-v72-october-2025-rankings'));

  if (article.length === 0) {
    console.log('No article found with slug algorithm-v72-october-2025-rankings');
    closeDb();
    return;
  }

  const art = article[0];
  console.log('Algorithm v7.2 News Article Details:');
  console.log('=====================================\n');
  console.log(`Slug: ${art.slug}`);
  console.log(`Title: ${art.title}`);
  console.log(`Category: ${art.category}`);
  console.log(`Source: ${art.source}`);
  console.log(`Published: ${art.publishedAt}`);
  console.log(`Importance Score: ${art.importanceScore}`);
  console.log(`Tool Mentions: ${JSON.stringify(art.toolMentions, null, 2)}`);
  console.log(`\nData Object:`);
  console.log(JSON.stringify(art.data, null, 2));

  closeDb();
  process.exit(0);
}

main();
