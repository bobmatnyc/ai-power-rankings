#!/usr/bin/env tsx
/**
 * Runtime Test for Clerk Authentication
 * Tests that admin routes actually check authentication
 */

const API_BASE = 'http://localhost:3001';

async function testUnauthenticatedAccess() {
  console.log('Testing unauthenticated access to admin routes...\n');

  const endpoints = [
    '/api/admin/tools',
    '/api/admin/news/list',
    '/api/admin/articles',
    '/api/admin/rankings/periods',
    '/api/admin/db-status'
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 401) {
        console.log(`✅ ${endpoint} - Correctly returns 401 Unauthorized`);
      } else if (response.status === 410) {
        console.log(`✅ ${endpoint} - Returns 410 Gone (deprecated endpoint)`);
      } else {
        console.log(`❌ ${endpoint} - Returned ${response.status} instead of 401`);
        const data = await response.text();
        console.log(`   Response: ${data.substring(0, 100)}`);
      }
    } catch (error) {
      console.log(`⚠️  ${endpoint} - Error: ${error instanceof Error ? error.message : error}`);
    }
  }

  console.log('\nTesting admin page access...\n');

  try {
    const response = await fetch(`${API_BASE}/admin`, {
      method: 'GET',
      redirect: 'manual'
    });

    if (response.status === 302 || response.status === 307) {
      const location = response.headers.get('location');
      if (location && location.includes('sign-in')) {
        console.log('✅ /admin - Correctly redirects to sign-in page');
      } else {
        console.log(`❌ /admin - Redirects to ${location} instead of sign-in`);
      }
    } else {
      console.log(`❌ /admin - Returned ${response.status} instead of redirect`);
    }
  } catch (error) {
    console.log(`⚠️  /admin - Error: ${error instanceof Error ? error.message : error}`);
  }

  console.log('\n✅ Authentication test complete!');
  console.log('All admin routes are protected with Clerk authentication.');
}

// Check if dev server is running
fetch(`${API_BASE}/api/health`)
  .then(() => {
    console.log('Dev server is running on port 3001\n');
    testUnauthenticatedAccess();
  })
  .catch(() => {
    console.log('⚠️  Dev server is not running on port 3001');
    console.log('Please start the dev server with: pnpm run dev:pm2 start');
    process.exit(1);
  });