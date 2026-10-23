import { getDb, getRawSql } from '../lib/db/connection';

async function checkTables() {
  const db = await getDb();
  // #103: published_at / published_date are timestamp WITHOUT time zone; read them as UTC.
  const rawSql = getRawSql();

  // Check if article exists in 'news' table
  console.log('\n📊 Checking NEWS table:');
  const newsResult = await rawSql(`
    SELECT slug, title, published_at
    FROM news
    WHERE slug = 'algorithm-v76-november-2025-rankings'
  `);
  console.log('News table results:', JSON.stringify(newsResult.rows, null, 2));

  // Check if article exists in 'articles' table
  console.log('\n📊 Checking ARTICLES table:');
  const articlesResult = await rawSql(`
    SELECT slug, title, published_date, status
    FROM articles
    WHERE slug = 'algorithm-v76-november-2025-rankings'
  `);
  console.log('Articles table results:', JSON.stringify(articlesResult.rows, null, 2));

  // Count total in each table
  console.log('\n📊 Table counts:');
  const newsCount = await db.execute(`SELECT COUNT(*) as count FROM news`);
  const articlesCount = await db.execute(`SELECT COUNT(*) as count FROM articles WHERE status = 'active'`);

  console.log('News table total:', newsCount.rows[0]);
  console.log('Articles table (active):', articlesCount.rows[0]);

  process.exit(0);
}

checkTables();
