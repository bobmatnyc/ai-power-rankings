#!/usr/bin/env tsx
/**
 * Investigate ranking scores for major tools
 */

import { getDb, closeDb } from '../lib/db/connection';
import { rankings } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

async function investigateRankings() {
  const db = getDb();
  if (!db) {
    console.log('❌ No database connection');
    process.exit(1);
  }

  console.log('\n🔍 Investigating Ranking Scores\n');
  console.log('='.repeat(80));

  try {
    // Get current rankings
    const currentRankings = await db
      .select()
      .from(rankings)
      .where(eq(rankings.isCurrent, true))
      .limit(1);

    if (currentRankings.length === 0) {
      console.error('❌ No current rankings found');
      process.exit(1);
    }

    const ranking = currentRankings[0];
    const rankingsData = ranking.data as any[];

    console.log('📊 Current Rankings:', ranking.period);
    console.log('   Algorithm:', ranking.algorithmVersion);
    console.log('   Total Tools:', rankingsData.length);
    console.log('');

    // Show top 15 tools
    console.log('🏆 Top 15 Tools:\n');
    console.log('Rank | Tool                         | Score | Tier');
    console.log('-'.repeat(70));

    rankingsData.slice(0, 15).forEach((t: any) => {
      const marker = t.tool_slug === 'goose' ? '🦆' : '  ';
      console.log(
        `${marker} ${String(t.rank).padStart(2)} | ` +
        `${t.tool_name.substring(0, 28).padEnd(28)} | ` +
        `${String(t.score).padStart(5)} | ` +
        `${t.tier}`
      );
    });
    console.log('');

    // Check major tools we'd expect at top
    const majorToolsSlugs = [
      'goose',
      'cursor',
      'github-copilot',
      'claude-code',
      'windsurf',
      'v0',
      'bolt-new',
      'replit-agent'
    ];

    console.log('🔍 Major Tools Analysis:\n');

    for (const slug of majorToolsSlugs) {
      const tool = rankingsData.find((r: any) => r.tool_slug === slug);
      if (tool) {
        console.log(`${slug === 'goose' ? '🦆' : '📊'} ${tool.tool_name} (Rank #${tool.rank}, Score: ${tool.score})`);
        console.log('   Factor Scores:');
        const factors = tool.factor_scores || {};
        Object.entries(factors).forEach(([factor, score]) => {
          console.log(`     ${factor}: ${score}`);
        });
        console.log('');
      } else {
        console.log(`❌ ${slug} not found`);
        console.log('');
      }
    }

    // Show score distribution
    console.log('📊 Score Distribution:\n');
    const scoreRanges = {
      '90-100': 0,
      '80-89': 0,
      '70-79': 0,
      '60-69': 0,
      '50-59': 0,
      '40-49': 0,
      '0-39': 0
    };

    rankingsData.forEach((t: any) => {
      const score = t.score;
      if (score >= 90) scoreRanges['90-100']++;
      else if (score >= 80) scoreRanges['80-89']++;
      else if (score >= 70) scoreRanges['70-79']++;
      else if (score >= 60) scoreRanges['60-69']++;
      else if (score >= 50) scoreRanges['50-59']++;
      else if (score >= 40) scoreRanges['40-49']++;
      else scoreRanges['0-39']++;
    });

    Object.entries(scoreRanges).forEach(([range, count]) => {
      const bar = '█'.repeat(Math.ceil(count / 2));
      console.log(`${range}: ${bar} (${count} tools)`);
    });
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await closeDb();
  }
}

investigateRankings();
