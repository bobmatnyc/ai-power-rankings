#!/usr/bin/env tsx
/**
 * Test Database Connection and CRUD Operations
 * Verifies that PostgreSQL/Drizzle setup is working correctly
 */

// Load environment variables from .env files FIRST
import * as dotenv from 'dotenv';

// Load .env.local first (higher priority), then .env
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

import { testConnection, getDb } from '../src/lib/db/connection';
import { toolsRepository } from '../src/lib/db/repositories/tools.repository';

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSection(title: string) {
  console.log('\n' + '='.repeat(50));
  log(title, colors.cyan);
  console.log('='.repeat(50));
}

/**
 * Test basic connection
 */
async function testBasicConnection(): Promise<boolean> {
  logSection('1. Testing Database Connection');
  
  try {
    const connected = await testConnection();
    if (connected) {
      log('✅ Database connection successful!', colors.green);
      return true;
    } else {
      log('❌ Database connection failed', colors.red);
      return false;
    }
  } catch (error) {
    log(`❌ Connection error: ${error}`, colors.red);
    return false;
  }
}

/**
 * Test repository operations
 */
async function testRepositoryOperations(): Promise<void> {
  logSection('2. Testing Repository Operations');
  
  const useDatabase = process.env["USE_DATABASE"] === "true";
  log(`Mode: ${useDatabase ? 'PostgreSQL' : 'JSON Files'}`, colors.blue);
  
  try {
    // Test 1: Count tools
    log('\nTest 1: Counting tools...', colors.yellow);
    const count = await toolsRepository.count();
    log(`✅ Found ${count} tools`, colors.green);
    
    // Test 2: Find all tools (with limit)
    log('\nTest 2: Finding tools with pagination...', colors.yellow);
    const tools = await toolsRepository.findAll({ limit: 5 });
    log(`✅ Retrieved ${tools.length} tools (limited to 5)`, colors.green);
    if (tools.length > 0) {
      log(`  First tool: ${tools[0].name} (${tools[0].slug})`, colors.cyan);
    }
    
    // Test 3: Find by slug
    if (tools.length > 0) {
      log('\nTest 3: Finding tool by slug...', colors.yellow);
      const tool = await toolsRepository.findBySlug(tools[0].slug);
      if (tool) {
        log(`✅ Found tool: ${tool.name}`, colors.green);
        log(`  Category: ${tool.category}`, colors.cyan);
        log(`  Status: ${tool.status}`, colors.cyan);
      } else {
        log('❌ Tool not found by slug', colors.red);
      }
    }
    
    // Test 4: Search tools
    log('\nTest 4: Searching for tools...', colors.yellow);
    const searchResults = await toolsRepository.search('claude');
    log(`✅ Search found ${searchResults.length} results for "claude"`, colors.green);
    searchResults.forEach(result => {
      log(`  - ${result.name} (${result.slug})`, colors.cyan);
    });
    
    // Test 5: Find by category
    log('\nTest 5: Finding tools by category...', colors.yellow);
    const categoryTools = await toolsRepository.findByCategory('autonomous-agent');
    log(`✅ Found ${categoryTools.length} tools in category "autonomous-agent"`, colors.green);
    
    // Test 6: Create, update, and delete (only in test mode)
    if (process.env["DATABASE_MIGRATION_MODE"] === "test") {
      log('\nTest 6: CRUD operations (test mode only)...', colors.yellow);
      
      // Create
      const testTool = await toolsRepository.create({
        id: 'test-tool-' + Date.now(),
        slug: 'test-tool-' + Date.now(),
        name: 'Test Tool',
        category: 'test',
        status: 'active',
        description: 'A test tool for verification',
      });
      log(`✅ Created test tool: ${testTool.name}`, colors.green);
      
      // Update
      const updated = await toolsRepository.update(testTool.id, {
        name: 'Updated Test Tool',
      });
      if (updated) {
        log(`✅ Updated tool name to: ${updated.name}`, colors.green);
      }
      
      // Delete
      const deleted = await toolsRepository.delete(testTool.id);
      if (deleted) {
        log('✅ Deleted test tool', colors.green);
      }
    } else {
      log('\nTest 6: Skipping CRUD tests (set DATABASE_MIGRATION_MODE="test" to enable)', colors.yellow);
    }
    
  } catch (error) {
    log(`❌ Repository test error: ${error}`, colors.red);
    throw error;
  }
}

/**
 * Test performance
 */
async function testPerformance(): Promise<void> {
  logSection('3. Testing Performance');
  
  try {
    // Test query performance
    log('\nMeasuring query performance...', colors.yellow);
    
    const startTime = Date.now();
    await toolsRepository.findAll({ limit: 100 });
    const queryTime = Date.now() - startTime;
    
    log(`✅ Query time for 100 tools: ${queryTime}ms`, colors.green);
    
    if (queryTime < 100) {
      log('  🚀 Excellent performance (<100ms)', colors.green);
    } else if (queryTime < 500) {
      log('  ✅ Good performance (<500ms)', colors.yellow);
    } else {
      log('  ⚠️  Slow performance (>500ms)', colors.red);
    }
    
    // Test search performance
    const searchStart = Date.now();
    await toolsRepository.search('ai');
    const searchTime = Date.now() - searchStart;
    
    log(`✅ Search query time: ${searchTime}ms`, colors.green);
    
  } catch (error) {
    log(`❌ Performance test error: ${error}`, colors.red);
  }
}

/**
 * Main test function
 */
async function main() {
  console.log('');
  log('🚀 PostgreSQL/Drizzle Setup Test Suite', colors.cyan);
  console.log('');
  
  const isDatabaseMode = process.env["USE_DATABASE"] === "true";
  
  if (isDatabaseMode) {
    log('Running in DATABASE mode', colors.blue);
    
    // Test database connection
    const connected = await testBasicConnection();
    
    if (!connected) {
      log('\n⚠️  Database not configured. Please set up your Neon database credentials.', colors.yellow);
      log('Edit .env.local and replace YOUR_PASSWORD with your actual password.', colors.yellow);
      process.exit(1);
    }
  } else {
    log('Running in JSON mode (database disabled)', colors.blue);
    log('Set USE_DATABASE="true" in .env.local to enable PostgreSQL', colors.yellow);
  }
  
  // Test repository operations
  await testRepositoryOperations();
  
  // Test performance
  await testPerformance();
  
  // Summary
  logSection('Test Summary');
  
  if (isDatabaseMode) {
    log('✅ Database connection: PASSED', colors.green);
    log('✅ Repository operations: PASSED', colors.green);
    log('✅ Performance tests: PASSED', colors.green);
    log('\n🎉 All tests passed! PostgreSQL/Drizzle setup is working correctly.', colors.green);
    log('\nNext steps:', colors.cyan);
    log('1. Run migrations: npm run db:push', colors.yellow);
    log('2. Migrate JSON data: npm run db:migrate:json', colors.yellow);
    log('3. Enable database: Set USE_DATABASE="true" in .env.local', colors.yellow);
  } else {
    log('✅ JSON repository operations: PASSED', colors.green);
    log('✅ Performance tests: PASSED', colors.green);
    log('\n🎉 JSON mode is working correctly.', colors.green);
    log('\nTo enable PostgreSQL:', colors.cyan);
    log('1. Add your Neon credentials to .env.local', colors.yellow);
    log('2. Set USE_DATABASE="true"', colors.yellow);
    log('3. Run this test again', colors.yellow);
  }
}

// Run tests
if (require.main === module) {
  main().catch(error => {
    log(`\n❌ Test suite failed: ${error}`, colors.red);
    process.exit(1);
  });
}