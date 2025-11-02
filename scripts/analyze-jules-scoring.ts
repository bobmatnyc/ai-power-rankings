#!/usr/bin/env tsx

/**
 * Analyze Google Jules Scoring Issue
 *
 * Investigates why Google Jules ranks #1 with score of 65.056
 * Compares its scoring factors with expected top tools
 */

import { closeDb, getDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { RankingEngineV73, type ToolMetricsV73 } from "@/lib/ranking-algorithm-v73";

interface DetailedScore {
  tool: string;
  slug: string;
  category: string;
  overallScore: number;
  factors: {
    agenticCapability: number;
    innovation: number;
    technicalPerformance: number;
    developerAdoption: number;
    marketTraction: number;
    businessSentiment: number;
    developmentVelocity: number;
    platformResilience: number;
  };
  tiebreakers: {
    featureCount: number;
    descriptionQuality: number;
    pricingTier: number;
    alphabeticalOrder: number;
  };
  metrics: {
    featureCount?: number;
    newsMentions?: number;
    users?: number;
    githubStars?: number;
    contextWindow?: number;
    llmProviders?: number;
    sweBenchScore?: number;
    monthlyArr?: number;
    company?: string;
  };
}

async function analyzeToolScoring(slug: string): Promise<DetailedScore | null> {
  const db = getDb();
  const toolRecords = await db.select().from(tools).where(eq(tools.slug, slug));

  if (toolRecords.length === 0) {
    console.log(`❌ Tool not found: ${slug}`);
    return null;
  }

  const tool = toolRecords[0];
  const metrics: ToolMetricsV73 = {
    tool_id: tool.tool_id,
    name: tool.name,
    slug: tool.slug,
    category: tool.category || undefined,
    status: tool.status || undefined,
    info: tool.info as any,
  };

  const engine = new RankingEngineV73();
  const score = engine.calculateToolScore(metrics);

  return {
    tool: tool.name,
    slug: tool.slug,
    category: tool.category || "unknown",
    overallScore: score.overallScore,
    factors: {
      agenticCapability: score.factorScores.agenticCapability,
      innovation: score.factorScores.innovation,
      technicalPerformance: score.factorScores.technicalPerformance,
      developerAdoption: score.factorScores.developerAdoption,
      marketTraction: score.factorScores.marketTraction,
      businessSentiment: score.factorScores.businessSentiment,
      developmentVelocity: score.factorScores.developmentVelocity,
      platformResilience: score.factorScores.platformResilience,
    },
    tiebreakers: score.tiebreakers,
    metrics: {
      featureCount: metrics.info?.features?.length,
      newsMentions: metrics.info?.metrics?.news_mentions,
      users: metrics.info?.metrics?.users,
      githubStars: metrics.info?.metrics?.github_stars,
      contextWindow: metrics.info?.technical?.max_context_window || metrics.info?.technical?.context_window,
      llmProviders: metrics.info?.technical?.llm_providers?.length,
      sweBenchScore: metrics.info?.metrics?.swe_bench?.verified || metrics.info?.metrics?.swe_bench?.lite,
      monthlyArr: metrics.info?.metrics?.monthly_arr,
      company: metrics.info?.company,
    },
  };
}

function printDetailedScore(score: DetailedScore) {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`📊 ${score.tool} (${score.slug})`);
  console.log(`${"=".repeat(80)}`);
  console.log(`Category: ${score.category}`);
  console.log(`Overall Score: ${score.overallScore.toFixed(3)}`);

  console.log(`\n🎯 Factor Scores (0-100):`);
  console.log(`─`.repeat(80));
  Object.entries(score.factors).forEach(([factor, value]) => {
    const weight = getFactorWeight(factor);
    const weighted = value * weight;
    console.log(`  ${factor.padEnd(25)} ${value.toFixed(2).padStart(6)} × ${weight.toFixed(3)} = ${weighted.toFixed(3)}`);
  });

  console.log(`\n🔢 Tiebreakers:`);
  console.log(`─`.repeat(80));
  Object.entries(score.tiebreakers).forEach(([key, value]) => {
    console.log(`  ${key.padEnd(25)} ${value.toFixed(2)}`);
  });

  console.log(`\n📈 Raw Metrics:`);
  console.log(`─`.repeat(80));
  Object.entries(score.metrics).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      const displayValue = typeof value === 'number' ? value.toLocaleString() : value;
      console.log(`  ${key.padEnd(25)} ${displayValue}`);
    }
  });
}

function getFactorWeight(factor: string): number {
  const weights: Record<string, number> = {
    agenticCapability: 0.35,
    innovation: 0.10,
    technicalPerformance: 0.10,
    developerAdoption: 0.125,
    marketTraction: 0.125,
    businessSentiment: 0.125,
    developmentVelocity: 0.05,
    platformResilience: 0.025,
  };
  return weights[factor] || 0;
}

function compareScores(scores: DetailedScore[]) {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`📊 COMPARISON TABLE`);
  console.log(`${"=".repeat(80)}\n`);

  // Overall scores
  console.log(`Overall Scores:`);
  scores.forEach(s => {
    console.log(`  ${s.tool.padEnd(20)} ${s.overallScore.toFixed(3)}`);
  });

  // Factor comparison
  console.log(`\nFactor Scores Comparison:`);
  console.log(`─`.repeat(80));

  const factorNames = Object.keys(scores[0].factors);
  factorNames.forEach(factor => {
    console.log(`\n${factor}:`);
    scores.forEach(s => {
      const value = s.factors[factor as keyof typeof s.factors];
      const weight = getFactorWeight(factor);
      const weighted = value * weight;
      console.log(`  ${s.tool.padEnd(20)} ${value.toFixed(2)} × ${weight.toFixed(3)} = ${weighted.toFixed(3)}`);
    });
  });

  // Key metrics comparison
  console.log(`\n\n${"=".repeat(80)}`);
  console.log(`📊 RAW METRICS COMPARISON`);
  console.log(`${"=".repeat(80)}\n`);

  const metricKeys = ['featureCount', 'newsMentions', 'users', 'contextWindow', 'llmProviders', 'sweBenchScore', 'monthlyArr'];

  metricKeys.forEach(key => {
    console.log(`${key}:`);
    scores.forEach(s => {
      const value = s.metrics[key as keyof typeof s.metrics];
      const display = value !== undefined && value !== null
        ? (typeof value === 'number' ? value.toLocaleString() : value)
        : 'N/A';
      console.log(`  ${s.tool.padEnd(20)} ${display}`);
    });
    console.log();
  });
}

async function main() {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`🔍 Google Jules Ranking Investigation`);
  console.log(`${"=".repeat(80)}\n`);

  const toolsToAnalyze = [
    'google-jules',
    'devin',
    'cursor',
    'github-copilot',
    'windsurf',
    'refact-ai',
  ];

  const scores: DetailedScore[] = [];

  for (const slug of toolsToAnalyze) {
    const score = await analyzeToolScoring(slug);
    if (score) {
      scores.push(score);
      printDetailedScore(score);
    }
  }

  if (scores.length > 1) {
    compareScores(scores);
  }

  // Analysis summary
  console.log(`\n${"=".repeat(80)}`);
  console.log(`🎯 ANALYSIS SUMMARY`);
  console.log(`${"=".repeat(80)}\n`);

  const jules = scores.find(s => s.slug === 'google-jules');
  if (jules) {
    console.log(`Google Jules ranks #1 with score: ${jules.overallScore.toFixed(3)}\n`);

    // Find strongest factors
    const sortedFactors = Object.entries(jules.factors)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5);

    console.log(`Top 5 Contributing Factors for Jules:`);
    sortedFactors.forEach(([factor, score]) => {
      const weight = getFactorWeight(factor);
      const weighted = score * weight;
      console.log(`  ${factor.padEnd(25)} ${score.toFixed(2)} × ${weight.toFixed(3)} = ${weighted.toFixed(3)}`);
    });

    // Compare with Cursor
    const cursor = scores.find(s => s.slug === 'cursor');
    if (cursor) {
      console.log(`\n\nScore Gap: Jules (${jules.overallScore.toFixed(3)}) vs Cursor (${cursor.overallScore.toFixed(3)}) = +${(jules.overallScore - cursor.overallScore).toFixed(3)}\n`);

      console.log(`Factor-by-Factor Comparison (Jules vs Cursor):`);
      Object.keys(jules.factors).forEach(factor => {
        const julesScore = jules.factors[factor as keyof typeof jules.factors];
        const cursorScore = cursor.factors[factor as keyof typeof cursor.factors];
        const diff = julesScore - cursorScore;
        const weight = getFactorWeight(factor);
        const weightedDiff = diff * weight;
        const symbol = diff > 0 ? '+' : '';
        console.log(`  ${factor.padEnd(25)} ${symbol}${diff.toFixed(2)} × ${weight.toFixed(3)} = ${symbol}${weightedDiff.toFixed(3)}`);
      });
    }
  }

  await closeDb();
}

main().catch(console.error);
