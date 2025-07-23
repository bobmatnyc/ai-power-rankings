/**
 * Execute July 2025 rankings with v7-fixed algorithm and dynamic velocity scores
 * Generates new rankings with velocity scores loaded from data file
 */

import * as fs from "fs";
import * as path from "path";
import { NewsRepository } from "../lib/json-db/news-repository";
import { RankingsRepository } from "../lib/json-db/rankings-repository";
import type { Tool } from "../lib/json-db/schemas";
import { ToolsRepository } from "../lib/json-db/tools-repository";
import { RankingEngineV7 } from "../lib/ranking-algorithm-v7-fixed";
import type { NewsArticle } from "../lib/ranking-news-impact";

async function executeJulyRankingsWithVelocity() {
  console.log(
    "🚀 Executing July 2025 rankings with v7-fixed algorithm and dynamic velocity scores...\n"
  );

  // Load velocity scores
  console.log("📊 Loading velocity scores...");
  const velocityScoresPath = path.join(process.cwd(), "data/velocity-scores.json");
  const velocityData = JSON.parse(fs.readFileSync(velocityScoresPath, "utf-8"));

  // Create velocity map for engine
  const velocityMap = new Map<string, number>();
  for (const item of velocityData.scores) {
    velocityMap.set(item.toolId, item.score);
  }
  console.log(`   Loaded ${velocityMap.size} velocity scores\n`);

  // Initialize repositories
  const toolsRepo = new ToolsRepository();
  const newsRepo = new NewsRepository();
  const rankingsRepo = new RankingsRepository();

  // Initialize ranking engine (it loads velocity scores automatically)
  const engine = new RankingEngineV7();

  // Load all tools
  console.log("📊 Loading tools data...");
  const tools = await toolsRepo.getAll();
  console.log(`   Found ${tools.length} tools\n`);

  // Load all news articles
  console.log("📰 Loading news articles...");
  const allNews = await newsRepo.getAll();
  console.log(`   Found ${allNews.length} news articles\n`);

  // Set current date (July 2025)
  const currentDate = new Date("2025-07-23");

  // Calculate scores for all tools
  console.log("🔧 Calculating tool scores with dynamic velocity...\n");
  const toolScores: Array<{
    tool: Tool;
    score: ReturnType<typeof engine.calculateToolScore>;
    velocityScore: number;
  }> = [];

  for (const tool of tools) {
    console.log(`   Processing: ${tool.name}`);

    // Convert tool to metrics format
    const metrics = {
      tool_id: tool.id, // Tool schema uses 'id' not 'tool_id'
      name: tool.name,
      category: tool.category,
      status: tool.status,
      info: tool.info,
      // Add optional fields that might be used
      github_stars: tool.info?.metrics?.github_stars,
      estimated_users: tool.info?.metrics?.estimated_users,
      monthly_arr: tool.info?.metrics?.monthly_arr,
    };

    // Get velocity score
    const velocityScore = velocityMap.get(tool.id) || 5;

    // Calculate score
    const score = engine.calculateToolScore(metrics, currentDate, allNews as NewsArticle[]);
    toolScores.push({ tool, score, velocityScore });

    // Log key scores for debugging
    const { agenticCapability, innovation, technicalPerformance, developmentVelocity } =
      score.factorScores;
    console.log(`      Velocity: ${velocityScore} (was: 60 static)`);
    console.log(
      `      Agentic: ${agenticCapability}, Innovation: ${innovation}, Technical: ${technicalPerformance}`
    );
    console.log(`      Development Velocity Factor: ${developmentVelocity}`);
    console.log(`      Overall Score: ${score.overallScore}\n`);
  }

  // Sort by overall score
  toolScores.sort((a, b) => b.score.overallScore - a.score.overallScore);

  // Create rankings
  console.log("\n🏆 Top 10 Rankings with Velocity Impact:\n");
  const rankings = toolScores.map((item, index) => {
    const rank = index + 1;

    if (rank <= 10) {
      console.log(`${rank}. ${item.tool.name}`);
      console.log(`   Overall Score: ${item.score.overallScore}`);
      console.log(
        `   Velocity Score: ${item.velocityScore} (${item.velocityScore >= 80 ? "🚀 High" : item.velocityScore >= 50 ? "📈 Medium" : "📉 Low"})`
      );
      console.log(`   Agentic: ${item.score.factorScores.agenticCapability}`);
      console.log(`   Innovation: ${item.score.factorScores.innovation}`);
      console.log(`   Technical: ${item.score.factorScores.technicalPerformance}`);
      console.log(`   Developer Adoption: ${item.score.factorScores.developerAdoption}`);
      console.log(`   Market Traction: ${item.score.factorScores.marketTraction}`);
      console.log(`   Business Sentiment: ${item.score.factorScores.businessSentiment}\n`);
    }

    return {
      tool_id: item.tool.id, // Tool schema uses 'id' not 'tool_id'
      rank,
      score: item.score.overallScore,
      previous_rank: null,
      trend: "stable" as const,
      factor_scores: item.score.factorScores,
      algorithm_version: "v7.0-fixed-velocity",
    };
  });

  // Save rankings for July 2025
  console.log("💾 Saving rankings to July 2025 file...");
  const julyData = {
    month: "2025-07",
    generated_at: new Date().toISOString(),
    algorithm_version: "v7.0-fixed-velocity",
    algorithm_info: {
      ...RankingEngineV7.getAlgorithmInfo(),
      velocity_integration: "Dynamic velocity scores from news-based calculation (0-100 scale)",
    },
    rankings,
  };

  const julyPath = path.join(process.cwd(), "data/json/rankings/periods/2025-07.json");
  const julyDir = path.dirname(julyPath);
  if (!fs.existsSync(julyDir)) {
    fs.mkdirSync(julyDir, { recursive: true });
  }
  fs.writeFileSync(julyPath, JSON.stringify(julyData, null, 2));
  console.log(`   Saved to: ${julyPath}\n`);

  // Update rankings index
  console.log("📑 Updating rankings index...");
  const indexPath = path.join(process.cwd(), "data/json/rankings/index.json");
  let indexData = { periods: [] as string[] };

  if (fs.existsSync(indexPath)) {
    indexData = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
  }

  if (!indexData.periods.includes("2025-07")) {
    indexData.periods.push("2025-07");
    indexData.periods.sort();
    fs.writeFileSync(indexPath, JSON.stringify(indexData, null, 2));
    console.log("   Added 2025-07 to index\n");
  }

  // Show key movers
  console.log("📊 Key Velocity-Driven Changes:\n");

  // High velocity tools
  const highVelocityTools = toolScores.filter((item) => item.velocityScore >= 80).slice(0, 5);

  console.log("🚀 High Velocity Tools (80+):");
  highVelocityTools.forEach((item) => {
    const rank = toolScores.indexOf(item) + 1;
    console.log(`   ${item.tool.name}: Velocity ${item.velocityScore}, Rank #${rank}`);
  });

  console.log("\n📉 Low Velocity Tools (<20):");
  const lowVelocityTools = toolScores.filter((item) => item.velocityScore < 20).slice(0, 5);

  lowVelocityTools.forEach((item) => {
    const rank = toolScores.indexOf(item) + 1;
    console.log(`   ${item.tool.name}: Velocity ${item.velocityScore}, Rank #${rank}`);
  });

  // Generate document with full breakdown
  console.log("\n📄 Generating results document...");
  const resultsDoc = `# AI Power Rankings - July 2025 (v7-Fixed Algorithm with Dynamic Velocity)

Generated: ${new Date().toISOString()}
Algorithm: v7.0-fixed-velocity - Dynamic velocity scores from news momentum

## Velocity Score Integration

This ranking uses dynamic velocity scores (0-100) calculated from:
- News frequency in last 30/90 days
- Recent funding, feature, and release announcements
- Overall momentum assessment

### High Velocity Tools (80+)
${highVelocityTools.map((item) => `- **${item.tool.name}**: Velocity ${item.velocityScore}`).join("\n")}

### Low Velocity Tools (<20)
${toolScores
  .filter((item) => item.velocityScore < 20)
  .slice(0, 10)
  .map((item) => `- **${item.tool.name}**: Velocity ${item.velocityScore}`)
  .join("\n")}

## Top 20 Rankings with Detailed Scores

${toolScores
  .slice(0, 20)
  .map((item, index) => {
    const rank = index + 1;
    return `### ${rank}. ${item.tool.name}
- **Category**: ${item.tool.category}
- **Overall Score**: ${item.score.overallScore}
- **Velocity Score**: ${item.velocityScore} (${item.velocityScore >= 80 ? "🚀 High momentum" : item.velocityScore >= 50 ? "📈 Medium momentum" : "📉 Low momentum"})
- **Factor Scores**:
  - Agentic Capability: ${item.score.factorScores.agenticCapability}
  - Innovation: ${item.score.factorScores.innovation}
  - Technical Performance: ${item.score.factorScores.technicalPerformance}
  - Developer Adoption: ${item.score.factorScores.developerAdoption}
  - Market Traction: ${item.score.factorScores.marketTraction}
  - Business Sentiment: ${item.score.factorScores.businessSentiment}
  - Development Velocity: ${item.score.factorScores.developmentVelocity}
  - Platform Resilience: ${item.score.factorScores.platformResilience}
`;
  })
  .join("\n")}

## Impact of Dynamic Velocity Scores

### Major Changes from Static Velocity (60)
1. **High-momentum tools** (Copilot, Windsurf, Cursor, Kiro) get significant boosts
2. **Stagnant tools** drop in rankings due to low velocity scores (5-16)
3. **More accurate representation** of current market dynamics

### Algorithm Weights
- Agentic Capability: 25%
- Innovation: 12.5%
- Technical Performance: 12.5%
- Developer Adoption: 12.5%
- Market Traction: 12.5%
- Business Sentiment: 15%
- Development Velocity: 5% (now dynamic 0-100)
- Platform Resilience: 5%
`;

  const resultsPath = path.join(process.cwd(), "docs/ALGORITHM-V7-VELOCITY-RESULTS.md");
  fs.writeFileSync(resultsPath, resultsDoc);
  console.log(`   Saved to: ${resultsPath}\n`);

  console.log("✅ July 2025 rankings with dynamic velocity complete!");
}

// Execute
executeJulyRankingsWithVelocity().catch(console.error);
