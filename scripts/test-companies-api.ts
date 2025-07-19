#!/usr/bin/env tsx
/**
 * Test script for companies API endpoints
 * 
 * Tests the JSON-based companies API endpoints
 */

import { loggers } from '../src/lib/logger';

const logger = loggers.test;

const BASE_URL = process.env["BASE_URL"] || 'http://localhost:3000';

async function testCompaniesAPI() {
  logger.info('Testing companies API endpoints...');
  
  const tests = [
    {
      name: 'Get all companies',
      endpoint: '/api/companies',
      expectedFields: ['companies', 'total', 'page', 'totalPages', 'hasMore'],
    },
    {
      name: 'Get companies with pagination',
      endpoint: '/api/companies?limit=10&page=2',
      expectedFields: ['companies', 'total', 'page', 'totalPages', 'hasMore'],
    },
    {
      name: 'Search companies',
      endpoint: '/api/companies?search=google',
      expectedFields: ['companies', 'total'],
    },
    {
      name: 'Filter by company size',
      endpoint: '/api/companies?size=startup',
      expectedFields: ['companies', 'total'],
    },
    {
      name: 'Get company statistics',
      endpoint: '/api/companies/stats',
      expectedFields: ['stats', 'topCompanies'],
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
      
      logger.info(`✅ ${test.name} - PASSED`, {
        status: response.status,
        dataKeys: Object.keys(data),
      });
      
      passed++;
    } catch (error) {
      logger.error(`❌ ${test.name} - FAILED`, { error });
      failed++;
    }
  }
  
  // Test single company endpoints
  try {
    const listResponse = await fetch(`${BASE_URL}/api/companies?limit=1`);
    const listData = await listResponse.json();
    
    if (listData.companies && listData.companies.length > 0) {
      const company = listData.companies[0];
      
      // Test get by ID
      logger.info('Testing get company by ID...');
      const byIdResponse = await fetch(`${BASE_URL}/api/companies/${company.id}`);
      const byIdData = await byIdResponse.json();
      
      if (!byIdResponse.ok) {
        throw new Error(`HTTP ${byIdResponse.status}: ${byIdData.error || 'Unknown error'}`);
      }
      
      if (!byIdData.company) {
        throw new Error('Missing company field');
      }
      
      logger.info('✅ Get company by ID - PASSED');
      passed++;
      
      // Test get by slug
      logger.info('Testing get company by slug...');
      const bySlugResponse = await fetch(`${BASE_URL}/api/companies/${company.slug}`);
      const bySlugData = await bySlugResponse.json();
      
      if (!bySlugResponse.ok) {
        throw new Error(`HTTP ${bySlugResponse.status}: ${bySlugData.error || 'Unknown error'}`);
      }
      
      if (!bySlugData.company) {
        throw new Error('Missing company field');
      }
      
      logger.info('✅ Get company by slug - PASSED');
      passed++;
      
      // Test company tools
      logger.info('Testing get company tools...');
      const toolsResponse = await fetch(`${BASE_URL}/api/companies/${company.id}/tools`);
      const toolsData = await toolsResponse.json();
      
      if (!toolsResponse.ok) {
        throw new Error(`HTTP ${toolsResponse.status}: ${toolsData.error || 'Unknown error'}`);
      }
      
      if (!toolsData.tools || !Array.isArray(toolsData.tools)) {
        throw new Error('Missing or invalid tools field');
      }
      
      logger.info('✅ Get company tools - PASSED', {
        company: company.name,
        toolCount: toolsData.total,
      });
      passed++;
    }
  } catch (error) {
    logger.error('❌ Single company endpoints - FAILED', { error });
    failed += 3;
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
testCompaniesAPI()
  .then(() => {
    logger.info('All tests completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Test suite failed', { error });
    process.exit(1);
  });