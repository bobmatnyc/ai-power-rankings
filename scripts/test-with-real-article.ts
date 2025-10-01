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
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

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
  console.log(chalk.gray('   - SUPABASE_SERVICE_ROLE_KEY'));
  console.log(chalk.gray('   - OPENROUTER_API_KEY (optional, for full AI analysis)'));
  console.log(chalk.cyan('\n   Use --help to see usage information'));
  process.exit(1);
}

// Initialize Supabase client with service role key for testing
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

// Helper to make API calls
async function callAPI(endpoint: string, method: string, body?: any) {
  const url = `http://localhost:3000${endpoint}`;

  console.log(chalk.blue(`🔄 Calling ${method} ${endpoint}`));

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': 'test-key' // For testing
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await response.json();

  if (!response.ok) {
    console.error(chalk.red(`❌ API Error: ${data.error || 'Unknown error'}`));
    throw new Error(data.error || 'API call failed');
  }

  return data;
}

// Helper to display results
function displayAnalysis(analysis: any, mode: string) {
  console.log(chalk.yellow(`\n📊 Analysis Results (${mode}):`));
  console.log(chalk.gray('─'.repeat(50)));

  if (analysis.tools_mentioned && analysis.tools_mentioned.length > 0) {
    console.log(chalk.cyan('🛠️  Tools Detected:'));
    analysis.tools_mentioned.forEach((tool: any) => {
      const normalized = tool.normalized_name !== tool.original_name
        ? chalk.green(` → ${tool.normalized_name}`)
        : '';
      console.log(`  • ${chalk.white(tool.original_name)}${normalized}`);
      if (tool.context) {
        console.log(chalk.gray(`    Context: ${tool.context.substring(0, 100)}...`));
      }
    });
  }

  if (analysis.categories) {
    console.log(chalk.cyan('\n📁 Categories:'));
    Object.entries(analysis.categories).forEach(([cat, score]) => {
      if (score as number > 0) {
        console.log(`  • ${cat}: ${chalk.yellow(score as string)}`);
      }
    });
  }

  if (analysis.funding_info) {
    console.log(chalk.cyan('\n💰 Funding Information:'));
    analysis.funding_info.forEach((info: any) => {
      console.log(`  • ${chalk.white(info.company)}: ${chalk.green(info.amount || 'Undisclosed')}`);
      if (info.valuation) {
        console.log(chalk.gray(`    Valuation: ${info.valuation}`));
      }
    });
  }

  if (analysis.sentiment) {
    console.log(chalk.cyan('\n😊 Sentiment Analysis:'));
    console.log(`  • Overall: ${chalk.yellow(analysis.sentiment.overall)}`);
    console.log(`  • Innovation: ${chalk.blue(analysis.sentiment.innovation_score)}/10`);
    console.log(`  • Adoption: ${chalk.blue(analysis.sentiment.adoption_score)}/10`);
  }
}

async function displayRankingImpacts(articleId: string) {
  console.log(chalk.yellow('\n📈 Ranking Impacts:'));
  console.log(chalk.gray('─'.repeat(50)));

  // Fetch the article with its impacts
  const { data: article, error } = await supabase
    .from('news_articles')
    .select(`
      *,
      article_tool_mentions (
        *,
        ai_tool:ai_tools (
          tool_name,
          category,
          current_ranking
        )
      )
    `)
    .eq('id', articleId)
    .single();

  if (error || !article) {
    console.error(chalk.red('Failed to fetch article impacts'));
    return;
  }

  if (article.article_tool_mentions && article.article_tool_mentions.length > 0) {
    article.article_tool_mentions.forEach((mention: any) => {
      const tool = mention.ai_tool;
      console.log(`\n  📍 ${chalk.white(tool.tool_name)}`);
      console.log(`     Category: ${chalk.gray(tool.category)}`);
      console.log(`     Current Rank: ${chalk.blue('#' + tool.current_ranking)}`);
      console.log(`     Sentiment: ${chalk.yellow(mention.sentiment_score)}`);
      console.log(`     Impact Score: ${chalk.green('+' + mention.impact_score)}`);
    });
  } else {
    console.log(chalk.gray('  No tool mentions recorded'));
  }
}

async function testWorkflow(dryRun: boolean = true) {
  console.log(chalk.magenta('\n' + '='.repeat(60)));
  console.log(chalk.magenta.bold('🚀 Testing Article Ingestion Workflow'));
  console.log(chalk.magenta('='.repeat(60)));

  const hasAPIKey = !!OPENROUTER_API_KEY;
  console.log(chalk.yellow(`\n🔑 OpenRouter API Key: ${hasAPIKey ? chalk.green('Available') : chalk.red('Not Available')}`));

  try {
    // Step 1: Test analyze endpoint (with preprocessed if no API key)
    console.log(chalk.blue('\n📝 Step 1: Analyzing Article Content'));
    console.log(chalk.gray('─'.repeat(50)));

    let analysisResult;

    if (hasAPIKey) {
      // Test with full AI analysis
      console.log(chalk.cyan('Using full AI analysis...'));
      analysisResult = await callAPI('/api/news/analyze', 'POST', {
        content: articleContent,
        metadata: {
          title: 'AI Coding Tools Update - January 2025',
          source_url: 'https://example.com/ai-news',
          source_name: 'AI News Weekly'
        }
      });

      displayAnalysis(analysisResult.analysis, 'Full AI Analysis');
    } else {
      console.log(chalk.yellow('No API key, using preprocessed mode...'));
    }

    // Step 2: Test with preprocessed analysis
    console.log(chalk.blue('\n📝 Step 2: Testing Preprocessed Mode'));
    console.log(chalk.gray('─'.repeat(50)));

    const preprocessedAnalysis = {
      tools_mentioned: [
        { original_name: 'GPT-5', normalized_name: 'OpenAI GPT-5', context: 'dramatically boosts multi-step code generation' },
        { original_name: 'Warp Code', normalized_name: 'Warp Code', context: 'improving transparency and control over agentic coding' },
        { original_name: 'Cursor', normalized_name: 'Cursor', context: 'makers of Cursor' },
        { original_name: 'GitHub Copilot', normalized_name: 'GitHub Copilot', context: 'Switching from Copilot' },
        { original_name: 'Salesforce Agentforce', normalized_name: 'Salesforce Agentforce Builder', context: 'collaborative agent design and testing' },
        { original_name: 'Windsurf', normalized_name: 'Windsurf', context: 'failed sale to OpenAI and negative margins' },
        { original_name: 'Greptile', normalized_name: 'Greptile', context: 'in talks for $30M Series A' },
        { original_name: 'CodeRabbit', normalized_name: 'CodeRabbit', context: 'AI code review startups' }
      ],
      categories: {
        'code-generation': 8,
        'code-review': 6,
        'development-tools': 7,
        'enterprise-platforms': 5
      },
      funding_info: [
        { company: 'Mercor', amount: null, valuation: '$10B+' },
        { company: 'Greptile', amount: '$30M', valuation: '$180M', round: 'Series A' },
        { company: 'Anysphere (Cursor)', amount: null, valuation: null }
      ],
      sentiment: {
        overall: 'mixed-positive',
        innovation_score: 8,
        adoption_score: 6
      },
      key_trends: [
        'Rapid tool proliferation with GPT-5 setting new standards',
        'Developer experimentation high but full adoption remains low',
        'Transparency and step-by-step visibility becoming key differentiators',
        'High LLM costs pressuring startup profitability'
      ]
    };

    const preprocessedResult = await callAPI('/api/news/analyze', 'POST', {
      content: articleContent,
      metadata: {
        title: 'AI Coding Tools Update - January 2025',
        source_url: 'https://example.com/ai-news',
        source_name: 'AI News Weekly'
      },
      preprocessed_analysis: preprocessedAnalysis
    });

    displayAnalysis(preprocessedResult.analysis, 'Preprocessed');

    // Step 3: Ingest the article
    console.log(chalk.blue('\n📥 Step 3: Ingesting Article'));
    console.log(chalk.gray('─'.repeat(50)));

    const ingestResult = await callAPI('/api/news/ingest', 'POST', {
      content: articleContent,
      metadata: {
        title: 'AI Coding Tools Update - January 2025',
        source_url: 'https://example.com/ai-news-test-' + Date.now(),
        source_name: 'AI News Weekly',
        author: 'Test Script'
      },
      analysis: preprocessedResult.analysis,
      dry_run: dryRun
    });

    if (dryRun) {
      console.log(chalk.yellow('\n🔍 Dry Run Results:'));
      console.log(chalk.gray(JSON.stringify(ingestResult, null, 2)));
    } else {
      console.log(chalk.green(`\n✅ Article ingested successfully!`));
      console.log(chalk.white(`   Article ID: ${ingestResult.article.id}`));
      console.log(chalk.white(`   Tools Processed: ${ingestResult.tools_processed}`));

      // Display ranking impacts
      await displayRankingImpacts(ingestResult.article.id);

      // Step 4: Test rollback capability
      console.log(chalk.blue('\n🔄 Step 4: Testing Rollback'));
      console.log(chalk.gray('─'.repeat(50)));

      const shouldRollback = process.argv.includes('--rollback');

      if (shouldRollback) {
        console.log(chalk.yellow('Rolling back article...'));

        const rollbackResult = await callAPI('/api/news/rollback', 'POST', {
          article_id: ingestResult.article.id,
          reason: 'Testing rollback functionality'
        });

        console.log(chalk.green('✅ Rollback successful!'));
        console.log(chalk.gray(JSON.stringify(rollbackResult, null, 2)));
      } else {
        console.log(chalk.gray('To test rollback, run with --rollback flag'));
      }
    }

    // Step 5: Show cost comparison
    console.log(chalk.blue('\n💰 Step 5: Cost Analysis'));
    console.log(chalk.gray('─'.repeat(50)));

    const articleTokens = Math.ceil(articleContent.length / 4); // Rough estimate
    const fullAnalysisCost = articleTokens * 0.000003; // Example rate
    const preprocessedCost = 0; // No API call needed

    console.log(`  Article Size: ${chalk.white(articleContent.length)} characters (~${articleTokens} tokens)`);
    console.log(`  Full AI Analysis Cost: ${chalk.yellow('$' + fullAnalysisCost.toFixed(6))}`);
    console.log(`  Preprocessed Cost: ${chalk.green('$0.00')}`);
    console.log(`  Savings: ${chalk.green('$' + fullAnalysisCost.toFixed(6) + ' (100%)')}`);

  } catch (error) {
    console.error(chalk.red(`\n❌ Test failed: ${error}`));
    process.exit(1);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--commit');
  const showHelp = args.includes('--help');

  if (showHelp) {
    console.log(chalk.cyan(`
📚 Real Article Test Script

Usage:
  npx tsx scripts/test-with-real-article.ts [options]

Options:
  --commit     Actually commit changes to database (default: dry-run)
  --rollback   Test rollback after committing (requires --commit)
  --help       Show this help message

Examples:
  # Dry run (no database changes)
  npx tsx scripts/test-with-real-article.ts

  # Commit to database
  npx tsx scripts/test-with-real-article.ts --commit

  # Commit and then rollback
  npx tsx scripts/test-with-real-article.ts --commit --rollback
    `));
    process.exit(0);
  }

  console.log(chalk.cyan('\n🧪 AI Power Ranking - Real Article Test'));
  console.log(chalk.gray(`Mode: ${dryRun ? 'DRY RUN' : 'COMMIT'}`));

  await testWorkflow(dryRun);

  console.log(chalk.green('\n✨ Test completed successfully!\n'));
}

// Run the test
main().catch((error) => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});