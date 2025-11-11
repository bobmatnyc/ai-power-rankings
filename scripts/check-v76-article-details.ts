import { getDb } from '../lib/db/connection';

async function checkArticle() {
  const db = await getDb();

  const result = await db.execute(`
    SELECT
      slug,
      title,
      published_at,
      created_at,
      NOW() as current_time,
      NOW() - published_at AS age,
      CASE
        WHEN published_at > NOW() - INTERVAL '7 days' THEN 'VISIBLE (within 7 days)'
        ELSE 'NOT VISIBLE (older than 7 days)'
      END as visibility_status
    FROM news
    WHERE slug = 'algorithm-v76-november-2025-rankings'
  `);

  console.log('\n📊 Article Status:');
  console.log(JSON.stringify(result.rows[0], null, 2));

  process.exit(0);
}

checkArticle();
