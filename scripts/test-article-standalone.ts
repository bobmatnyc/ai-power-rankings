#!/usr/bin/env npx tsx

/**
 * Standalone Article Processing Test
 *
 * This script demonstrates the article processing workflow without any external dependencies.
 * It reads the real AI news article and shows how the system would process it.
 *
 * No database or API connections required - perfect for testing the logic.
 */

import * as fs from 'fs';
import * as path from 'path';

// Color utilities for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  white: '\x1b[37m'
};

const log = {
  error: (msg: string) => console.log(colors.red + msg + colors.reset),
  success: (msg: string) => console.log(colors.green + msg + colors.reset),
  info: (msg: string) => console.log(colors.blue + msg + colors.reset),
  warn: (msg: string) => console.log(colors.yellow + msg + colors.reset),
  debug: (msg: string) => console.log(colors.gray + msg + colors.reset),
  title: (msg: string) => console.log(colors.magenta + colors.bright + msg + colors.reset),
  cyan: (msg: string) => console.log(colors.cyan + msg + colors.reset),
  white: (msg: string) => console.log(colors.white + msg + colors.reset)
};

// Read the real article
const articlePath = '/Users/masa/Downloads/ai-news-upates.md';
let articleContent: string;

try {
  articleContent = fs.readFileSync(articlePath, 'utf-8');
  log.success(`✅ Successfully read article from ${articlePath}`);
  log.debug(`📄 Article length: ${articleContent.length} characters\n`);
} catch (error) {
  log.error(`❌ Failed to read article: ${error}`);
  log.warn('\n💡 Please ensure the article exists at: ~/Downloads/ai-news-upates.md');
  process.exit(1);
}

// Tool normalization map
const TOOL_NORMALIZATIONS: Record<string, string> = {
  'GPT-5': 'OpenAI GPT-5',
  'GPT5': 'OpenAI GPT-5',
  'Warp Code': 'Warp Code',
  'Cursor': 'Cursor',
  'Anysphere': 'Cursor',
  'GitHub Copilot': 'GitHub Copilot',
  'Copilot': 'GitHub Copilot',
  'Salesforce Agentforce': 'Salesforce Agentforce Builder',
  'Agentforce Builder': 'Salesforce Agentforce Builder',
  'Agentforce': 'Salesforce Agentforce Builder',
  'Windsurf': 'Windsurf',
  'Greptile': 'Greptile',
  'CodeRabbit': 'CodeRabbit',
  'Graphite': 'Graphite',
  'C3 AI': 'C3 AI Platform',
  'Alex Codes': 'Alex Codes',
  'Codex': 'OpenAI Codex',
  'Mercor': 'Mercor',
  'Claude': 'Claude',
  'Anthropic': 'Claude'
};

// Tool categories
const TOOL_CATEGORIES: Record<string, string> = {
  'OpenAI GPT-5': 'code-generation',
  'Warp Code': 'development-tools',
  'Cursor': 'development-tools',
  'GitHub Copilot': 'ai-assistants',
  'Salesforce Agentforce Builder': 'enterprise-platforms',
  'Windsurf': 'development-tools',
  'Greptile': 'code-review',
  'CodeRabbit': 'code-review',
  'Graphite': 'code-review',
  'C3 AI Platform': 'enterprise-platforms',
  'OpenAI Codex': 'code-generation',
  'Claude': 'ai-assistants',
  'Mercor': 'ai-training'
};

// Extract tools from content
function extractTools(content: string): Array<{original_name: string, normalized_name: string, context: string, category: string}> {
  const tools: Array<{original_name: string, normalized_name: string, context: string, category: string}> = [];
  const foundTools = new Map<string, {original: string, context: string}>();

  // Comprehensive patterns for tool extraction
  const patterns = [
    // Explicit mentions with formatting
    /\*\*([^*]+)\*\*/g,  // **Tool Name**
    /"([^"]+(?:Code|AI|Copilot|Builder|Platform|Cursor|Claude|GPT-\d+))"/g,  // "Tool Name"

    // Product launches and releases
    /(?:launched?|released?|announced?|unveiled?)\s+(?:a\s+)?(?:new\s+)?([A-Z][A-Za-z0-9\s]+(?:Code|AI|Platform|Builder))/g,
    /([A-Z][A-Za-z0-9\s]+)\s+(?:launched?|released?)/g,

    // Company/product relationships
    /makers?\s+of\s+([A-Z][A-Za-z0-9\s]+)/g,
    /([A-Z][A-Za-z0-9\s]+)\s+\((?:makers?|creators?|developers?)\s+of/g,

    // Specific tool names
    /\b(GPT-\d+|Cursor|Windsurf|Greptile|CodeRabbit|Graphite|Mercor|Claude|Copilot)\b/g,

    // Tool comparisons
    /(?:Switching|migrating|moving)\s+from\s+([A-Z][A-Za-z0-9\s]+)/g,
    /(?:alternative|competitor)\s+to\s+([A-Z][A-Za-z0-9\s]+)/g
  ];

  patterns.forEach(pattern => {
    let match;
    const regex = new RegExp(pattern);
    while ((match = regex.exec(content)) !== null) {
      if (match[1]) {
        const toolName = match[1].trim();

        // Skip if too short or too long
        if (toolName.length < 2 || toolName.length > 50) continue;

        // Skip if it's just a common word
        if (/^(the|and|for|with|from|this|that|these|those)$/i.test(toolName)) continue;

        const normalized = TOOL_NORMALIZATIONS[toolName] ||
                         TOOL_NORMALIZATIONS[toolName.replace(/\s+/g, '')] ||
                         toolName;

        // Only add if we haven't seen this normalized name yet
        if (!foundTools.has(normalized)) {
          // Extract context
          const startIdx = Math.max(0, match.index - 50);
          const endIdx = Math.min(content.length, match.index + toolName.length + 100);
          const context = content.substring(startIdx, endIdx)
            .replace(/\[.*?\]/g, '') // Remove reference markers
            .replace(/\n/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

          foundTools.set(normalized, {original: toolName, context});
        }
      }
    }
  });

  // Convert to array with categories
  foundTools.forEach((value, normalized) => {
    tools.push({
      original_name: value.original,
      normalized_name: normalized,
      context: value.context,
      category: TOOL_CATEGORIES[normalized] || 'uncategorized'
    });
  });

  return tools;
}

// Extract funding information
function extractFunding(content: string): Array<any> {
  const fundingInfo: Array<any> = [];
  const fundingPatterns = [
    /([A-Z][A-Za-z0-9\s]+)\s+(?:is\s+)?(?:rumored\s+to\s+be\s+)?eyeing\s+a?\s?\$?([0-9.,]+[BMK]\+?)\s+valuation/gi,
    /([A-Z][A-Za-z0-9\s]+)\s+in\s+talks?\s+for\s+\$([0-9.,]+[MK])\s+Series\s+([A-Z])/gi,
    /([A-Z][A-Za-z0-9\s]+).*?valuation.*?\$([0-9.,]+[BMK])/gi,
    /([A-Z][A-Za-z0-9\s]+).*?\$([0-9.,]+[MK])\s+(?:round|funding|investment)/gi
  ];

  const foundCompanies = new Set<string>();

  fundingPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const company = match[1].trim();
      if (!foundCompanies.has(company) && company.length > 2 && company.length < 30) {
        foundCompanies.add(company);
        fundingInfo.push({
          company: company,
          amount: match[2] ? '$' + match[2] : null,
          valuation: match[0].includes('valuation') && match[2] ? '$' + match[2] : null,
          round: match[3] || null
        });
      }
    }
  });

  return fundingInfo;
}

// Analyze sentiment
function analyzeSentiment(content: string) {
  const positivePatterns = /\b(boost|improve|strengthen|expand|new|launch|growth|enhance|optimize|breakthrough|innovative|leading|successful|adoption|momentum)\b/gi;
  const negativePatterns = /\b(fail|challenge|pressure|negative|skeptic|issue|problem|concern|struggle|difficult|slow|limited|risk|threat|decline)\b/gi;
  const neutralPatterns = /\b(experiment|trial|test|mixed|evaluate|assess|consider|explore|investigate)\b/gi;

  const positiveMatches = content.match(positivePatterns) || [];
  const negativeMatches = content.match(negativePatterns) || [];
  const neutralMatches = content.match(neutralPatterns) || [];

  const positiveCount = positiveMatches.length;
  const negativeCount = negativeMatches.length;
  const neutralCount = neutralMatches.length;

  // Determine overall sentiment
  let overall = 'neutral';
  const ratio = positiveCount / (negativeCount || 1);

  if (ratio > 2.5) overall = 'positive';
  else if (ratio > 1.5) overall = 'mixed-positive';
  else if (ratio < 0.4) overall = 'negative';
  else if (ratio < 0.7) overall = 'mixed-negative';
  else if (neutralCount > positiveCount + negativeCount) overall = 'neutral';
  else overall = 'mixed';

  // Calculate scores
  const innovationScore = Math.min(10, Math.floor(5 + (positiveCount - negativeCount) / 3));
  const adoptionScore = content.includes('75%') ? 7 : // From "75% have tried"
                       content.includes('adoption') ? 6 : 5;

  return {
    overall,
    positive_count: positiveCount,
    negative_count: negativeCount,
    neutral_count: neutralCount,
    innovation_score: Math.max(1, innovationScore),
    adoption_score: adoptionScore,
    sentiment_ratio: ratio.toFixed(2)
  };
}

// Extract key trends
function extractTrends(content: string): string[] {
  const trends = [];

  if (content.match(/GPT-5|breakthrough|new\s+bar/i)) {
    trends.push('New AI models setting higher performance standards');
  }
  if (content.match(/experimentation|trial|75%\s+have\s+tried/i)) {
    trends.push('High experimentation rates but low full adoption');
  }
  if (content.match(/transparency|black\s+box|step-by-step/i)) {
    trends.push('Growing demand for AI transparency and explainability');
  }
  if (content.match(/cost|margin|profitability|pressure/i)) {
    trends.push('Cost pressures affecting AI startup sustainability');
  }
  if (content.match(/enterprise|Salesforce|ServiceNow|platform/i)) {
    trends.push('Enterprise platforms integrating AI capabilities');
  }
  if (content.match(/funding|valuation|Series\s+[A-Z]|\$[0-9]+[BMK]/i)) {
    trends.push('Significant venture capital flowing into AI tools');
  }

  return trends;
}

// Generate comprehensive analysis
function analyzeArticle(content: string) {
  const tools = extractTools(content);
  const funding = extractFunding(content);
  const sentiment = analyzeSentiment(content);
  const trends = extractTrends(content);

  // Calculate category scores
  const categories: Record<string, number> = {
    'code-generation': 0,
    'code-review': 0,
    'development-tools': 0,
    'enterprise-platforms': 0,
    'ai-assistants': 0,
    'ai-training': 0
  };

  tools.forEach(tool => {
    if (tool.category in categories) {
      categories[tool.category] = Math.min(10, categories[tool.category] + 2);
    }
  });

  return {
    tools_mentioned: tools,
    categories,
    funding_info: funding,
    sentiment,
    key_trends: trends,
    statistics: {
      total_tools: tools.length,
      unique_categories: Object.values(categories).filter(v => v > 0).length,
      funding_rounds: funding.length,
      article_length: content.length,
      readability_score: Math.round(100 - (content.length / 100))
    }
  };
}

// Display analysis results
function displayAnalysis(analysis: any) {
  console.log('\n' + '='.repeat(70));
  log.title('📊 ARTICLE ANALYSIS RESULTS');
  console.log('='.repeat(70));

  // Tools Section
  log.cyan('\n🛠️  TOOLS DETECTED & NORMALIZED');
  console.log(colors.gray + '─'.repeat(50) + colors.reset);

  if (analysis.tools_mentioned.length > 0) {
    analysis.tools_mentioned.forEach((tool: any, idx: number) => {
      const isNormalized = tool.normalized_name !== tool.original_name;
      const arrow = isNormalized ? colors.green + ' → ' : colors.gray + ' = ';
      const category = colors.gray + ` [${tool.category}]` + colors.reset;

      console.log(`${idx + 1}. ${colors.white}${tool.original_name}${arrow}${colors.yellow}${tool.normalized_name}${category}`);

      if (tool.context) {
        const preview = tool.context.substring(0, 80);
        log.debug(`   Context: "${preview}..."`);
      }
    });
  } else {
    log.warn('  No tools detected');
  }

  // Categories Section
  log.cyan('\n📁 CATEGORY ANALYSIS');
  console.log(colors.gray + '─'.repeat(50) + colors.reset);

  Object.entries(analysis.categories).forEach(([category, score]) => {
    if (score as number > 0) {
      const scoreNum = score as number;
      const bar = '█'.repeat(scoreNum) + '░'.repeat(10 - scoreNum);
      const categoryFormatted = category.replace(/-/g, ' ').toUpperCase();
      console.log(`${categoryFormatted.padEnd(20)} ${colors.blue}${bar}${colors.reset} ${colors.yellow}${score}/10${colors.reset}`);
    }
  });

  // Funding Section
  if (analysis.funding_info.length > 0) {
    log.cyan('\n💰 FUNDING & VALUATIONS');
    console.log(colors.gray + '─'.repeat(50) + colors.reset);

    analysis.funding_info.forEach((info: any, idx: number) => {
      let fundingStr = `${idx + 1}. ${colors.white}${info.company}${colors.reset}:`;
      if (info.amount) fundingStr += colors.green + ` ${info.amount}` + colors.reset;
      if (info.round) fundingStr += colors.blue + ` (Series ${info.round})` + colors.reset;
      if (info.valuation) fundingStr += colors.yellow + ` valued at ${info.valuation}` + colors.reset;
      console.log(fundingStr);
    });
  }

  // Sentiment Section
  log.cyan('\n😊 SENTIMENT ANALYSIS');
  console.log(colors.gray + '─'.repeat(50) + colors.reset);

  const sentimentEmoji = {
    'positive': '😄',
    'mixed-positive': '🙂',
    'neutral': '😐',
    'mixed': '🤔',
    'mixed-negative': '😕',
    'negative': '😟'
  }[analysis.sentiment.overall] || '😐';

  console.log(`Overall Sentiment: ${sentimentEmoji} ${colors.yellow}${analysis.sentiment.overall.toUpperCase()}${colors.reset}`);
  console.log(`Positive/Negative Ratio: ${colors.blue}${analysis.sentiment.sentiment_ratio}${colors.reset}`);
  console.log(`Innovation Score: ${colors.cyan}${'⭐'.repeat(analysis.sentiment.innovation_score)}${colors.reset} (${analysis.sentiment.innovation_score}/10)`);
  console.log(`Adoption Score: ${colors.cyan}${'📈'.repeat(analysis.sentiment.adoption_score)}${colors.reset} (${analysis.sentiment.adoption_score}/10)`);
  console.log(colors.gray + `Mentions: ${colors.green}+${analysis.sentiment.positive_count}${colors.gray} | ${colors.red}-${analysis.sentiment.negative_count}${colors.gray} | ${colors.blue}~${analysis.sentiment.neutral_count}${colors.reset}`);

  // Trends Section
  if (analysis.key_trends.length > 0) {
    log.cyan('\n🔮 KEY TRENDS IDENTIFIED');
    console.log(colors.gray + '─'.repeat(50) + colors.reset);

    analysis.key_trends.forEach((trend: string, idx: number) => {
      console.log(`${idx + 1}. ${colors.gray}${trend}${colors.reset}`);
    });
  }

  // Statistics Section
  log.cyan('\n📈 ARTICLE STATISTICS');
  console.log(colors.gray + '─'.repeat(50) + colors.reset);
  console.log(`Total Tools Found: ${colors.white}${analysis.statistics.total_tools}${colors.reset}`);
  console.log(`Active Categories: ${colors.white}${analysis.statistics.unique_categories}${colors.reset}`);
  console.log(`Funding Rounds: ${colors.white}${analysis.statistics.funding_rounds}${colors.reset}`);
  console.log(`Article Length: ${colors.white}${analysis.statistics.article_length} characters${colors.reset}`);
  console.log(`Readability: ${colors.white}${analysis.statistics.readability_score}%${colors.reset}`);
}

// Simulate ranking impacts
function calculateRankingImpacts(analysis: any) {
  log.cyan('\n📊 SIMULATED RANKING IMPACTS');
  console.log(colors.gray + '─'.repeat(50) + colors.reset);

  analysis.tools_mentioned.forEach((tool: any) => {
    // Calculate impact based on sentiment and category relevance
    const baseImpact = 5;
    const sentimentBonus = analysis.sentiment.innovation_score * 0.5;
    const categoryBonus = (analysis.categories[tool.category] as number || 0) * 0.3;
    const totalImpact = (baseImpact + sentimentBonus + categoryBonus).toFixed(1);

    // Simulate current ranking
    const mockRankings: Record<string, number> = {
      'OpenAI GPT-5': 2,
      'GitHub Copilot': 1,
      'Cursor': 3,
      'Claude': 4,
      'Warp Code': 8,
      'Windsurf': 15,
      'Greptile': 12,
      'CodeRabbit': 18
    };

    const currentRank = mockRankings[tool.normalized_name] || 99;
    const projectedRank = Math.max(1, currentRank - Math.floor(Number(totalImpact) / 3));

    console.log(`\n📍 ${colors.white}${tool.normalized_name}${colors.reset}`);
    console.log(`   Category: ${colors.gray}${tool.category}${colors.reset}`);
    console.log(`   Current Rank: ${colors.blue}#${currentRank}${colors.reset}`);
    console.log(`   Impact Score: ${colors.green}+${totalImpact}${colors.reset}`);
    if (projectedRank < currentRank) {
      console.log(`   Projected Movement: ${colors.green}↑ to #${projectedRank}${colors.reset}`);
    }
  });
}

// Main execution
function main() {
  const args = process.argv.slice(2);
  const showHelp = args.includes('--help');
  const verbose = args.includes('--verbose');

  if (showHelp) {
    console.log(`
${colors.cyan}📚 STANDALONE ARTICLE ANALYSIS TEST${colors.reset}

This script analyzes an AI news article without any external dependencies.
Perfect for testing the article processing logic.

${colors.yellow}USAGE:${colors.reset}
  npx tsx scripts/test-article-standalone.ts [options]

${colors.yellow}OPTIONS:${colors.reset}
  --verbose    Show detailed processing information
  --help       Show this help message

${colors.yellow}FEATURES:${colors.reset}
  ✅ No database connection required
  ✅ No API keys needed
  ✅ Tool detection and normalization
  ✅ Sentiment analysis
  ✅ Funding extraction
  ✅ Trend identification
  ✅ Ranking impact simulation

${colors.yellow}ARTICLE SOURCE:${colors.reset}
  ~/Downloads/ai-news-upates.md
    `);
    process.exit(0);
  }

  log.title('\n🚀 STANDALONE ARTICLE PROCESSING TEST');
  console.log('='.repeat(70));

  // Analyze article
  log.info('🔍 Analyzing article content...');
  const analysis = analyzeArticle(articleContent);

  // Display results
  displayAnalysis(analysis);

  // Calculate ranking impacts
  calculateRankingImpacts(analysis);

  // Show verbose details if requested
  if (verbose) {
    log.cyan('\n📝 ARTICLE PREVIEW');
    console.log(colors.gray + '─'.repeat(50) + colors.reset);
    console.log(colors.gray + articleContent.substring(0, 500) + '...' + colors.reset);

    log.cyan('\n🔧 RAW ANALYSIS DATA');
    console.log(colors.gray + '─'.repeat(50) + colors.reset);
    console.log(JSON.stringify(analysis, null, 2));
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  log.success('✅ ANALYSIS COMPLETE!');
  console.log('='.repeat(70));

  log.cyan('\n📊 SUMMARY');
  console.log(`• Tools Identified: ${colors.yellow}${analysis.tools_mentioned.length}${colors.reset}`);
  console.log(`• Categories Active: ${colors.yellow}${analysis.statistics.unique_categories}${colors.reset}`);
  console.log(`• Funding Rounds: ${colors.yellow}${analysis.funding_info.length}${colors.reset}`);
  console.log(`• Key Trends: ${colors.yellow}${analysis.key_trends.length}${colors.reset}`);
  console.log(`• Overall Sentiment: ${colors.yellow}${analysis.sentiment.overall.toUpperCase()}${colors.reset}`);

  console.log(colors.gray + '\nRun with --verbose for detailed output' + colors.reset);
}

// Execute
main();