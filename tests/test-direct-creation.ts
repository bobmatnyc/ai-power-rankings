#!/usr/bin/env node
/**
 * Direct test of article creation with default author
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

const BASE_URL = 'http://localhost:3001';

async function testDirectCreation() {
  console.log('🧪 Testing direct article creation...\n');

  const testArticle = {
    action: 'manual-ingest',
    title: `Test Article - ${new Date().toISOString()}`,
    content: 'This is a test article to verify the default author functionality. Claude Code and GitHub Copilot are mentioned here.',
    summary: 'Test article for author verification',
    author: 'Robert Matsuoka',
    category: 'Test Category',
    tags: ['test', 'verification'],
    tool_mentions: ['Claude Code', 'GitHub Copilot'],
    importance_score: 5,
    source: 'Test Suite',
    published_at: new Date().toISOString(),
  };

  console.log('📤 Sending article data:');
  console.log(`   Title: ${testArticle.title}`);
  console.log(`   Author: ${testArticle.author}`);
  console.log(`   Category: ${testArticle.category}\n`);

  try {
    const response = await fetch(`${BASE_URL}/api/admin/news`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testArticle),
    });

    const responseText = await response.text();
    console.log('📥 Response status:', response.status);

    if (!response.ok) {
      console.error('❌ Creation failed:', responseText);
      return false;
    }

    const result = JSON.parse(responseText);
    console.log('✅ Article created:');
    console.log(`   ID: ${result.article?.id}`);
    console.log(`   Slug: ${result.article?.slug}`);

    // Now verify it exists in the list
    console.log('\n🔍 Verifying in article list...');
    const listResponse = await fetch(`${BASE_URL}/api/admin/news/list`);
    const listData = await listResponse.json();

    const found = listData.articles?.find((a: any) =>
      a.title === testArticle.title || a.id === result.article?.id
    );

    if (found) {
      console.log('✅ Article found in list:');
      console.log(`   ID: ${found.id}`);
      console.log(`   Title: ${found.title}`);
      console.log(`   Author: ${found.author || 'null'} ${found.author === 'Robert Matsuoka' ? '✅' : '❌'}`);
      console.log(`   Category: ${found.category}`);
      return found.author === 'Robert Matsuoka';
    } else {
      console.error('❌ Article not found in list');
      console.log('Total articles in list:', listData.articles?.length);
      return false;
    }
  } catch (error) {
    console.error('❌ Error:', error);
    return false;
  }
}

async function main() {
  console.log('🚀 Direct Article Creation Test\n');
  console.log('===============================\n');

  const success = await testDirectCreation();

  console.log('\n===============================');
  if (success) {
    console.log('✅ Test PASSED: Article created with correct author');
  } else {
    console.log('❌ Test FAILED: Check errors above');
  }
  console.log('===============================\n');

  process.exit(success ? 0 : 1);
}

main().catch(console.error);