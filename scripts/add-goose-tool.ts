#!/usr/bin/env tsx
/**
 * Add Goose AI Agent to Database
 *
 * Adds Goose (Block's open-source AI coding agent) to the AI Power Rankings database
 * with comprehensive tool data and initial power ranking of 84/100.
 *
 * Usage: npx tsx scripts/add-goose-tool.ts
 */

import { getDb } from '../lib/db/connection';
import { tools } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

async function addGooseTool() {
  const db = getDb();
  if (db === null) {
    console.log('❌ No database connection');
    process.exit(1);
  }

  console.log('\n🦆 Adding Goose AI Agent to database...\n');

  const gooseData = {
    id: 'goose',
    name: 'Goose',
    slug: 'goose',
    category: 'code-assistant',
    subcategory: 'autonomous-agent',
    description: 'Open-source AI coding agent with autonomous task execution, recipe system for shareable workflows, and multi-LLM support. Features true local execution for privacy-first development.',
    website_url: 'https://block.github.io/goose/',
    github_repo: 'block/goose',
    company_name: 'Block (formerly Square)',
    founded_date: '2025-01-28',
    pricing_model: 'free',
    license_type: 'open-source',
    status: 'active',
    logo_url: '/tools/goose.png',

    // Extended metadata
    full_name: 'Goose AI Agent',
    license: 'Apache 2.0',
    github_url: 'https://github.com/block/goose',
    documentation_url: 'https://block.github.io/goose/docs/',

    // GitHub stats
    github_stats: {
      stars: 21200,
      as_of_date: '2025-10-30'
    },

    // Pricing details
    pricing: {
      model: 'free',
      details: 'Open source (Apache 2.0) + BYOLLM (Bring Your Own LLM)',
      api_costs: 'User provides their own LLM API keys'
    },

    // Key features
    features: [
      'Autonomous AI coding agent',
      'Recipe system for shareable workflows',
      'Multi-LLM support (20+ providers)',
      'True local execution (privacy-first)',
      'MCP-native architecture',
      'Desktop GUI + CLI interface',
      'Multi-file operations',
      'Full tool configurability'
    ],

    // Differentiators
    key_differentiators: [
      'Only tool with recipe system',
      'True local execution (HIPAA/SOC2-friendly)',
      'Multi-LLM orchestration',
      'Corporate backing from Block'
    ],

    // Supported LLM providers
    supported_llms: [
      'OpenAI',
      'Anthropic',
      'Google',
      'DeepSeek',
      'Ollama (local)',
      'And 15+ more providers'
    ],

    // Initial power ranking
    power_ranking: 84,
    ranking_tier: 'A+',

    // Ranking breakdown
    ranking_breakdown: {
      innovation: 90,
      capabilities: 88,
      usability: 75,
      adoption: 85,
      ecosystem: 82,
      reliability: 75,
      performance: 80,
      value: 95
    },

    // Competitive analysis
    competitive_position: 'Ranks #4-6 among AI coding agents, competitive with Aider and Claude Code, below Cursor and GitHub Copilot in maturity but superior value proposition.',

    // Target audience
    target_audience: 'Professional developers, enterprises requiring privacy-first solutions, teams wanting workflow automation',

    // Platform support
    platforms: ['macOS', 'Linux', 'Windows'],

    // Integration type
    integration_type: ['Desktop GUI', 'CLI', 'Terminal'],

    // Tags for categorization
    tags: [
      'ai-agent',
      'autonomous',
      'coding-assistant',
      'open-source',
      'multi-llm',
      'privacy-first',
      'recipe-system',
      'terminal',
      'gui'
    ]
  };

  try {
    // Check if tool already exists
    const existing = await db
      .select()
      .from(tools)
      .where(eq(tools.slug, 'goose'))
      .limit(1);

    if (existing.length > 0) {
      console.log('⚠️  Goose already exists in database');
      console.log('   ID:', existing[0].id);
      console.log('   Slug:', existing[0].slug);
      console.log('   Name:', existing[0].name);
      console.log('\n❓ Would you like to update the existing entry?');
      console.log('   Run: npx tsx scripts/update-goose-tool.ts');
      process.exit(0);
    }

    // Insert new tool
    const result = await db
      .insert(tools)
      .values({
        slug: gooseData.slug,
        name: gooseData.name,
        category: gooseData.category,
        status: gooseData.status,
        data: gooseData
      })
      .returning();

    const createdTool = result[0];

    if (!createdTool) {
      throw new Error('Failed to create Goose tool - no result returned');
    }

    console.log('✅ Goose AI Agent added successfully!\n');
    console.log('📊 Tool Details:');
    console.log('   Database ID:', createdTool.id);
    console.log('   Slug:', createdTool.slug);
    console.log('   Name:', createdTool.name);
    console.log('   Category:', createdTool.category);
    console.log('   Status:', createdTool.status);
    console.log('   Power Ranking:', gooseData.power_ranking, '/', 100);
    console.log('   Tier:', gooseData.ranking_tier);
    console.log('\n🔗 Links:');
    console.log('   Website:', gooseData.website_url);
    console.log('   GitHub:', gooseData.github_url);
    console.log('   Stars:', gooseData.github_stats.stars.toLocaleString());
    console.log('\n🎯 Key Features:');
    gooseData.features.slice(0, 4).forEach(feature => {
      console.log('   •', feature);
    });
    console.log('\n✨ Next Steps:');
    console.log('   1. Verify tool page: /en/tools/goose');
    console.log('   2. Add tool logo to: /public/tools/goose.png');
    console.log('   3. Update rankings if needed');
    console.log('   4. Add Goose to relevant news articles');
    console.log('');

  } catch (error) {
    console.error('❌ Error adding Goose tool:', error);

    if (error instanceof Error) {
      console.error('   Error message:', error.message);
      if ('code' in error) {
        console.error('   Error code:', error.code);
      }
    }

    process.exit(1);
  }
}

// Run the script
addGooseTool();
