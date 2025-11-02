#!/usr/bin/env tsx

import { getDb, closeDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

interface ToolMetrics {
  metrics?: {
    github?: { stars?: number };
    vscode?: { installs?: number };
    npm?: { downloads_last_month?: number };
    pypi?: { downloads_last_month?: number };
  };
  info?: {
    metrics?: {
      github_stars?: number;
      users?: number;
      monthly_arr?: number;
      swe_bench?: {
        verified?: number;
        lite?: number;
        full?: number;
      };
    };
    vscode_installs?: number;
    npm_downloads?: number;
    summary?: string;
    features?: string[];
    company?: string;
    business?: {
      pricing_model?: string;
    };
  };
}

function calculateDataCompleteness(metrics: ToolMetrics) {
  const hasValue = (value: any): boolean => {
    return value !== undefined && value !== null && value > 0;
  };

  const metricsData = metrics.metrics || {}; // NEW: actual storage location

  const dataPoints = {
    // Check NEW location first, then legacy
    hasGitHubStars: hasValue(metricsData.github?.stars) ||
                    hasValue(metrics.info?.metrics?.github_stars),
    hasVSCodeInstalls: hasValue(metricsData.vscode?.installs) ||
                       hasValue(metrics.info?.vscode_installs),
    hasnpmDownloads: hasValue(metricsData.npm?.downloads_last_month) ||
                     hasValue(metrics.info?.npm_downloads),
    hasPyPIDownloads: hasValue(metricsData.pypi?.downloads_last_month),
    hasUserCount: hasValue(metrics.info?.metrics?.users),
    hasRevenue: hasValue(metrics.info?.metrics?.monthly_arr),
    hasSWEBench: hasValue(metrics.info?.metrics?.swe_bench?.verified),
    hasDescription: (metrics.info?.summary?.length || 0) > 100,
    hasFeatures: (metrics.info?.features?.length || 0) > 5,
    hasCompanyInfo: !!metrics.info?.company,
    hasPricing: !!metrics.info?.business?.pricing_model,
  };

  let score = 0;
  if (dataPoints.hasGitHubStars) score += 20;
  if (dataPoints.hasVSCodeInstalls) score += 20;
  if (dataPoints.hasnpmDownloads) score += 20;
  if (dataPoints.hasPyPIDownloads) score += 15;
  if (dataPoints.hasUserCount) score += 15;
  if (dataPoints.hasRevenue) score += 15;
  if (dataPoints.hasSWEBench) score += 15;
  if (dataPoints.hasDescription) score += 10;
  if (dataPoints.hasFeatures) score += 10;
  if (dataPoints.hasCompanyInfo) score += 10;
  if (dataPoints.hasPricing) score += 10;

  return { score: Math.min(100, score), dataPoints };
}

async function checkData() {
  const db = getDb();

  const cursor = await db.select().from(tools).where(eq(tools.slug, "cursor")).limit(1);
  const jules = await db.select().from(tools).where(eq(tools.slug, "google-jules")).limit(1);
  const copilot = await db.select().from(tools).where(eq(tools.slug, "github-copilot")).limit(1);

  console.log("\n=== CURSOR ===");
  const cursorData = cursor[0].data as any;
  const cursorResult = calculateDataCompleteness(cursorData);
  console.log("Data completeness:", cursorResult.score + "%");
  console.log("VS Code installs:", cursorData.metrics?.vscode?.installs);
  console.log("npm downloads:", cursorData.metrics?.npm?.downloads_last_month);
  console.log("Users:", cursorData.info?.metrics?.users);
  console.log("ARR:", cursorData.info?.metrics?.monthly_arr);
  console.log("Has:", Object.entries(cursorResult.dataPoints).filter(([k, v]) => v).map(([k]) => k).join(", "));

  console.log("\n=== JULES ===");
  const julesData = jules[0].data as any;
  const julesResult = calculateDataCompleteness(julesData);
  console.log("Data completeness:", julesResult.score + "%");
  console.log("VS Code installs:", julesData.metrics?.vscode?.installs);
  console.log("npm downloads:", julesData.metrics?.npm?.downloads_last_month);
  console.log("Users:", julesData.info?.metrics?.users);
  console.log("ARR:", julesData.info?.metrics?.monthly_arr);
  console.log("Has:", Object.entries(julesResult.dataPoints).filter(([k, v]) => v).map(([k]) => k).join(", "));

  console.log("\n=== COPILOT ===");
  const copilotData = copilot[0].data as any;
  const copilotResult = calculateDataCompleteness(copilotData);
  console.log("Data completeness:", copilotResult.score + "%");
  console.log("VS Code installs:", copilotData.metrics?.vscode?.installs);
  console.log("npm downloads:", copilotData.metrics?.npm?.downloads_last_month);
  console.log("Users:", copilotData.info?.metrics?.users);
  console.log("ARR:", copilotData.info?.metrics?.annual_recurring_revenue);
  console.log("Has:", Object.entries(copilotResult.dataPoints).filter(([k, v]) => v).map(([k]) => k).join(", "));

  // Get overall statistics
  console.log("\n=== OVERALL STATISTICS ===");
  const allTools = await db.select().from(tools);

  let totalTools = 0;
  let withGithub = 0;
  let withVscode = 0;
  let withNpm = 0;
  let withPypi = 0;

  for (const tool of allTools) {
    totalTools++;
    const data = tool.data as any;
    const metricsData = data.metrics || {};

    if (metricsData.github?.stars > 0) withGithub++;
    if (metricsData.vscode?.installs > 0) withVscode++;
    if (metricsData.npm?.downloads_last_month > 0) withNpm++;
    if (metricsData.pypi?.downloads_last_month > 0) withPypi++;
  }

  console.log(`Total tools: ${totalTools}`);
  console.log(`With GitHub stars: ${withGithub} (${(withGithub/totalTools*100).toFixed(1)}%)`);
  console.log(`With VS Code installs: ${withVscode} (${(withVscode/totalTools*100).toFixed(1)}%)`);
  console.log(`With npm downloads: ${withNpm} (${(withNpm/totalTools*100).toFixed(1)}%)`);
  console.log(`With PyPI downloads: ${withPypi} (${(withPypi/totalTools*100).toFixed(1)}%)`);

  await closeDb();
}

checkData();
