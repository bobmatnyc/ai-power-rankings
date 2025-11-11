import { getDb } from '../lib/db/connection';

async function migrateArticle() {
  const db = await getDb();

  console.log('\n🔄 Migrating v7.6 article from news to articles table...\n');

  // First, get the article data from news table
  const newsResult = await db.execute(`
    SELECT *
    FROM news
    WHERE slug = 'algorithm-v76-november-2025-rankings'
  `);

  if (newsResult.rows.length === 0) {
    console.error('❌ Article not found in news table');
    process.exit(1);
  }

  const article = newsResult.rows[0] as any;
  console.log('✅ Found article in news table:');
  console.log(`   Title: ${article.title}`);
  console.log(`   Slug: ${article.slug}`);
  console.log(`   Published: ${article.published_at}`);

  // Check if it already exists in articles table
  const existsCheck = await db.execute(`
    SELECT slug FROM articles WHERE slug = 'algorithm-v76-november-2025-rankings'
  `);

  if (existsCheck.rows.length > 0) {
    console.log('\n⚠️  Article already exists in articles table. Updating instead...');

    await db.execute(`
      UPDATE articles SET
        title = $1,
        content = $2,
        summary = $3,
        published_date = $4,
        source_name = $5,
        source_url = $6,
        category = $7,
        importance_score = $8,
        status = 'active',
        updated_at = NOW()
      WHERE slug = $9
    `, [
      article.title,
      article.content,
      article.summary,
      article.published_at,
      article.source || 'AI Power Ranking',
      article.source_url,
      article.category || 'algorithm-update',
      article.importance || 95,
      article.slug
    ]);

    console.log('✅ Article updated in articles table');
  } else {
    // Insert into articles table
    await db.execute(`
      INSERT INTO articles (
        slug,
        title,
        content,
        summary,
        published_date,
        source_name,
        source_url,
        category,
        importance_score,
        status,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
    `, [
      article.slug,
      article.title,
      article.content,
      article.summary,
      article.published_at,
      article.source || 'AI Power Ranking',
      article.source_url,
      article.category || 'algorithm-update',
      article.importance || 95,
      'active'
    ]);

    console.log('✅ Article inserted into articles table');
  }

  // Verify the migration
  const verifyResult = await db.execute(`
    SELECT slug, title, published_date, status
    FROM articles
    WHERE slug = 'algorithm-v76-november-2025-rankings'
  `);

  console.log('\n✅ Migration complete! Article in articles table:');
  console.log(JSON.stringify(verifyResult.rows[0], null, 2));

  process.exit(0);
}

migrateArticle();
