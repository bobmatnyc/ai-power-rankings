import { getDb } from '../lib/db/connection.js';
import { articles } from '../lib/db/article-schema.js';
import { sql } from 'drizzle-orm';

async function analyze() {
  const db = getDb();
  
  const totalCount = await db.select({ count: sql<number>`count(*)` }).from(articles);
  console.log('\n📊 DATABASE ARTICLE ANALYSIS');
  console.log('═══════════════════════════════════════');
  console.log(`Total articles: ${totalCount[0].count}`);
  
  const dateRange = await db.select({
    earliest: sql<Date>`MIN(published_date)`,
    latest: sql<Date>`MAX(published_date)`
  }).from(articles);
  console.log(`Date range: ${dateRange[0].earliest} to ${dateRange[0].latest}`);
  
  console.log('\n📚 Most Recent Articles (by published date):');
  const recent = await db.select({
    title: articles.title,
    sourceName: articles.sourceName,
    publishedDate: articles.publishedDate,
  })
  .from(articles)
  .orderBy(sql`${articles.publishedDate} DESC`)
  .limit(10);
  
  recent.forEach((article, i) => {
    const date = article.publishedDate ? new Date(article.publishedDate).toISOString().split('T')[0] : 'Unknown';
    const source = article.sourceName || 'Unknown';
    const title = article.title.substring(0, 70);
    console.log(`   ${i+1}. "${title}..." (${source}, ${date})`);
  });
  
  process.exit(0);
}

analyze().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
