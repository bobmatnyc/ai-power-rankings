#!/usr/bin/env node
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { getDb } from "../lib/db/connection";
import { tools, rankingVersions, articleRankingsChanges, articles } from "../lib/db/schema";
import { eq, gte, sql } from "drizzle-orm";

async function verifyBaselineSystem() {
  console.log('=== BASELINE SNAPSHOT SYSTEM VERIFICATION ===\n');
  
  const db = getDb();
  if (!db) {
    console.error('ERROR: Database connection failed');
    process.exit(1);
  }

  try {
    // 1. Tools Table Verification
    console.log('1. TOOLS TABLE VERIFICATION:');
    console.log('-'.repeat(80));
    
    const allTools = await db.select({
      id: tools.id,
      name: tools.name,
      baselineScore: tools.baselineScore,
      deltaScore: tools.deltaScore,
      currentScore: tools.currentScore,
      scoreUpdatedAt: tools.scoreUpdatedAt
    }).from(tools);

    console.log(`Total tools: ${allTools.length}`);
    
    const toolsWithBaseline = allTools.filter(t => t.baselineScore !== null);
    console.log(`Tools with baseline_score: ${toolsWithBaseline.length}`);
    
    const toolsWithDelta = allTools.filter(t => t.deltaScore !== null && t.deltaScore !== 0);
    console.log(`Tools with non-zero delta_score: ${toolsWithDelta.length}`);
    
    // Verify calculation integrity
    let calculationErrors = 0;
    allTools.forEach(tool => {
      const baseline = tool.baselineScore ? parseFloat(String(tool.baselineScore)) : 0;
      const delta = tool.deltaScore ? parseFloat(String(tool.deltaScore)) : 0;
      const expected = baseline + delta;
      const actual = tool.currentScore ? parseFloat(String(tool.currentScore)) : 0;

      if (Math.abs(expected - actual) > 0.01) {
        console.log(`  ERROR: ${tool.name} - Expected: ${expected.toFixed(2)}, Actual: ${actual.toFixed(2)}`);
        calculationErrors++;
      }
    });
    
    console.log(`Score calculation errors: ${calculationErrors}`);
    
    if (calculationErrors === 0) {
      console.log('✅ All score calculations are correct (baseline + delta = current)');
    }
    
    console.log('\nTools with Delta Modifications:');
    const toolsWithDeltaSorted = toolsWithDelta.sort((a, b) => 
      (b.deltaScore || 0) - (a.deltaScore || 0)
    );
    
    toolsWithDeltaSorted.forEach(tool => {
      const baseline = tool.baselineScore ? parseFloat(String(tool.baselineScore)).toFixed(2) : '0.00';
      const delta = tool.deltaScore ? parseFloat(String(tool.deltaScore)).toFixed(2) : '0.00';
      const current = tool.currentScore ? parseFloat(String(tool.currentScore)).toFixed(2) : '0.00';
      console.log(`  - ${tool.name}: baseline=${baseline}, delta=${delta}, current=${current}`);
    });

    console.log('\n');

    // 2. Ranking Versions Table
    console.log('2. RANKING VERSIONS TABLE VERIFICATION:');
    console.log('-'.repeat(80));
    
    const baselineVersion = await db.select()
      .from(rankingVersions)
      .where(eq(rankingVersions.versionName, 'baseline-may-2025'))
      .limit(1);

    if (baselineVersion.length === 0) {
      console.log('❌ ERROR: No baseline-may-2025 version found!');
    } else {
      const snapshot = baselineVersion[0];
      console.log(`✅ Version found: ${snapshot.versionName}`);
      console.log(`   Snapshot date: ${snapshot.snapshotDate}`);
      console.log(`   Created at: ${snapshot.createdAt}`);
      
      const snapshotData = snapshot.rankingsSnapshot as any[];
      const snapshotLength = snapshotData ? snapshotData.length : 0;
      console.log(`   Tools in snapshot: ${snapshotLength}`);
      
      if (snapshotData && snapshotData.length > 0) {
        console.log('\n   Sample snapshot entries:');
        snapshotData.slice(0, 5).forEach((entry: any) => {
          console.log(`     Rank ${entry.rank}: ${entry.name} (score: ${entry.score})`);
        });
      }
    }

    console.log('\n');

    // 3. Article Rankings Changes
    console.log('3. ARTICLE RANKINGS CHANGES VERIFICATION:');
    console.log('-'.repeat(80));
    
    const totalChanges = await db.select({ count: sql<number>`count(*)::int` })
      .from(articleRankingsChanges);
    
    const changeCount = totalChanges[0].count;
    console.log(`Total ranking changes: ${changeCount}`);
    
    const changesWithArticles = await db.select({
      toolId: articleRankingsChanges.toolId,
      articleId: articleRankingsChanges.articleId,
      scoreChange: articleRankingsChanges.scoreChange,
      processedAt: articleRankingsChanges.processedAt
    })
    .from(articleRankingsChanges)
    .limit(10);
    
    console.log('\nSample ranking changes:');
    changesWithArticles.forEach(change => {
      const sign = (change.scoreChange || 0) > 0 ? '+' : '';
      console.log(`  Tool ${change.toolId}, Article ${change.articleId}: ${sign}${change.scoreChange}`);
    });
    
    const toolsWithChanges = await db.select({
      toolId: articleRankingsChanges.toolId,
      changeCount: sql<number>`count(*)::int`,
      totalDelta: sql<number>`sum(${articleRankingsChanges.scoreChange})::float`
    })
    .from(articleRankingsChanges)
    .groupBy(articleRankingsChanges.toolId);
    
    console.log(`\nTools with ranking changes: ${toolsWithChanges.length}`);

    console.log('\n');

    // 4. Score Calculation Deep Dive
    console.log('4. DETAILED SCORE VERIFICATION (Sample Tools):');
    console.log('-'.repeat(80));
    
    const knownTools = ['Claude Code', 'ChatGPT', 'Gemini', 'Perplexity'];
    
    for (const toolName of knownTools) {
      const tool = await db.select()
        .from(tools)
        .where(eq(tools.name, toolName))
        .limit(1);
      
      if (tool.length > 0) {
        const t = tool[0];
        const baseline = t.baselineScore ? parseFloat(String(t.baselineScore)) : 0;
        const delta = t.deltaScore ? parseFloat(String(t.deltaScore)) : 0;
        const current = t.currentScore ? parseFloat(String(t.currentScore)) : 0;
        const calculated = baseline + delta;
        const matches = Math.abs(calculated - current) < 0.01;

        console.log(`\n${t.name}:`);
        console.log(`  Baseline Score: ${baseline.toFixed(2)}`);
        console.log(`  Delta Score: ${delta.toFixed(2)}`);
        console.log(`  Current Score: ${current.toFixed(2)}`);
        console.log(`  Calculated: ${baseline.toFixed(2)} + ${delta.toFixed(2)} = ${calculated.toFixed(2)}`);
        console.log(`  Match: ${matches ? '✅ YES' : '❌ NO'}`);
        
        const changes = await db.select({
          scoreChange: articleRankingsChanges.scoreChange
        })
        .from(articleRankingsChanges)
        .where(eq(articleRankingsChanges.toolId, t.id));
        
        const calculatedDelta = changes.reduce((sum, c) => {
          const change = c.scoreChange ? parseFloat(String(c.scoreChange)) : 0;
          return sum + change;
        }, 0);
        const deltaMatches = Math.abs(calculatedDelta - delta) < 0.01;

        console.log(`  Ranking changes count: ${changes.length}`);
        console.log(`  Sum of all changes: ${calculatedDelta.toFixed(2)}`);
        console.log(`  Delta match: ${deltaMatches ? '✅ YES' : '❌ NO'}`);
      }
    }

    console.log('\n');

    // 5. Article Processing Verification
    console.log('5. ARTICLE PROCESSING VERIFICATION:');
    console.log('-'.repeat(80));
    
    const juneArticles = await db.select({
      count: sql<number>`count(*)::int`
    })
    .from(articles)
    .where(gte(articles.publishedAt, new Date('2025-06-01')));
    
    const juneCount = juneArticles[0].count;
    console.log(`Articles from June 2025 onwards: ${juneCount}`);
    
    const articlesWithChanges = await db.select({
      articleId: articleRankingsChanges.articleId,
      changeCount: sql<number>`count(*)::int`
    })
    .from(articleRankingsChanges)
    .groupBy(articleRankingsChanges.articleId);
    
    console.log(`Articles with ranking changes: ${articlesWithChanges.length}`);
    
    const recentArticles = await db.select({
      id: articles.id,
      title: articles.title,
      publishedAt: articles.publishedAt,
      processedForRankings: articles.processedForRankings
    })
    .from(articles)
    .where(gte(articles.publishedAt, new Date('2025-06-01')))
    .orderBy(articles.publishedAt)
    .limit(5);
    
    console.log('\nRecent articles sample:');
    recentArticles.forEach(article => {
      const titlePreview = article.title ? article.title.substring(0, 50) : 'No title';
      const date = article.publishedAt ? new Date(article.publishedAt).toLocaleDateString() : 'No date';
      console.log(`  - ${titlePreview}...`);
      console.log(`    Date: ${date}, Processed: ${article.processedForRankings ? 'YES' : 'NO'}`);
    });

    console.log('\n');

    // 6. Summary Statistics
    console.log('6. SUMMARY STATISTICS:');
    console.log('-'.repeat(80));
    
    const scoreStats = await db.select({
      minScore: sql<number>`min(${tools.currentScore})::float`,
      maxScore: sql<number>`max(${tools.currentScore})::float`,
      avgScore: sql<number>`avg(${tools.currentScore})::float`,
      minBaseline: sql<number>`min(${tools.baselineScore})::float`,
      maxBaseline: sql<number>`max(${tools.baselineScore})::float`,
      minDelta: sql<number>`min(${tools.deltaScore})::float`,
      maxDelta: sql<number>`max(${tools.deltaScore})::float`
    })
    .from(tools);
    
    const stats = scoreStats[0];
    console.log('Score Ranges:');
    const minScore = stats.minScore ? parseFloat(String(stats.minScore)).toFixed(2) : 'N/A';
    const maxScore = stats.maxScore ? parseFloat(String(stats.maxScore)).toFixed(2) : 'N/A';
    const avgScore = stats.avgScore ? parseFloat(String(stats.avgScore)).toFixed(2) : 'N/A';
    const minBaseline = stats.minBaseline ? parseFloat(String(stats.minBaseline)).toFixed(2) : 'N/A';
    const maxBaseline = stats.maxBaseline ? parseFloat(String(stats.maxBaseline)).toFixed(2) : 'N/A';
    const minDelta = stats.minDelta ? parseFloat(String(stats.minDelta)).toFixed(2) : 'N/A';
    const maxDelta = stats.maxDelta ? parseFloat(String(stats.maxDelta)).toFixed(2) : 'N/A';
    console.log(`  Current Scores: ${minScore} - ${maxScore} (avg: ${avgScore})`);
    console.log(`  Baseline Scores: ${minBaseline} - ${maxBaseline}`);
    console.log(`  Delta Scores: ${minDelta} - ${maxDelta}`);
    
    console.log('\n');
    
    // Final Summary
    console.log('=== VERIFICATION SUMMARY ===');
    console.log('-'.repeat(80));
    console.log(`✓ Total tools: ${allTools.length}`);
    console.log(`✓ Tools with baseline: ${toolsWithBaseline.length}`);
    console.log(`✓ Tools with deltas: ${toolsWithDelta.length}`);
    console.log(`✓ Calculation errors: ${calculationErrors}`);
    console.log(`✓ Total ranking changes: ${changeCount}`);
    console.log(`✓ Articles from June 2025: ${juneCount}`);
    console.log(`✓ Articles with changes: ${articlesWithChanges.length}`);
    
    const isHealthy = calculationErrors === 0 && 
                      toolsWithBaseline.length > 0 && 
                      changeCount > 0 && 
                      baselineVersion.length > 0;
    
    console.log('\n');
    if (isHealthy) {
      console.log('✅ SYSTEM STATUS: HEALTHY - Ready for production deployment');
    } else {
      console.log('⚠️  SYSTEM STATUS: Issues detected - Review errors above');
    }
    
    console.log('\n=== VERIFICATION COMPLETE ===');

  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  }
}

verifyBaselineSystem()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
