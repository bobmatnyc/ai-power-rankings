import { getDb } from '../lib/db/connection';

async function migrateArticle() {
  const db = await getDb();

  console.log('\n🔄 Migrating v7.6 article from news to articles table...\n');

  // Get the article from news table
  const newsResult = await db.execute(`
    SELECT * FROM news WHERE slug = 'algorithm-v76-november-2025-rankings'
  `);

  if (newsResult.rows.length === 0) {
    console.error('❌ Article not found in news table');
    process.exit(1);
  }

  const article = newsResult.rows[0] as any;
  console.log('✅ Found article in news table:');
  console.log(`   Title: ${article.title}`);
  console.log(`   Slug: ${article.slug}`);

  // Escape single quotes for SQL
  const escapeSql = (str: string | null | undefined) => {
    if (!str) return '';
    return String(str).replace(/'/g, "''");
  };

  // Check if already exists
  const existsCheck = await db.execute(`
    SELECT slug FROM articles WHERE slug = 'algorithm-v76-november-2025-rankings'
  `);

  if (existsCheck.rows.length > 0) {
    console.log('\n⚠️  Article already exists in articles table. Deleting and re-inserting...');

    await db.execute(`
      DELETE FROM articles WHERE slug = 'algorithm-v76-november-2025-rankings'
    `);
  }

  // Insert into articles table using string interpolation
  await db.execute(`
    INSERT INTO articles (
      slug,
      title,
      content,
      summary,
      ingestion_type,
      source_name,
      source_url,
      category,
      importance_score,
      published_date,
      status,
      created_at,
      updated_at
    ) VALUES (
      '${escapeSql(article.slug)}',
      '${escapeSql(article.title)}',
      '${escapeSql(article.content)}',
      '${escapeSql(article.summary || '')}',
      'text',
      '${escapeSql(article.source || 'AI Power Ranking')}',
      '${escapeSql(article.source_url || '')}',
      '${escapeSql(article.category || 'algorithm-update')}',
      ${article.importance || 95},
      '${article.published_at}',
      'active',
      NOW(),
      NOW()
    )
  `);

  console.log('✅ Article inserted into articles table');

  // Verify
  const verifyResult = await db.execute(`
    SELECT
      slug,
      title,
      published_date,
      status,
      NOW() - published_date AS age
    FROM articles
    WHERE slug = 'algorithm-v76-november-2025-rankings'
  `);

  console.log('\n✅ Migration complete! Article in articles table:');
  console.log(JSON.stringify(verifyResult.rows[0], null, 2));

  // Check that it will appear in the 7-day window
  const ageCheck = verifyResult.rows[0] as any;
  console.log('\n📅 Age check:');
  console.log(`   Article age: ${ageCheck.age}`);
  console.log(`   Should appear in "What's New" (last 7 days): ${ageCheck.age < '7 days' ? '✅ YES' : '❌ NO'}`);

  process.exit(0);
}

migrateArticle();
