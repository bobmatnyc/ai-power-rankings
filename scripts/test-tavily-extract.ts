#!/usr/bin/env tsx
/**
 * Test script for Tavily Extract API integration
 * Tests the extraction chain: Jina Reader → Tavily Extract → Basic HTML
 */

import { tavilyExtractService } from '@/lib/services/tavily-extract.service';
import { jinaReaderService } from '@/lib/services/jina-reader.service';

async function testExtractionChain() {
  console.log('=== Testing Content Extraction Chain ===\n');

  // Test URLs (mix of easy and challenging)
  const testUrls = [
    'https://techcrunch.com/2024/01/15/anthropic-claude-3/',
    'https://www.theverge.com/2024/1/10/github-copilot-updates',
    'https://arstechnica.com/ai/2024/01/openai-gpt-4-improvements/',
  ];

  console.log('Test Configuration:');
  console.log('- Jina Reader available:', jinaReaderService.isAvailable());
  console.log('- Tavily Extract available:', tavilyExtractService.isAvailable());
  console.log('');

  const results = {
    jinaSuccess: 0,
    tavilySuccess: 0,
    allFailed: 0,
  };

  for (const url of testUrls) {
    console.log(`\nTesting URL: ${url}`);
    console.log('─'.repeat(80));

    // Try Jina Reader first
    let content: string | null = null;
    let method = '';

    if (jinaReaderService.isAvailable()) {
      try {
        console.log('[1/2] Attempting Jina Reader...');
        const result = await jinaReaderService.fetchArticle(url);
        if (result.content && result.content.length > 100) {
          content = result.content;
          method = 'Jina Reader';
          results.jinaSuccess++;
          console.log(`✓ Success: ${content.length} characters`);
        } else {
          console.log('✗ Empty content, trying fallback...');
        }
      } catch (error) {
        console.log(`✗ Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Try Tavily Extract as fallback
    if (!content && tavilyExtractService.isAvailable()) {
      try {
        console.log('[2/2] Attempting Tavily Extract...');
        content = await tavilyExtractService.extractContent(url, {
          extract_depth: 'basic',
          format: 'markdown',
          timeout: 10,
          chunks_per_source: 5,
        });

        if (content && content.length > 100) {
          method = 'Tavily Extract';
          results.tavilySuccess++;
          console.log(`✓ Success: ${content.length} characters`);
        } else {
          console.log('✗ Empty content');
        }
      } catch (error) {
        console.log(`✗ Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    if (!content) {
      method = 'All methods failed';
      results.allFailed++;
    }

    console.log(`\nResult: ${method}`);
    if (content) {
      console.log(`Content preview: ${content.substring(0, 200)}...`);
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('EXTRACTION SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total URLs tested: ${testUrls.length}`);
  console.log(`Jina Reader successes: ${results.jinaSuccess}`);
  console.log(`Tavily Extract successes: ${results.tavilySuccess}`);
  console.log(`All methods failed: ${results.allFailed}`);
  console.log(`Overall success rate: ${((testUrls.length - results.allFailed) / testUrls.length * 100).toFixed(1)}%`);
}

// Run the test
testExtractionChain()
  .then(() => {
    console.log('\n✓ Test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Test failed:', error);
    process.exit(1);
  });
