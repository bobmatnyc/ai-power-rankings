import { getDb, closeDb } from '@/lib/db/connection';
import { news } from '@/lib/db/schema';
import { like, desc } from 'drizzle-orm';

async function main() {
  const db = getDb();
  const articles = await db.select().from(news).where(like(news.slug, '%algorithm%')).orderBy(desc(news.publishedAt));

  console.log('Existing Algorithm News Articles:');
  console.log('=================================');
  for (const article of articles) {
    console.log(`\nSlug: ${article.slug}`);
    console.log(`Title: ${article.title}`);
    console.log(`Category: ${article.category}`);
    console.log(`Published: ${article.publishedAt}`);
    console.log(`Importance Score: ${article.importanceScore}`);
    console.log(`Tool Mentions: ${JSON.stringify(article.toolMentions)}`);
  }

  closeDb();
  process.exit(0);
}

main();
