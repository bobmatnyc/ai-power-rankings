#!/usr/bin/env tsx
/**
 * Test script for tools API endpoints
 * 
 * Tests the JSON-based tools API endpoints
 */

import { loggers } from '../src/lib/logger';

const logger = loggers.test;

const BASE_URL = process.env["BASE_URL"] || 'http://localhost:3000';

async function testToolsAPI() {
  logger.info('Testing tools API endpoints...');
  
  const tests = [
    {
      name: 'Get all tools',
      endpoint: '/api/tools/json',
      expectedFields: ['tools', 'total', 'page', 'totalPages', 'hasMore'],
    },
    {
      name: 'Get tools with pagination',
      endpoint: '/api/tools/json?limit=10&page=2',
      expectedFields: ['tools', 'total', 'page', 'totalPages', 'hasMore'],
    },
    {
      name: 'Search tools',
      endpoint: '/api/tools/json?search=cursor',
      expectedFields: ['tools', 'total'],
    },
    {
      name: 'Filter by category',
      endpoint: '/api/tools/json?category=ai-coding-tool',
      expectedFields: ['tools', 'total'],
    },
    {
      name: 'Filter by status',
      endpoint: '/api/tools/json?status=active',
      expectedFields: ['tools', 'total'],
    },
    {
      name: 'Get tool categories',
      endpoint: '/api/tools/categories',
      expectedFields: ['categories', 'total'],
    },
    {
      name: 'Get tool statistics',
      endpoint: '/api/tools/stats',
      expectedFields: ['stats', 'recentTools', 'topCompaniesByTools'],
    },
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      logger.info(`Testing: ${test.name}`);
      
      const response = await fetch(`${BASE_URL}${test.endpoint}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${data.error || 'Unknown error'}`);
      }
      
      // Check expected fields
      const missingFields = test.expectedFields.filter(field => !(field in data));
      
      if (missingFields.length > 0) {
        throw new Error(`Missing fields: ${missingFields.join(', ')}`);
      }
      
      // Additional validation for tools endpoint
      if (test.endpoint.includes('/api/tools/json') && data.tools) {
        // Check that tools have required structure
        const tool = data.tools[0];
        if (tool && !tool.info) {
          throw new Error('Tools missing required "info" structure');
        }
      }
      
      logger.info(`✅ ${test.name} - PASSED`, {
        status: response.status,
        dataKeys: Object.keys(data),
        recordCount: data.tools?.length || data.categories?.length || 0,
      });
      
      passed++;
    } catch (error) {
      logger.error(`❌ ${test.name} - FAILED`, { error });
      failed++;
    }
  }
  
  // Test single tool endpoints
  try {
    const listResponse = await fetch(`${BASE_URL}/api/tools/json?limit=1`);
    const listData = await listResponse.json();
    
    if (listData.tools && listData.tools.length > 0) {
      const tool = listData.tools[0];
      
      // Test get by slug
      logger.info('Testing get tool by slug...');
      const bySlugResponse = await fetch(`${BASE_URL}/api/tools/${tool.slug}/json`);
      const bySlugData = await bySlugResponse.json();
      
      if (!bySlugResponse.ok) {
        throw new Error(`HTTP ${bySlugResponse.status}: ${bySlugData.error || 'Unknown error'}`);
      }
      
      if (!bySlugData.tool) {
        throw new Error('Missing tool field');
      }
      
      // Check expected fields in detail response
      const expectedDetailFields = ['tool', 'ranking', 'metrics', 'metricHistory', 'rankingsHistory', 'newsItems', 'pricingPlans'];
      const missingDetailFields = expectedDetailFields.filter(field => !(field in bySlugData));
      
      if (missingDetailFields.length > 0) {
        throw new Error(`Missing detail fields: ${missingDetailFields.join(', ')}`);
      }
      
      logger.info('✅ Get tool by slug - PASSED', {
        tool: tool.name,
        hasRanking: !!bySlugData.ranking,
        newsCount: bySlugData.newsItems?.length || 0,
        rankingHistoryCount: bySlugData.rankingsHistory?.length || 0,
      });
      passed++;
      
      // Test get by ID
      logger.info('Testing get tool by ID...');
      const byIdResponse = await fetch(`${BASE_URL}/api/tools/${tool.id}/json`);
      const byIdData = await byIdResponse.json();
      
      if (!byIdResponse.ok) {
        throw new Error(`HTTP ${byIdResponse.status}: ${byIdData.error || 'Unknown error'}`);
      }
      
      if (!byIdData.tool) {
        throw new Error('Missing tool field');
      }
      
      logger.info('✅ Get tool by ID - PASSED');
      passed++;
    }
  } catch (error) {
    logger.error('❌ Single tool endpoints - FAILED', { error });
    failed += 2;
  }
  
  // Summary
  logger.info('\n=== Test Summary ===');
  logger.info(`Total tests: ${passed + failed}`);
  logger.info(`Passed: ${passed}`);
  logger.info(`Failed: ${failed}`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

// Run tests
testToolsAPI()
  .then(() => {
    logger.info('All tests completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Test suite failed', { error });
    process.exit(1);
  });