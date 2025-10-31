/**
 * Verify Goose Tool API Endpoint
 *
 * This script verifies that the /api/tools/goose/json endpoint
 * returns proper data without null values.
 */

import { ToolsRepository } from '../lib/db/repositories/tools.repository';

async function verifyGooseApi() {
  console.log('🔍 Verifying Goose Tool API\n');

  try {
    // Step 1: Check database has correct data
    console.log('Step 1: Checking database data...');
    const toolsRepo = new ToolsRepository();
    const tool = await toolsRepo.findBySlug('goose');

    if (!tool) {
      console.log('❌ FAIL: Goose tool not found in database');
      process.exit(1);
    }

    console.log('✅ Tool found in database');

    // Step 2: Verify required fields are present
    console.log('\nStep 2: Verifying required fields...');
    const requiredFields = [
      'id',
      'slug',
      'name',
      'category',
      'status',
      'logo_url',
      'website_url',
      'github_repo',
      'description',
      'info'
    ];

    let allFieldsPresent = true;
    for (const field of requiredFields) {
      const value = (tool as any)[field];
      if (value === null || value === undefined) {
        console.log(`❌ FAIL: Field '${field}' is null/undefined`);
        allFieldsPresent = false;
      } else {
        console.log(`✅ ${field}: ${typeof value === 'object' ? 'present' : value}`);
      }
    }

    if (!allFieldsPresent) {
      console.log('\n❌ FAIL: Some required fields are missing');
      process.exit(1);
    }

    // Step 3: Test API endpoint
    console.log('\nStep 3: Testing API endpoint...');
    console.log('Making request to: http://localhost:3007/api/tools/goose/json');

    const response = await fetch('http://localhost:3007/api/tools/goose/json');

    if (!response.ok) {
      console.log(`❌ FAIL: API returned status ${response.status}`);
      process.exit(1);
    }

    const data = await response.json();

    // Verify response structure
    if (!data.tool) {
      console.log('❌ FAIL: Response missing tool object');
      process.exit(1);
    }

    console.log('✅ API returned 200 OK');
    console.log('✅ Response contains tool object');

    // Step 4: Verify API response fields
    console.log('\nStep 4: Verifying API response fields...');
    const apiFields = ['name', 'logo_url', 'website_url', 'github_repo', 'description'];

    let allApiFieldsValid = true;
    for (const field of apiFields) {
      const value = data.tool[field];
      if (value === null || value === undefined || value === '') {
        console.log(`❌ FAIL: API field '${field}' is null/undefined/empty`);
        allApiFieldsValid = false;
      } else {
        console.log(`✅ ${field}: ${value}`);
      }
    }

    if (!allApiFieldsValid) {
      console.log('\n❌ FAIL: Some API response fields are invalid');
      process.exit(1);
    }

    // Step 5: Verify ranking data
    console.log('\nStep 5: Verifying ranking data...');
    if (data.ranking) {
      console.log(`✅ Ranking present - Rank: ${data.ranking.rank}, Score: ${data.ranking.scores?.overall}`);
    } else {
      console.log('⚠️  Warning: No ranking data (may be expected if rankings not generated)');
    }

    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL CHECKS PASSED');
    console.log('='.repeat(60));
    console.log('\nGoose API endpoint is working correctly:');
    console.log(`  • Name: ${data.tool.name}`);
    console.log(`  • Logo: ${data.tool.logo_url}`);
    console.log(`  • Website: ${data.tool.website_url}`);
    console.log(`  • GitHub: ${data.tool.github_repo}`);
    console.log(`  • Description: ${data.tool.description.substring(0, 50)}...`);
    if (data.ranking) {
      console.log(`  • Rank: ${data.ranking.rank}`);
    }
    console.log('\nAPI Endpoint: http://localhost:3007/api/tools/goose/json');

  } catch (error) {
    console.error('\n❌ ERROR:', error);
    process.exit(1);
  }

  process.exit(0);
}

verifyGooseApi();
