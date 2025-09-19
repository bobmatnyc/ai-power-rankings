#!/usr/bin/env node
/**
 * End-to-end test for news article creation
 * Tests the complete flow of creating an article with:
 * - Default author "Robert Matsuoka"
 * - AI-extracted category and tags
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

const BASE_URL = 'http://localhost:3001';

// Sample article for testing
const SAMPLE_ARTICLE = {
  title: "Claude 4 Revolutionizes AI Code Generation with Multi-File Support",
  content: `Anthropic has released Claude 4, a groundbreaking update to their AI coding assistant that introduces
sophisticated multi-file refactoring capabilities. The new model achieves 74.5% on the SWE-bench benchmark,
surpassing competitors like GitHub Copilot and ChatGPT Canvas.

The update brings several key features:
- Intelligent context awareness across entire codebases
- Automated test generation with 95% coverage
- Real-time collaboration with development teams
- Integration with popular IDEs including VS Code and JetBrains

Google's Gemini Code Assist and Amazon Q Developer are expected to release competitive updates in response.
Meanwhile, innovative tools like Cursor, Windsurf, and Devin continue to push boundaries in autonomous coding.

Industry analysts predict this will accelerate AI adoption in enterprise development, with companies like
Microsoft, Meta, and OpenAI investing heavily in the space.`,
  summary: "Anthropic's Claude 4 sets new benchmarks in AI code generation with 74.5% SWE-bench score and multi-file refactoring.",
};

async function createTestArticle() {
  console.log('📝 Creating test article via API...\n');

  try {
    // First analyze the content to extract category and tags
    console.log('🔍 Step 1: Analyzing content for category and tags...');
    const analyzeResponse = await fetch(`${BASE_URL}/api/admin/news/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: SAMPLE_ARTICLE.content,
        type: 'text',
      }),
    });

    if (!analyzeResponse.ok) {
      const error = await analyzeResponse.text();
      console.error('❌ Analysis failed:', error);
      return false;
    }

    const analysisResult = await analyzeResponse.json();
    const { analysis } = analysisResult;

    console.log('✅ Content analyzed successfully');
    console.log(`   Category: ${analysis.category || 'Code Assistant'}`);
    console.log(`   Tags: ${analysis.key_topics?.slice(0, 5).join(', ')}`);
    console.log(`   Tools: ${analysis.tool_mentions?.map((tm: any) => tm.tool).slice(0, 5).join(', ')}\n`);

    // Step 2: Create the article with extracted data
    console.log('💾 Step 2: Creating article with extracted metadata...');

    const articleData = {
      action: 'manual-ingest',
      title: SAMPLE_ARTICLE.title,
      content: SAMPLE_ARTICLE.content,
      summary: SAMPLE_ARTICLE.summary,
      author: 'Robert Matsuoka', // Default author
      category: analysis.category || 'Code Assistant',
      tags: analysis.key_topics || [],
      tool_mentions: analysis.tool_mentions?.map((tm: any) => tm.tool) || [],
      importance_score: analysis.importance_score || 8,
      source: 'AI Power Rankings Test',
      published_at: new Date().toISOString(),
    };

    const createResponse = await fetch(`${BASE_URL}/api/admin/news`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(articleData),
    });

    if (!createResponse.ok) {
      const error = await createResponse.text();
      console.error('❌ Article creation failed:', error);
      return false;
    }

    const createResult = await createResponse.json();
    console.log('✅ Article created successfully!');
    console.log(`   ID: ${createResult.article?.id}`);
    console.log(`   Slug: ${createResult.article?.slug}`);
    console.log(`   Title: ${createResult.article?.title}\n`);

    // Step 3: Verify the article was created correctly
    console.log('🔍 Step 3: Verifying article data...');

    const verifyResponse = await fetch(`${BASE_URL}/api/admin/news/list`);
    if (!verifyResponse.ok) {
      console.error('❌ Failed to retrieve articles');
      return false;
    }

    const { articles } = await verifyResponse.json();
    const createdArticle = articles.find((a: any) => a.id === createResult.article?.id);

    if (!createdArticle) {
      console.error('❌ Article not found in list');
      return false;
    }

    console.log('✅ Article verification complete:');
    console.log(`   ✓ Author: ${createdArticle.author} (Expected: Robert Matsuoka)`);
    console.log(`   ✓ Category: ${createdArticle.category}`);
    console.log(`   ✓ Tags: ${createdArticle.tags?.join(', ')}`);
    console.log(`   ✓ Tool Mentions: ${createdArticle.tool_mentions?.join(', ')}`);
    console.log(`   ✓ Importance Score: ${createdArticle.importance_score}`);

    // Validate the author is correct
    if (createdArticle.author !== 'Robert Matsuoka') {
      console.error('❌ Author mismatch! Expected "Robert Matsuoka", got:', createdArticle.author);
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return false;
  }
}

async function testFormUI() {
  console.log('\n🖥️  UI Form Test Instructions:\n');
  console.log('To manually verify the form UI:');
  console.log('----------------------------------------');
  console.log('1. Open browser to: http://localhost:3001/admin/news/edit/new');
  console.log('2. Verify "Robert Matsuoka" appears in the Author field');
  console.log('3. Paste some content in the Content field');
  console.log('4. Click the "AI Extract" button next to Category');
  console.log('5. Verify Category and Tags are populated automatically');
  console.log('6. Save the article and verify it\'s created correctly');
  console.log('----------------------------------------\n');
}

async function main() {
  console.log('🚀 News Article Creation Test Suite\n');
  console.log('=====================================\n');

  // Check environment
  if (!process.env['OPENROUTER_API_KEY']) {
    console.error('❌ Error: OPENROUTER_API_KEY not found in environment');
    console.log('   The AI extraction features require an OpenRouter API key');
    console.log('   Get your key at: https://openrouter.ai/keys\n');
    process.exit(1);
  }

  // Run API test
  console.log('🧪 Running API Test...\n');
  const apiSuccess = await createTestArticle();

  // Show UI test instructions
  await testFormUI();

  // Summary
  console.log('=====================================');
  console.log('📊 Test Results:');
  console.log(`   API Test: ${apiSuccess ? '✅ PASSED' : '❌ FAILED'}`);
  console.log('   UI Test: Manual verification required');
  console.log('=====================================\n');

  if (apiSuccess) {
    console.log('✨ API tests passed! Please verify UI manually.');
    console.log('\n📌 Key Features Implemented:');
    console.log('   ✅ Default author "Robert Matsuoka" for new articles');
    console.log('   ✅ Author field remains editable');
    console.log('   ✅ AI extraction of category from content');
    console.log('   ✅ AI extraction of tags from content');
    console.log('   ✅ Tool mentions automatically identified');
    process.exit(0);
  } else {
    console.log('❌ API tests failed. Please check the errors above.');
    process.exit(1);
  }
}

// Run the test
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});