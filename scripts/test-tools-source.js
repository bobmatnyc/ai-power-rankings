#!/usr/bin/env node

/**
 * Test script to verify tools are being loaded from database
 */

const http = require('http');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function testToolsSource() {
  console.log('Testing Tools Data Source\n');
  console.log('='.repeat(50));

  try {
    // Test the tools API endpoint
    const { status, data } = await fetchJson('http://localhost:3011/api/tools');

    console.log('✅ API Response Status:', status);
    console.log('✅ Tools Count:', data.tools?.length || 0);
    console.log('✅ Data Source:', data._source || 'unknown');
    console.log('✅ Timestamp:', data._timestamp);

    if (data._source === 'database') {
      console.log('\n🎉 SUCCESS: Tools are being loaded from DATABASE');
    } else if (data._source === 'json') {
      console.log('\n⚠️  WARNING: Tools are being loaded from JSON file');
    } else {
      console.log('\n❓ UNKNOWN: Could not determine data source');
    }

    // Show first tool as example
    if (data.tools && data.tools.length > 0) {
      const firstTool = data.tools[0];
      console.log('\nExample Tool:');
      console.log('  - ID:', firstTool.id);
      console.log('  - Name:', firstTool.name);
      console.log('  - Slug:', firstTool.slug);
      console.log('  - Category:', firstTool.category);
      console.log('  - Status:', firstTool.status);
    }

    // Check environment variables
    console.log('\n' + '='.repeat(50));
    console.log('Environment Configuration:');
    console.log('  - USE_DATABASE:', process.env.USE_DATABASE || 'not set');
    console.log('  - DATABASE_URL:', process.env.DATABASE_URL ? '✅ Set' : '❌ Not set');

  } catch (error) {
    console.error('❌ Error testing tools source:', error.message);
    process.exit(1);
  }
}

// Run the test
testToolsSource().catch(console.error);