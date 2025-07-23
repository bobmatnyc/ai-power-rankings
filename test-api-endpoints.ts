#!/usr/bin/env npx tsx

async function testApiEndpoints() {
  console.log('Testing API endpoints with new tool structure...\n');
  
  const baseUrl = 'http://localhost:3007';
  
  try {
    // Test 1: Get all tools
    console.log('1. Testing GET /api/tools...');
    const allToolsRes = await fetch(`${baseUrl}/api/tools`);
    const allTools = await allToolsRes.json();
    console.log(`   ✓ Status: ${allToolsRes.status}`);
    console.log(`   ✓ Found ${allTools.length} tools`);
    
    // Test 2: Get tool by slug
    console.log('\n2. Testing GET /api/tools/[slug]...');
    const testSlugs = ['claude-code', 'cursor', 'github-copilot'];
    
    for (const slug of testSlugs) {
      const res = await fetch(`${baseUrl}/api/tools/${slug}`);
      
      if (res.ok) {
        const tool = await res.json();
        console.log(`   ✓ ${slug}: ${tool.name} (ID: ${tool.id})`);
      } else {
        console.log(`   ✗ ${slug}: Status ${res.status}`);
      }
    }
    
    // Test 3: Categories endpoint
    console.log('\n3. Testing GET /api/tools/categories...');
    const categoriesRes = await fetch(`${baseUrl}/api/tools/categories`);
    const categories = await categoriesRes.json();
    console.log(`   ✓ Status: ${categoriesRes.status}`);
    console.log(`   ✓ Found ${Object.keys(categories).length} categories`);
    
    // Show category counts
    console.log('\n   Category counts:');
    for (const [category, count] of Object.entries(categories)) {
      console.log(`     - ${category}: ${count}`);
    }
    
  } catch (error) {
    console.error('Error testing endpoints:', error);
    console.error('\nMake sure the dev server is running on port 3007');
  }
}

testApiEndpoints();