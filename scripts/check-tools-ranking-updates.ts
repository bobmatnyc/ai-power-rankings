#!/usr/bin/env npx tsx
/**
 * Check recent tool ranking updates to verify ingestion is working
 */

import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

function getDbUrl() {
  const nodeEnv = process.env.NODE_ENV || 'development';

  if (nodeEnv === 'development') {
    const devUrl = process.env.DATABASE_URL_DEVELOPMENT;
    const fallbackUrl = process.env.DATABASE_URL;

    if (devUrl && !devUrl.includes('YOUR_PASSWORD')) {
      console.log('⚠️ DATABASE_URL_DEVELOPMENT not found, falling back to DATABASE_URL');
      return devUrl;
    } else if (fallbackUrl && !fallbackUrl.includes('YOUR_PASSWORD')) {
      console.log('⚠️ DATABASE_URL_DEVELOPMENT not found, falling back to DATABASE_URL');
      return fallbackUrl;
    }
  }

  return process.env.DATABASE_URL;
}

async function checkToolRankingUpdates() {
  console.log('\n📊 Checking Recent Tool Ranking Updates');
  console.log('==========================================');

  const DATABASE_URL = getDbUrl();
  if (!DATABASE_URL) {
    console.error('❌ No database URL configured');
    return;
  }

  const sql = neon(DATABASE_URL);

  try {
    // Get tools with recent ranking changes (current_score has 'overallScore' field)
    const toolsWithScores = await sql`
      SELECT
        t.name,
        t.current_score ->> 'overallScore' as overall_score,
        t.updated_at
      FROM tools t
      WHERE t.current_score ->> 'overallScore' IS NOT NULL
        AND (t.current_score ->> 'overallScore')::numeric > 0
      ORDER BY t.updated_at DESC
      LIMIT 10
    `;

    if (toolsWithScores.length === 0) {
      console.log('❌ No tools found with ranking scores > 0');

      // Check if there are any tools at all
      const allToolsCount = await sql`SELECT COUNT(*) as count FROM tools`;
      console.log(`📊 Total tools in database: ${allToolsCount[0].count}`);

      // Check recently updated tools
      const recentlyUpdated = await sql`
        SELECT name, updated_at, current_score
        FROM tools
        ORDER BY updated_at DESC
        LIMIT 5
      `;
      console.log('\n🔄 Recently Updated Tools:');
      for (const tool of recentlyUpdated) {
        console.log(`  ${tool.name}: updated ${new Date(tool.updated_at).toLocaleString()}`);
        console.log(`    Score: ${JSON.stringify(tool.current_score)}`);
      }

      return;
    }

    console.log(`✅ Found ${toolsWithScores.length} tools with updated scores:\n`);

    for (const tool of toolsWithScores) {
      console.log(`Tool: ${tool.name}`);
      console.log(`  Score: ${tool.overall_score}`);
      console.log(`  Updated: ${new Date(tool.updated_at).toLocaleString()}`);
      console.log('');
    }

    // Check most recent articles
    const recentArticles = await sql`
      SELECT
        a.title,
        a.tool_mentions,
        a.importance_score,
        a.created_at
      FROM articles a
      ORDER BY a.created_at DESC
      LIMIT 5
    `;

    console.log('\n📰 Most Recent Articles:');
    console.log('========================');

    for (const article of recentArticles) {
      console.log(`Title: ${article.title.substring(0, 60)}...`);
      console.log(`  Tool Mentions: ${JSON.stringify(article.tool_mentions)?.length || 0} tools`);
      console.log(`  Importance: ${article.importance_score}`);
      console.log(`  Created: ${new Date(article.created_at).toLocaleString()}`);
      console.log('');
    }

    // Check if the most recent articles from our ingestion test are there
    const todayArticles = await sql`
      SELECT
        a.title,
        a.id,
        a.created_at
      FROM articles a
      WHERE a.created_at >= NOW() - INTERVAL '1 hour'
      ORDER BY a.created_at DESC
    `;

    if (todayArticles.length > 0) {
      console.log('\n🕐 Articles from the last hour:');
      console.log('==============================');
      for (const article of todayArticles) {
        console.log(`  ${article.id}: ${article.title.substring(0, 50)}...`);
        console.log(`    Created: ${new Date(article.created_at).toLocaleString()}`);
      }
    }

  } catch (error) {
    console.error('❌ Error checking tool updates:', error);
  }
}

if (require.main === module) {
  checkToolRankingUpdates();
}
