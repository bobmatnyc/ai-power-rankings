import { supabaseAdmin } from '../src/lib/database';
import toolsData from '../src/data/seed/tools.json';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function seedDatabase() {
  console.log('🌱 Starting database seeding...');
  
  try {
    // Insert tools
    console.log('📦 Inserting tools...');
    const { data: insertedTools, error: toolsError } = await supabaseAdmin
      .from('tools')
      .insert(toolsData)
      .select();
    
    if (toolsError) {
      console.error('❌ Error seeding tools:', toolsError);
      return;
    }
    
    console.log(`✅ Inserted ${insertedTools.length} tools`);
    
    // Insert sample capabilities for each tool
    console.log('🔧 Inserting tool capabilities...');
    const capabilities = toolsData.map(tool => ({
      tool_id: tool.id,
      autonomy_level: Math.floor(Math.random() * 5) + 5, // 5-10
      context_window_size: 100000 + Math.floor(Math.random() * 100000),
      supports_multi_file: Math.random() > 0.5,
      supported_languages: ['JavaScript', 'TypeScript', 'Python', 'Java', 'Go'],
      supported_platforms: ['VS Code', 'IntelliJ', 'Terminal'],
      integration_types: ['IDE', 'CLI', 'API'],
      llm_providers: ['OpenAI', 'Anthropic', 'Google'],
      deployment_options: ['Local', 'Cloud', 'Self-hosted']
    }));
    
    const { error: capabilitiesError } = await supabaseAdmin
      .from('tool_capabilities')
      .insert(capabilities);
    
    if (capabilitiesError) {
      console.error('❌ Error seeding capabilities:', capabilitiesError);
      return;
    }
    
    console.log('✅ Inserted tool capabilities');
    
    // Insert sample metrics for each tool
    console.log('📊 Inserting tool metrics...');
    const metrics = toolsData.map(tool => ({
      tool_id: tool.id,
      metric_date: new Date().toISOString().split('T')[0],
      github_stars: Math.floor(Math.random() * 50000),
      github_forks: Math.floor(Math.random() * 5000),
      github_watchers: Math.floor(Math.random() * 1000),
      github_commits_last_month: Math.floor(Math.random() * 200),
      github_contributors: Math.floor(Math.random() * 100),
      github_last_commit: new Date().toISOString(),
      funding_total: Math.floor(Math.random() * 100000000),
      valuation_latest: Math.floor(Math.random() * 1000000000),
      estimated_users: Math.floor(Math.random() * 100000),
      social_mentions_30d: Math.floor(Math.random() * 1000),
      sentiment_score: Math.random() * 0.5 + 0.5, // 0.5-1.0
      community_size: Math.floor(Math.random() * 10000),
      release_frequency_days: Math.floor(Math.random() * 30) + 7
    }));
    
    const { error: metricsError } = await supabaseAdmin
      .from('tool_metrics')
      .insert(metrics);
    
    if (metricsError) {
      console.error('❌ Error seeding metrics:', metricsError);
      return;
    }
    
    console.log('✅ Inserted tool metrics');
    
    // Create a sample ranking period
    console.log('📅 Creating ranking period...');
    const currentPeriod = {
      period: '2025-01',
      display_name: 'January 2025',
      publication_date: '2025-01-01',
      tools_count: toolsData.length,
      algorithm_version: '1.0.0',
      editorial_summary: 'The inaugural AI Power Rankings featuring the top agentic AI coding tools.',
      major_changes: {
        new_entries: toolsData.map(t => t.id),
        significant_moves: []
      },
      is_current: true
    };
    
    const { error: periodError } = await supabaseAdmin
      .from('ranking_periods')
      .insert(currentPeriod);
    
    if (periodError) {
      console.error('❌ Error creating ranking period:', periodError);
      return;
    }
    
    console.log('✅ Created ranking period');
    
    console.log('🎉 Database seeded successfully!');
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

seedDatabase().catch(console.error);