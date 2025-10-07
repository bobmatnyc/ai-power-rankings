#!/usr/bin/env node

/**
 * Apply Incremental Updates Script
 * Processes articles from June 2025 onwards and applies their impact as delta modifications
 * to the May 2025 baseline snapshot.
 *
 * This script:
 * 1. Identifies all articles published after May 31, 2025
 * 2. For each article, analyzes its tool mentions and impact
 * 3. Accumulates delta scores for each affected tool
 * 4. Updates current_score = baseline_score + delta_score
 * 5. Tracks all changes in article_rankings_changes table
 */

import { closeDb, getDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { articles, articleRankingsChanges } from "@/lib/db/article-schema";
import { eq, gte, and, sql } from "drizzle-orm";
import { ArticleIngestionService, AIAnalyzer, ContentExtractor, RankingsCalculator, ToolMapper } from "@/lib/services/article-ingestion.service";

interface ToolScoreFactors {
  marketTraction: number;
  technicalCapability: number;
  developerAdoption: number;
  developmentVelocity: number;
  platformResilience: number;
  communitySentiment: number;
  overallScore: number;
}

interface ProcessingStats {
  articlesProcessed: number;
  articlesSkipped: number;
  articlesWithExistingChanges: number;
  articlesWithNewChanges: number;
  toolsAffected: Set<string>;
  totalScoreChanges: number;
  errors: Array<{ articleId: string; error: string }>;
  scoreChanges: {
    min: number;
    max: number;
    total: number;
    count: number;
  };
}

interface ArticleToolMention {
  tool: string;
  context: string;
  sentiment: number;
  relevance: number;
}

/**
 * Calculate delta score impact from article tool mentions
 */
function calculateDeltaFromMention(
  mention: ArticleToolMention,
  importanceScore: number,
  currentDelta: ToolScoreFactors
): Partial<ToolScoreFactors> {
  const delta: Partial<ToolScoreFactors> = {};

  // Base impact calculation
  const baseImpact = mention.relevance * mention.sentiment * (importanceScore / 10);

  // Distribute impact across factors based on context
  const contextLower = mention.context.toLowerCase();

  // Market Traction impacts
  if (contextLower.includes("funding") || contextLower.includes("revenue") || contextLower.includes("users")) {
    delta.marketTraction = baseImpact * 3;
  }

  // Technical Capability impacts
  if (contextLower.includes("benchmark") || contextLower.includes("performance") || contextLower.includes("capability")) {
    delta.technicalCapability = baseImpact * 3;
  }

  // Developer Adoption impacts
  if (contextLower.includes("adoption") || contextLower.includes("developers") || contextLower.includes("community")) {
    delta.developerAdoption = baseImpact * 3;
  }

  // Development Velocity impacts
  if (contextLower.includes("release") || contextLower.includes("launch") || contextLower.includes("update")) {
    delta.developmentVelocity = baseImpact * 3;
  }

  // Platform Resilience impacts
  if (contextLower.includes("acquisition") || contextLower.includes("partnership") || contextLower.includes("enterprise")) {
    delta.platformResilience = baseImpact * 3;
  }

  // Community Sentiment impacts (always affected)
  delta.communitySentiment = baseImpact * 2;

  // Calculate overall delta as weighted average of factor deltas
  const factorCount = Object.keys(delta).length;
  if (factorCount > 0) {
    const totalImpact = Object.values(delta).reduce((sum, val) => sum + val, 0);
    delta.overallScore = totalImpact / factorCount;
  }

  return delta;
}

/**
 * Accumulate deltas - adds new deltas to existing ones
 */
function accumulateDelta(
  currentDelta: ToolScoreFactors,
  newDelta: Partial<ToolScoreFactors>
): ToolScoreFactors {
  return {
    marketTraction: (currentDelta.marketTraction || 0) + (newDelta.marketTraction || 0),
    technicalCapability: (currentDelta.technicalCapability || 0) + (newDelta.technicalCapability || 0),
    developerAdoption: (currentDelta.developerAdoption || 0) + (newDelta.developerAdoption || 0),
    developmentVelocity: (currentDelta.developmentVelocity || 0) + (newDelta.developmentVelocity || 0),
    platformResilience: (currentDelta.platformResilience || 0) + (newDelta.platformResilience || 0),
    communitySentiment: (currentDelta.communitySentiment || 0) + (newDelta.communitySentiment || 0),
    overallScore: (currentDelta.overallScore || 0) + (newDelta.overallScore || 0),
  };
}

/**
 * Calculate current score from baseline + delta
 */
function calculateCurrentScore(
  baseline: ToolScoreFactors,
  delta: ToolScoreFactors
): ToolScoreFactors {
  return {
    marketTraction: Math.max(0, Math.min(100, (baseline.marketTraction || 0) + (delta.marketTraction || 0))),
    technicalCapability: Math.max(0, Math.min(100, (baseline.technicalCapability || 0) + (delta.technicalCapability || 0))),
    developerAdoption: Math.max(0, Math.min(100, (baseline.developerAdoption || 0) + (delta.developerAdoption || 0))),
    developmentVelocity: Math.max(0, Math.min(100, (baseline.developmentVelocity || 0) + (delta.developmentVelocity || 0))),
    platformResilience: Math.max(0, Math.min(100, (baseline.platformResilience || 0) + (delta.platformResilience || 0))),
    communitySentiment: Math.max(0, Math.min(100, (baseline.communitySentiment || 0) + (delta.communitySentiment || 0))),
    overallScore: Math.max(0, Math.min(100, (baseline.overallScore || 0) + (delta.overallScore || 0))),
  };
}

/**
 * Process a single article and apply its impact
 */
async function processArticle(
  db: NonNullable<ReturnType<typeof getDb>>,
  article: any,
  stats: ProcessingStats,
  dryRun: boolean
): Promise<void> {
  try {
    console.log(`\n📰 Processing article: ${article.title}`);
    console.log(`   Published: ${article.publishedDate?.toISOString().split('T')[0]}`);
    console.log(`   ID: ${article.id}`);

    // Check if this article already has ranking changes recorded
    const existingChanges = await db
      .select()
      .from(articleRankingsChanges)
      .where(eq(articleRankingsChanges.articleId, article.id));

    if (existingChanges && existingChanges.length > 0) {
      console.log(`   ⏭️  Already processed (${existingChanges.length} changes recorded)`);
      stats.articlesSkipped++;
      stats.articlesWithExistingChanges++;
      return;
    }

    // Get tool mentions from article
    const toolMentions = article.toolMentions as ArticleToolMention[] | null;

    if (!toolMentions || toolMentions.length === 0) {
      console.log(`   ⏭️  No tool mentions found`);
      stats.articlesSkipped++;
      return;
    }

    console.log(`   🔍 Found ${toolMentions.length} tool mentions`);

    // Process each tool mention
    const changesToSave: any[] = [];
    let articleAffectedTools = 0;

    for (const mention of toolMentions) {
      // Normalize tool name
      const normalizedName = ToolMapper.normalizeTool(mention.tool);

      // Find tool in database by name
      const toolResults = await db
        .select()
        .from(tools)
        .where(eq(tools.name, normalizedName))
        .limit(1);

      const tool = toolResults[0];

      if (!tool) {
        console.log(`   ⚠️  Tool not found in database: ${normalizedName} (original: ${mention.tool})`);
        continue;
      }

      // Get current scores
      const baseline = (tool.baselineScore as ToolScoreFactors) || {
        marketTraction: 50,
        technicalCapability: 50,
        developerAdoption: 50,
        developmentVelocity: 50,
        platformResilience: 50,
        communitySentiment: 50,
        overallScore: 50,
      };

      const currentDelta = (tool.deltaScore as ToolScoreFactors) || {
        marketTraction: 0,
        technicalCapability: 0,
        developerAdoption: 0,
        developmentVelocity: 0,
        platformResilience: 0,
        communitySentiment: 0,
        overallScore: 0,
      };

      const oldCurrentScore = (tool.currentScore as ToolScoreFactors) || baseline;

      // Calculate impact of this mention
      const mentionDelta = calculateDeltaFromMention(
        mention,
        article.importanceScore || 5,
        currentDelta
      );

      // Accumulate the new delta
      const newDelta = accumulateDelta(currentDelta, mentionDelta);

      // Calculate new current score
      const newCurrentScore = calculateCurrentScore(baseline, newDelta);

      const scoreChange = newCurrentScore.overallScore - oldCurrentScore.overallScore;

      console.log(`   📊 ${tool.name}:`);
      console.log(`      Sentiment: ${mention.sentiment.toFixed(2)}, Relevance: ${mention.relevance.toFixed(2)}`);
      console.log(`      Delta change: ${mentionDelta.overallScore?.toFixed(2) || 0}`);
      console.log(`      Old score: ${oldCurrentScore.overallScore.toFixed(1)} → New score: ${newCurrentScore.overallScore.toFixed(1)}`);
      console.log(`      Change: ${scoreChange > 0 ? '+' : ''}${scoreChange.toFixed(1)}`);

      if (!dryRun) {
        // Update tool scores in database
        await db
          .update(tools)
          .set({
            deltaScore: newDelta,
            currentScore: newCurrentScore,
            scoreUpdatedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(tools.id, tool.id));
      }

      // Record the change
      const change = {
        articleId: article.id,
        toolId: tool.id,
        toolName: tool.name,
        metricChanges: {
          baseline,
          oldDelta: currentDelta,
          newDelta,
          mentionDelta,
          mention: {
            sentiment: mention.sentiment,
            relevance: mention.relevance,
            context: mention.context.substring(0, 200),
          },
        },
        oldScore: String(oldCurrentScore.overallScore),
        newScore: String(newCurrentScore.overallScore),
        scoreChange: String(scoreChange),
        changeType: scoreChange > 0 ? "increase" : scoreChange < 0 ? "decrease" : "no_change",
        changeReason: `Article impact: ${mention.sentiment > 0 ? 'positive' : 'negative'} sentiment (${mention.sentiment.toFixed(2)})`,
        isApplied: true,
        appliedAt: new Date(),
        rolledBack: false,
        createdAt: new Date(),
      };

      changesToSave.push(change);
      articleAffectedTools++;
      stats.toolsAffected.add(tool.name);
      stats.totalScoreChanges++;

      // Update stats
      stats.scoreChanges.min = Math.min(stats.scoreChanges.min, scoreChange);
      stats.scoreChanges.max = Math.max(stats.scoreChanges.max, scoreChange);
      stats.scoreChanges.total += scoreChange;
      stats.scoreChanges.count++;
    }

    // Save all changes for this article
    if (changesToSave.length > 0 && !dryRun) {
      await db.insert(articleRankingsChanges).values(changesToSave);
      console.log(`   ✅ Saved ${changesToSave.length} ranking changes`);
      stats.articlesWithNewChanges++;
    } else if (changesToSave.length > 0) {
      console.log(`   [DRY RUN] Would save ${changesToSave.length} ranking changes`);
      stats.articlesWithNewChanges++;
    }

    stats.articlesProcessed++;
    console.log(`   ✅ Article processed (${articleAffectedTools} tools affected)`);

  } catch (error) {
    console.error(`   ❌ Error processing article ${article.id}:`, error);
    stats.errors.push({
      articleId: article.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Main function to apply incremental updates
 */
async function applyIncrementalUpdates(options: {
  dryRun?: boolean;
  startDate?: Date;
  limit?: number;
} = {}) {
  const dryRun = options.dryRun ?? false;
  const startDate = options.startDate ?? new Date('2025-06-01T00:00:00Z');
  const limit = options.limit;

  try {
    console.log("🚀 Starting incremental update application...\n");
    console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE UPDATE'}`);
    console.log(`Start date: ${startDate.toISOString().split('T')[0]}`);
    if (limit) console.log(`Limit: ${limit} articles`);
    console.log();

    const db = getDb();
    if (!db) {
      throw new Error("Failed to get database connection");
    }

    // Initialize stats
    const stats: ProcessingStats = {
      articlesProcessed: 0,
      articlesSkipped: 0,
      articlesWithExistingChanges: 0,
      articlesWithNewChanges: 0,
      toolsAffected: new Set(),
      totalScoreChanges: 0,
      errors: [],
      scoreChanges: {
        min: Infinity,
        max: -Infinity,
        total: 0,
        count: 0,
      },
    };

    // Get articles from June 2025 onwards
    let query = db
      .select()
      .from(articles)
      .where(
        and(
          gte(articles.publishedDate, startDate),
          eq(articles.status, "active")
        )
      )
      .orderBy(articles.publishedDate); // Process chronologically

    const postMayArticles = await query;

    console.log(`📊 Found ${postMayArticles.length} articles published after ${startDate.toISOString().split('T')[0]}\n`);

    if (postMayArticles.length === 0) {
      console.log("⚠️  No articles found to process");
      return;
    }

    // Process articles in order
    const articlesToProcess = limit ? postMayArticles.slice(0, limit) : postMayArticles;

    for (const article of articlesToProcess) {
      await processArticle(db, article, stats, dryRun);
    }

    // Print summary
    console.log("\n" + "=".repeat(70));
    console.log("📈 PROCESSING SUMMARY");
    console.log("=".repeat(70));
    console.log(`Mode: ${dryRun ? 'DRY RUN (no changes saved)' : 'LIVE UPDATE'}`);
    console.log();
    console.log(`Articles found: ${postMayArticles.length}`);
    console.log(`Articles processed: ${stats.articlesProcessed}`);
    console.log(`Articles skipped: ${stats.articlesSkipped}`);
    console.log(`  - With existing changes: ${stats.articlesWithExistingChanges}`);
    console.log(`  - No tool mentions: ${stats.articlesSkipped - stats.articlesWithExistingChanges}`);
    console.log(`Articles with new changes: ${stats.articlesWithNewChanges}`);
    console.log();
    console.log(`Tools affected: ${stats.toolsAffected.size}`);
    console.log(`Total score changes: ${stats.totalScoreChanges}`);
    console.log();

    if (stats.scoreChanges.count > 0) {
      console.log("Score Change Statistics:");
      console.log(`  Min change: ${stats.scoreChanges.min > -Infinity ? stats.scoreChanges.min.toFixed(2) : 'N/A'}`);
      console.log(`  Max change: ${stats.scoreChanges.max < Infinity ? stats.scoreChanges.max.toFixed(2) : 'N/A'}`);
      console.log(`  Average change: ${(stats.scoreChanges.total / stats.scoreChanges.count).toFixed(2)}`);
      console.log();
    }

    if (stats.errors.length > 0) {
      console.log("❌ Errors encountered:");
      stats.errors.forEach((err) => {
        console.log(`  - Article ${err.articleId}: ${err.error}`);
      });
      console.log();
    }

    // Verification
    if (!dryRun && stats.articlesProcessed > 0) {
      console.log("🔍 Verification:");

      // Check tools with non-empty deltas
      const toolsWithDeltas = await db
        .select()
        .from(tools)
        .where(
          sql`jsonb_typeof(${tools.deltaScore}) = 'object' AND ${tools.deltaScore} != '{}'::jsonb`
        );

      console.log(`  Tools with delta scores: ${toolsWithDeltas.length}`);

      // Sample a few tools
      if (toolsWithDeltas.length > 0) {
        console.log("\n  Sample tools with delta scores:");
        for (const tool of toolsWithDeltas.slice(0, 5)) {
          const delta = tool.deltaScore as ToolScoreFactors;
          const current = tool.currentScore as ToolScoreFactors;
          console.log(`    - ${tool.name}: delta=${delta.overallScore?.toFixed(1)}, current=${current.overallScore?.toFixed(1)}`);
        }
      }
    }

    console.log("\n✨ Incremental update application completed!");

  } catch (error) {
    console.error("❌ Error applying incremental updates:", error);
    throw error;
  } finally {
    await closeDb();
    console.log("👋 Database connection closed");
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const limitIndex = args.indexOf("--limit");
  const limit = limitIndex >= 0 && args[limitIndex + 1] ? parseInt(args[limitIndex + 1], 10) : undefined;

  applyIncrementalUpdates({ dryRun, limit })
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { applyIncrementalUpdates };
