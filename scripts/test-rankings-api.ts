#!/usr/bin/env tsx
/**
 * Test script for rankings API endpoints
 * 
 * Tests the JSON-based rankings API endpoints
 */

import { loggers } from '../src/lib/logger';

const logger = loggers.test;

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function testRankingsAPI() {
  logger.info('Testing rankings API endpoints...');
  
  const tests = [
    {
      name: 'Get current rankings',
      endpoint: '/api/rankings/json',
      expectedFields: ['rankings', 'period', 'algorithm', 'stats'],
    },
    {
      name: 'Get specific period rankings',
      endpoint: '/api/rankings/json?period=2025-06',
      expectedFields: ['rankings', 'period', 'algorithm', 'stats'],
    },
    {
      name: 'Get rankings with limit',
      endpoint: '/api/rankings/json?limit=10',
      expectedFields: ['rankings', 'period', 'algorithm', 'stats'],
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
      
      // Additional validation for rankings endpoint
      if (data.rankings && data.rankings.length > 0) {
        const ranking = data.rankings[0];
        
        // Check ranking structure
        const requiredRankingFields = ['rank', 'tool', 'total_score', 'scores', 'tier'];
        const missingRankingFields = requiredRankingFields.filter(field => !(field in ranking));
        
        if (missingRankingFields.length > 0) {
          throw new Error(`Rankings missing required fields: ${missingRankingFields.join(', ')}`);
        }
        
        // Check tool structure
        if (!ranking.tool || !ranking.tool.id || !ranking.tool.name) {
          throw new Error('Invalid tool structure in ranking');
        }
      }
      
      logger.info(`✅ ${test.name} - PASSED`, {
        status: response.status,
        dataKeys: Object.keys(data),
        rankingsCount: data.rankings?.length || 0,
        period: data.period,
      });
      
      passed++;
    } catch (error) {
      logger.error(`❌ ${test.name} - FAILED`, { error });
      failed++;
    }
  }
  
  // Test get available periods
  try {
    logger.info('Testing get available periods...');
    
    const response = await fetch(`${BASE_URL}/api/rankings/json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action: 'get-periods' }),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${data.error || 'Unknown error'}`);
    }
    
    if (!data.periods || !Array.isArray(data.periods)) {
      throw new Error('Missing or invalid periods field');
    }
    
    logger.info('✅ Get available periods - PASSED', {
      periodsCount: data.periods.length,
      current: data.current,
    });
    passed++;
  } catch (error) {
    logger.error('❌ Get available periods - FAILED', { error });
    failed++;
  }
  
  // Test admin endpoints (would need authentication in production)
  try {
    logger.info('Testing admin get all periods...');
    
    const response = await fetch(`${BASE_URL}/api/admin/rankings/periods`);
    const data = await response.json();
    
    // Admin endpoints might require auth, so we accept 401/403
    if (response.status === 401 || response.status === 403) {
      logger.info('⚠️  Admin endpoints require authentication (expected)');
    } else if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${data.error || 'Unknown error'}`);
    } else {
      if (!data.periods || !Array.isArray(data.periods)) {
        throw new Error('Missing or invalid periods field');
      }
      
      logger.info('✅ Admin get all periods - PASSED', {
        periodsCount: data.periods.length,
        current: data.current,
      });
      passed++;
    }
  } catch (error) {
    logger.error('❌ Admin get all periods - FAILED', { error });
    failed++;
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
testRankingsAPI()
  .then(() => {
    logger.info('All tests completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Test suite failed', { error });
    process.exit(1);
  });