#!/usr/bin/env tsx

/**
 * Test script for enhanced news integration
 * Tests both quantitative metric extraction and AI-powered qualitative analysis
 */

import { extractEnhancedNewsMetrics } from '../src/lib/ranking-news-enhancer';
import { getNewsRepo } from '../src/lib/json-db';
import { config } from 'dotenv';

// Load environment variables
config();

async function testEnhancedNewsIntegration() {
  console.log('🧪 Testing Enhanced News Integration\n');

  // Check if OpenAI API key is configured
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  console.log(`📝 OpenAI API Key: ${hasOpenAI ? '✅ Configured' : '❌ Not configured'}`);
  
  if (!hasOpenAI) {
    console.log('⚠️  Set OPENAI_API_KEY in .env to enable AI qualitative analysis\n');
  }

  try {
    // Load news articles
    const newsRepo = getNewsRepo();
    const allNews = await newsRepo.getAll();
    console.log(`📰 Found ${allNews.length} total news articles\n`);

    // Test tools
    const testTools = [
      { id: 'claude-code', name: 'Claude Code' },
      { id: 'cursor', name: 'Cursor' },
      { id: 'devin', name: 'Devin' },
    ];

    for (const tool of testTools) {
      console.log(`\n🔍 Testing: ${tool.name} (${tool.id})`);
      console.log('─'.repeat(50));

      // Find articles mentioning this tool
      const toolArticles = allNews.filter(article => 
        article.tool_mentions?.includes(tool.id)
      );
      
      console.log(`📄 Articles mentioning ${tool.name}: ${toolArticles.length}`);

      if (toolArticles.length === 0) {
        console.log('⚠️  No articles found for this tool');
        continue;
      }

      // Show recent articles
      const recentArticles = toolArticles
        .sort((a, b) => new Date(b.published_date).getTime() - new Date(a.published_date).getTime())
        .slice(0, 3);

      console.log('\n📅 Recent articles:');
      recentArticles.forEach(article => {
        console.log(`   - ${article.title}`);
        console.log(`     Date: ${article.published_date}`);
        console.log(`     Source: ${article.source || 'Unknown'}`);
      });

      // Extract enhanced metrics
      console.log('\n🤖 Extracting enhanced metrics...');
      const enhancedMetrics = await extractEnhancedNewsMetrics(
        tool.id,
        tool.name,
        allNews,
        undefined,
        hasOpenAI // Enable AI only if API key is available
      );

      // Display results
      console.log('\n📊 Quantitative Metrics:');
      if (enhancedMetrics.swe_bench_score !== undefined) {
        console.log(`   ✓ SWE-bench Score: ${enhancedMetrics.swe_bench_score}%`);
      }
      if (enhancedMetrics.funding !== undefined) {
        console.log(`   ✓ Funding: $${(enhancedMetrics.funding / 1_000_000).toFixed(1)}M`);
      }
      if (enhancedMetrics.valuation !== undefined) {
        console.log(`   ✓ Valuation: $${(enhancedMetrics.valuation / 1_000_000_000).toFixed(1)}B`);
      }
      if (enhancedMetrics.estimated_users !== undefined) {
        console.log(`   ✓ Estimated Users: ${enhancedMetrics.estimated_users.toLocaleString()}`);
      }
      if (enhancedMetrics.monthly_arr !== undefined) {
        console.log(`   ✓ Monthly ARR: $${(enhancedMetrics.monthly_arr / 1_000_000).toFixed(1)}M`);
      }

      console.log('\n🎯 Qualitative Adjustments:');
      console.log(`   • Innovation Boost: +${enhancedMetrics.innovationBoost.toFixed(2)}`);
      console.log(`   • Business Sentiment: ${enhancedMetrics.businessSentimentAdjust >= 0 ? '+' : ''}${enhancedMetrics.businessSentimentAdjust.toFixed(2)}`);
      console.log(`   • Development Velocity: +${enhancedMetrics.developmentVelocityBoost.toFixed(2)}`);
      console.log(`   • Market Traction: +${enhancedMetrics.marketTractionBoost.toFixed(2)}`);
      console.log(`   • Technical Performance: +${enhancedMetrics.technicalPerformanceBoost.toFixed(2)}`);

      if (enhancedMetrics.articlesProcessed > 0) {
        console.log(`\n📈 AI Analysis: Processed ${enhancedMetrics.articlesProcessed} articles`);
      }

      if (enhancedMetrics.significantEvents.length > 0) {
        console.log('\n🌟 Significant Events:');
        enhancedMetrics.significantEvents.forEach(event => {
          console.log(`   • ${event.event}`);
          console.log(`     Date: ${event.date}, Impact: ${event.impact}`);
        });
      }
    }

    console.log('\n\n✅ Test completed successfully!');
    
    if (!hasOpenAI) {
      console.log('\n💡 Tip: Set OPENAI_API_KEY to see AI-powered qualitative analysis results');
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testEnhancedNewsIntegration();