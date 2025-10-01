#!/usr/bin/env npx tsx

import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import chalk from 'chalk';

// Load environment variables
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-key';

// Check if showing help
const showHelp = process.argv.includes('--help');
if (showHelp) {
  // Skip env check for help display
} else if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.error(chalk.red('❌ Missing Supabase environment variables'));
  console.log(chalk.yellow('\n💡 This script requires Supabase configuration in .env.local'));
  console.log(chalk.gray('   Required variables:'));
  console.log(chalk.gray('   - NEXT_PUBLIC_SUPABASE_URL'));
  console.log(chalk.gray('   - NEXT_PUBLIC_SUPABASE_ANON_KEY'));
  console.log(chalk.gray('   - SUPABASE_SERVICE_ROLE_KEY (for --commit mode)'));
  console.log(chalk.cyan('\n   Use --help to see usage information without env vars'));
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Read the real article
const articlePath = '/Users/masa/Downloads/ai-news-upates.md';
let articleContent: string;

try {
  articleContent = fs.readFileSync(articlePath, 'utf-8');
  console.log(chalk.green(`✅ Successfully read article from ${articlePath}`));
  console.log(chalk.gray(`📄 Article length: ${articleContent.length} characters\n`));
} catch (error) {
  console.error(chalk.red(`❌ Failed to read article: ${error}`));
  process.exit(1);
}

// Tool normalization map (simulates what the AI would do)
const TOOL_NORMALIZATIONS: Record<string, string> = {
  'GPT-5': 'OpenAI GPT-5',
  'GPT5': 'OpenAI GPT-5',
  'Warp Code': 'Warp Code',
  'Cursor': 'Cursor',
  'Anysphere': 'Cursor', // Company name to tool name
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
  'Mercor': 'Mercor'
};

// Extract tools from content (simple pattern matching)
function extractTools(content: string): Array<{original_name: string, normalized_name: string, context: string}> {
  const tools: Array<{original_name: string, normalized_name: string, context: string}> = [];
  const foundTools = new Set<string>();

  // Look for tool mentions in the content
  const patterns = [
    /OpenAI released \*\*([^*]+)\*\*/g,
    /Warp launched "([^"]+)"/g,
    /makers of ([A-Za-z]+)\)/g,
    /Switching from ([A-Za-z]+)/g,
    /([A-Za-z]+ (?:AI|Code|Copilot|Builder|Platform))/g,
    /\b(GPT-\d+|Cursor|Windsurf|Greptile|CodeRabbit|Graphite|Mercor)\b/g
  ];

  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const toolName = match[1].trim();
      const normalized = TOOL_NORMALIZATIONS[toolName] || toolName;

      if (!foundTools.has(normalized)) {
        foundTools.add(normalized);

        // Extract context (surrounding text)
        const startIdx = Math.max(0, match.index - 50);
        const endIdx = Math.min(content.length, match.index + toolName.length + 100);
        const context = content.substring(startIdx, endIdx)
          .replace(/\n/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        tools.push({
          original_name: toolName,
          normalized_name: normalized,
          context: context
        });
      }
    }
  });

  return tools;
}

// Generate mock AI analysis based on article content
function generateMockAnalysis(content: string) {
  const tools = extractTools(content);

  // Detect categories based on content
  const categories: Record<string, number> = {
    'code-generation': 0,
    'code-review': 0,
    'development-tools': 0,
    'enterprise-platforms': 0,
    'ai-assistants': 0
  };

  // Score categories based on keywords
  if (content.includes('code generation') || content.includes('GPT-5')) {
    categories['code-generation'] = 8;
  }
  if (content.includes('code review') || content.includes('Greptile') || content.includes('CodeRabbit')) {
    categories['code-review'] = 7;
  }
  if (content.includes('Warp') || content.includes('Cursor')) {
    categories['development-tools'] = 8;
  }
  if (content.includes('Salesforce') || content.includes('ServiceNow') || content.includes('enterprise')) {
    categories['enterprise-platforms'] = 6;
  }
  if (content.includes('Copilot') || content.includes('assistant')) {
    categories['ai-assistants'] = 7;
  }

  // Extract funding information
  const fundingInfo: Array<any> = [];

  const fundingPatterns = [
    /([A-Za-z]+) (?:is )?(?:rumored to be )?eyeing a? \$?([0-9]+[BMK]\+?) valuation/gi,
    /([A-Za-z]+) in talks for \$([0-9]+[MK]) Series ([A-Z])/gi,
    /([A-Za-z]+).*valuation.*\$([0-9]+[BMK])/gi
  ];

  fundingPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      fundingInfo.push({
        company: match[1],
        amount: match[2] ? '$' + match[2] : null,
        valuation: match[2] && match[0].includes('valuation') ? '$' + match[2] : null,
        round: match[3] || null
      });
    }
  });

  // Analyze sentiment
  const positiveWords = (content.match(/boost|improve|strengthen|expand|new|launch|growth/gi) || []).length;
  const negativeWords = (content.match(/fail|challenge|pressure|negative|skeptic|issue/gi) || []).length;
  const neutralWords = (content.match(/experiment|trial|test|mixed/gi) || []).length;

  let overall = 'neutral';
  if (positiveWords > negativeWords * 2) overall = 'positive';
  else if (negativeWords > positiveWords * 2) overall = 'negative';
  else if (neutralWords > 3) overall = 'mixed';
  else if (positiveWords > negativeWords) overall = 'mixed-positive';

  return {
    tools_mentioned: tools,
    categories: categories,
    funding_info: fundingInfo.slice(0, 5), // Limit to top 5
    sentiment: {
      overall: overall,
      innovation_score: Math.min(9, 5 + Math.floor(positiveWords / 3)),
      adoption_score: Math.min(8, 4 + Math.floor((75 / 10))) // Based on "75% have tried" in article
    },
    key_trends: [
      'Rapid tool proliferation with new AI models',
      'High experimentation but low full adoption rates',
      'Focus on transparency and developer control',
      'Funding pressure on AI coding startups'
    ],
    metrics: {
      tools_detected: tools.length,
      positive_mentions: positiveWords,
      negative_mentions: negativeWords,
      funding_rounds: fundingInfo.length
    }
  };
}

// Display formatted analysis results
function displayAnalysis(analysis: any) {
  console.log(chalk.yellow('\n📊 Mock AI Analysis Results:'));
  console.log(chalk.gray('─'.repeat(60)));

  // Tools section
  console.log(chalk.cyan('\n🛠️  Tools Detected & Normalized:'));
  if (analysis.tools_mentioned && analysis.tools_mentioned.length > 0) {
    analysis.tools_mentioned.forEach((tool: any) => {
      const isNormalized = tool.normalized_name !== tool.original_name;
      const arrow = isNormalized ? chalk.green(' → ') : chalk.gray(' = ');
      console.log(`  ${chalk.white(tool.original_name)}${arrow}${chalk.yellow(tool.normalized_name)}`);
    });
  } else {
    console.log(chalk.gray('  No tools detected'));
  }

  // Categories section
  console.log(chalk.cyan('\n📁 Category Scores:'));
  Object.entries(analysis.categories).forEach(([cat, score]) => {
    if (score as number > 0) {
      const bar = '█'.repeat(score as number) + '░'.repeat(10 - (score as number));
      console.log(`  ${cat.padEnd(20)} ${bar} ${chalk.yellow(score)}/10`);
    }
  });

  // Funding section
  if (analysis.funding_info && analysis.funding_info.length > 0) {
    console.log(chalk.cyan('\n💰 Funding Information:'));
    analysis.funding_info.forEach((info: any) => {
      let fundingStr = `  ${chalk.white(info.company)}:`;
      if (info.amount) fundingStr += chalk.green(` ${info.amount}`);
      if (info.round) fundingStr += chalk.blue(` (${info.round})`);
      if (info.valuation) fundingStr += chalk.yellow(` @ ${info.valuation}`);
      console.log(fundingStr);
    });
  }

  // Sentiment section
  console.log(chalk.cyan('\n😊 Sentiment Analysis:'));
  const sentimentEmoji = {
    'positive': '😄',
    'mixed-positive': '🙂',
    'neutral': '😐',
    'mixed': '🤔',
    'negative': '😟'
  }[analysis.sentiment.overall] || '😐';

  console.log(`  Overall: ${sentimentEmoji} ${chalk.yellow(analysis.sentiment.overall)}`);
  console.log(`  Innovation Score: ${chalk.blue('⭐'.repeat(analysis.sentiment.innovation_score))} (${analysis.sentiment.innovation_score}/10)`);
  console.log(`  Adoption Score: ${chalk.blue('📈'.repeat(analysis.sentiment.adoption_score))} (${analysis.sentiment.adoption_score}/10)`);

  // Metrics section
  if (analysis.metrics) {
    console.log(chalk.cyan('\n📈 Analysis Metrics:'));
    console.log(`  Tools Detected: ${chalk.white(analysis.metrics.tools_detected)}`);
    console.log(`  Positive Mentions: ${chalk.green(analysis.metrics.positive_mentions)}`);
    console.log(`  Negative Mentions: ${chalk.red(analysis.metrics.negative_mentions)}`);
    console.log(`  Funding Rounds: ${chalk.yellow(analysis.metrics.funding_rounds)}`);
  }

  // Trends section
  if (analysis.key_trends && analysis.key_trends.length > 0) {
    console.log(chalk.cyan('\n🔮 Key Trends Identified:'));
    analysis.key_trends.forEach((trend: string, idx: number) => {
      console.log(`  ${idx + 1}. ${chalk.gray(trend)}`);
    });
  }
}

// Process and store in database
async function processArticle(analysis: any, dryRun: boolean = true) {
  console.log(chalk.blue('\n📥 Processing Article for Database'));
  console.log(chalk.gray('─'.repeat(60)));

  if (dryRun) {
    console.log(chalk.yellow('🔍 DRY RUN MODE - No database changes will be made\n'));
  }

  // Simulate article processing
  const articleData = {
    title: 'AI Coding Tools Update - January 2025',
    url: 'https://example.com/ai-news-test-' + Date.now(),
    content: articleContent.substring(0, 1000) + '...', // Truncated for display
    source_name: 'AI News Weekly (Mock)',
    author: 'Simple Test Script',
    published_date: new Date().toISOString(),
    ai_analysis: analysis,
    ingested_at: new Date().toISOString()
  };

  console.log(chalk.cyan('📄 Article Data:'));
  console.log(`  Title: ${chalk.white(articleData.title)}`);
  console.log(`  Source: ${chalk.white(articleData.source_name)}`);
  console.log(`  Tools Found: ${chalk.yellow(analysis.tools_mentioned.length)}`);

  if (!dryRun) {
    try {
      // Insert article
      const { data: article, error: articleError } = await supabase
        .from('news_articles')
        .insert(articleData)
        .select()
        .single();

      if (articleError) throw articleError;

      console.log(chalk.green(`\n✅ Article saved to database!`));
      console.log(`  ID: ${chalk.white(article.id)}`);

      // Process tool mentions
      let toolsProcessed = 0;
      for (const tool of analysis.tools_mentioned) {
        // Check if tool exists in database
        const { data: existingTool } = await supabase
          .from('ai_tools')
          .select('id, tool_name, category')
          .eq('tool_name', tool.normalized_name)
          .single();

        if (existingTool) {
          // Create tool mention
          const mentionData = {
            article_id: article.id,
            tool_id: existingTool.id,
            sentiment_score: analysis.sentiment.innovation_score / 10,
            impact_score: Math.random() * 5 + 5, // Mock impact score
            mention_context: tool.context
          };

          const { error: mentionError } = await supabase
            .from('article_tool_mentions')
            .insert(mentionData);

          if (!mentionError) {
            toolsProcessed++;
            console.log(`  ✓ Linked: ${chalk.yellow(tool.normalized_name)}`);
          }
        } else {
          console.log(`  ⚠️  Tool not in database: ${chalk.gray(tool.normalized_name)}`);
        }
      }

      console.log(chalk.green(`\n✅ Processing complete!`));
      console.log(`  Tools Processed: ${chalk.yellow(toolsProcessed)}/${analysis.tools_mentioned.length}`);

      return article.id;
    } catch (error) {
      console.error(chalk.red(`\n❌ Database error: ${error}`));
      return null;
    }
  } else {
    // Dry run simulation
    console.log(chalk.cyan('\n🔄 Simulated Database Operations:'));
    console.log('  1. INSERT INTO news_articles');
    console.log('  2. CREATE article_tool_mentions for each tool');
    console.log('  3. UPDATE ranking scores (if implemented)');

    console.log(chalk.cyan('\n📊 Expected Impact:'));
    analysis.tools_mentioned.forEach((tool: any) => {
      const impactScore = (Math.random() * 5 + 5).toFixed(2);
      console.log(`  ${chalk.white(tool.normalized_name)}: +${chalk.green(impactScore)} points`);
    });
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const showHelp = args.includes('--help');

  // Show help immediately if requested
  if (showHelp) {
    console.log(chalk.cyan(`
📚 Simple Article Test Script (No API Key Required)

This script demonstrates the article processing workflow using mock AI analysis.
It reads the real article but generates analysis locally without API calls.

Usage:
  npx tsx scripts/test-article-simple.ts [options]

Options:
  --commit   Actually save to database (default: dry-run)
  --verbose  Show detailed processing information
  --help     Show this help message

Examples:
  # Dry run with mock analysis
  npx tsx scripts/test-article-simple.ts

  # Commit to database
  npx tsx scripts/test-article-simple.ts --commit

  # Verbose output
  npx tsx scripts/test-article-simple.ts --verbose

Features:
  ✅ No API key required
  ✅ Tool detection and normalization
  ✅ Category scoring
  ✅ Sentiment analysis
  ✅ Funding information extraction
  ✅ Database simulation
    `));
    process.exit(0);
  }

  // Parse other arguments after help check
  const dryRun = !args.includes('--commit');
  const verbose = args.includes('--verbose');

  console.log(chalk.magenta('\n' + '='.repeat(60)));
  console.log(chalk.magenta.bold('🧪 AI Power Ranking - Simple Article Test'));
  console.log(chalk.magenta('='.repeat(60)));
  console.log(chalk.gray(`Mode: ${dryRun ? 'DRY RUN' : 'COMMIT'}`));
  console.log(chalk.gray('Using: Mock AI Analysis (No API Required)\n'));

  // Generate mock analysis
  console.log(chalk.blue('🤖 Generating Mock AI Analysis...'));
  const analysis = generateMockAnalysis(articleContent);

  // Display results
  displayAnalysis(analysis);

  // Show raw content extraction if verbose
  if (verbose) {
    console.log(chalk.cyan('\n📝 Raw Content Extraction:'));
    console.log(chalk.gray('─'.repeat(60)));
    console.log(chalk.gray(articleContent.substring(0, 500) + '...'));
  }

  // Process article
  await processArticle(analysis, dryRun);

  // Summary
  console.log(chalk.magenta('\n' + '='.repeat(60)));
  console.log(chalk.green('✨ Test Complete!'));
  console.log(chalk.magenta('='.repeat(60)));

  console.log(chalk.cyan('\n📊 Summary:'));
  console.log(`  • Article Size: ${chalk.white(articleContent.length)} characters`);
  console.log(`  • Tools Found: ${chalk.yellow(analysis.tools_mentioned.length)}`);
  console.log(`  • Categories: ${chalk.blue(Object.keys(analysis.categories).filter(k => analysis.categories[k] > 0).length)}`);
  console.log(`  • Funding Rounds: ${chalk.green(analysis.funding_info.length)}`);
  console.log(`  • Overall Sentiment: ${chalk.yellow(analysis.sentiment.overall)}`);

  if (!dryRun) {
    console.log(chalk.green('\n✅ Data has been saved to the database'));
  } else {
    console.log(chalk.yellow('\n💡 Run with --commit to save to database'));
  }
}

// Run the test
main().catch((error) => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});