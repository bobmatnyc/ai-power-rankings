import { getDb } from '../lib/db/connection';
import { articles } from '../lib/db/article-schema';
import { like, sql } from 'drizzle-orm';

async function checkSlug() {
  const db = getDb();
  if (!db) {
    console.log('Database not available');
    process.exit(1);
  }

  const targetSlug = 'ai-coding-tools-market-intelligence-report-september-2025';

  console.log(`\nSearching for exact slug: "${targetSlug}"\n`);

  const exactMatch = await db.select({
    id: articles.id,
    slug: articles.slug,
    title: articles.title,
    status: articles.status
  }).from(articles)
  .where(sql`${articles.slug} = ${targetSlug}`)
  .limit(1);

  console.log('Exact match results:', exactMatch.length);
  if (exactMatch.length > 0) {
    console.log(JSON.stringify(exactMatch[0], null, 2));
  }

  console.log('\n---\n');
  console.log('Searching for articles with slug containing "ai-coding-tools-market"...\n');

  const results = await db.select({
    id: articles.id,
    slug: articles.slug,
    title: articles.title,
    status: articles.status
  }).from(articles)
  .where(like(articles.slug, '%ai-coding-tools-market%'))
  .limit(5);

  console.log('Found', results.length, 'articles:\n');
  results.forEach(r => {
    console.log('ID:', r.id);
    console.log('Slug:', r.slug);
    console.log('Title:', r.title);
    console.log('Status:', r.status);
    console.log('---');
  });

  // Also search by title pattern
  console.log('\nSearching by title pattern "Market Intelligence"...\n');
  const titleResults = await db.select({
    id: articles.id,
    slug: articles.slug,
    title: articles.title,
    status: articles.status
  }).from(articles)
  .where(like(articles.title, '%Market Intelligence%'))
  .limit(5);

  console.log('Found', titleResults.length, 'articles by title:\n');
  titleResults.forEach(r => {
    console.log('ID:', r.id);
    console.log('Slug:', r.slug);
    console.log('Title:', r.title);
    console.log('Status:', r.status);
    console.log('---');
  });

  // Show sample of recent articles
  console.log('\nRecent 5 articles:\n');
  const recent = await db.select({
    id: articles.id,
    slug: articles.slug,
    title: articles.title,
    status: articles.status
  }).from(articles)
  .orderBy(sql`${articles.createdAt} DESC`)
  .limit(5);

  recent.forEach(r => {
    console.log('Slug:', r.slug);
    console.log('Title:', r.title);
    console.log('Status:', r.status);
    console.log('---');
  });
}

checkSlug().catch(console.error);
