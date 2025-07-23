/**
 * Execute July 2025 rankings with v7-fixed algorithm
 * Generates new rankings with corrected scoring logic
 */

import * as fs from "fs";
import * as path from "path";
import { NewsRepository } from "../lib/json-db/news-repository";
import { RankingsRepository } from "../lib/json-db/rankings-repository";
import type { Tool } from "../lib/json-db/schemas";
import { ToolsRepository } from "../lib/json-db/tools-repository";
import { RankingEngineV7 } from "../lib/ranking-algorithm-v7-fixed";
import type { NewsArticle } from "../lib/ranking-news-impact";

async function executeJulyRankingsV7Fixed() {
  console.log("🚀 Executing July 2025 rankings with v7-fixed algorithm...\n");

  // Initialize repositories
  const toolsRepo = new ToolsRepository();
  const newsRepo = new NewsRepository();
  const rankingsRepo = new RankingsRepository();

  // Initialize ranking engine
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
  const currentDate = new Date("2025-07-22");

  // Calculate scores for all tools
  console.log("🔧 Calculating tool scores...\n");
  const toolScores: Array<{
    tool: Tool;
    score: ReturnType<typeof engine.calculateToolScore>;
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
    };

    // Calculate score
    const score = engine.calculateToolScore(metrics, currentDate, allNews as NewsArticle[]);
    toolScores.push({ tool, score });

    // Log key scores for debugging
    const { agenticCapability, innovation, technicalPerformance } = score.factorScores;
    console.log(
      `      Agentic: ${agenticCapability}, Innovation: ${innovation}, Technical: ${technicalPerformance}`
    );
    console.log(`      Overall Score: ${score.overallScore}\n`);
  }

  // Sort by overall score
  toolScores.sort((a, b) => b.score.overallScore - a.score.overallScore);

  // Create rankings
  console.log("\n🏆 Top 10 Rankings:\n");
  const rankings = toolScores.map((item, index) => {
    const rank = index + 1;

    if (rank <= 10) {
      console.log(`${rank}. ${item.tool.name}`);
      console.log(`   Overall Score: ${item.score.overallScore}`);
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
      algorithm_version: "v7.0-fixed",
    };
  });

  // Save rankings for July 2025
  console.log("💾 Saving rankings to July 2025 file...");
  const julyData = {
    month: "2025-07",
    generated_at: new Date().toISOString(),
    algorithm_version: "v7.0-fixed",
    algorithm_info: RankingEngineV7.getAlgorithmInfo(),
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

  // Generate document with full breakdown
  console.log("📄 Generating results document...");
  const resultsDoc = `# AI Power Rankings - July 2025 (v7-Fixed Algorithm)

Generated: ${new Date().toISOString()}
Algorithm: v7.0-fixed - Accurate Capability Scoring

## Algorithm Improvements

The v7-fixed algorithm corrects the following issues:
- **Agentic Capability**: Properly differentiates autonomous agents from autocomplete assistants
- **Innovation Scoring**: Better detection of breakthrough features and paradigm shifts
- **Technical Performance**: Accurate interpretation of SWE-bench scores
- **Category Differentiation**: Proper scoring based on tool categories

## Top 20 Rankings with Detailed Scores

${toolScores
  .slice(0, 20)
  .map((item, index) => {
    const rank = index + 1;
    return `### ${rank}. ${item.tool.name}
- **Category**: ${item.tool.category}
- **Overall Score**: ${item.score.overallScore}
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

## Key Changes from Previous Algorithm

### Claude Code
- Now properly scored as an autonomous agent (85+ agentic capability)
- Innovation score reflects specification-driven development paradigm
- Technical score recognizes 47.4% SWE-bench performance

### GitHub Copilot
- Correctly categorized as IDE assistant (autocomplete-focused)
- Agentic capability capped at 50 (not autonomous)
- Still scores well on adoption and market traction

### Other Notable Changes
- Windsurf Editor recognized for autonomous capabilities
- Cursor properly scored as agentic code editor
- Bolt.new categorized appropriately as app builder

## Algorithm Weights

- Agentic Capability: 25%
- Innovation: 12.5%
- Technical Performance: 12.5%
- Developer Adoption: 12.5%
- Market Traction: 12.5%
- Business Sentiment: 15%
- Development Velocity: 5%
- Platform Resilience: 5%
`;

  const resultsPath = path.join(process.cwd(), "docs/ALGORITHM-V7-FIXED-RESULTS.md");
  fs.writeFileSync(resultsPath, resultsDoc);
  console.log(`   Saved to: ${resultsPath}\n`);

  console.log("✅ July 2025 rankings with v7-fixed algorithm complete!");
}

// Execute
executeJulyRankingsV7Fixed().catch(console.error);
