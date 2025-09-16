#!/usr/bin/env node

/**
 * Test script for admin authentication
 * Usage: node scripts/test-admin-auth.js
 */

const https = require('https');
const http = require('http');

// Configuration
const HOST = process.env.TEST_HOST || 'localhost';
const PORT = process.env.TEST_PORT || '3001';
const PROTOCOL = process.env.TEST_PROTOCOL || 'http';
const PASSWORD = 'SuperSecure2025!@#';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const client = options.protocol === 'https:' ? https : http;

    const req = client.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const json = JSON.parse(responseData);
          resolve({ statusCode: res.statusCode, headers: res.headers, data: json });
        } catch (e) {
          resolve({ statusCode: res.statusCode, headers: res.headers, data: responseData });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(data);
    }

    req.end();
  });
}

async function testLogin() {
  log('\n=== Testing Admin Authentication ===\n', 'blue');
  log(`Target: ${PROTOCOL}://${HOST}:${PORT}`, 'gray');
  log(`Password: ${PASSWORD}`, 'gray');

  try {
    // Test login
    log('\n1. Testing login endpoint...', 'yellow');

    const loginData = JSON.stringify({ password: PASSWORD });
    const loginOptions = {
      protocol: PROTOCOL + ':',
      hostname: HOST,
      port: PORT,
      path: '/api/admin/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': loginData.length
      }
    };

    const loginResult = await makeRequest(loginOptions, loginData);

    if (loginResult.statusCode === 200) {
      log('✓ Login successful!', 'green');
      log(`Response: ${JSON.stringify(loginResult.data, null, 2)}`, 'gray');

      // Extract session cookie
      const cookies = loginResult.headers['set-cookie'];
      if (cookies) {
        const sessionCookie = cookies.find(c => c.includes('admin-session'));
        if (sessionCookie) {
          log(`✓ Session cookie received: ${sessionCookie.split(';')[0]}`, 'green');

          // Test authenticated request
          log('\n2. Testing authenticated request...', 'yellow');

          const testOptions = {
            protocol: PROTOCOL + ':',
            hostname: HOST,
            port: PORT,
            path: '/api/admin/test',
            method: 'GET',
            headers: {
              'Cookie': sessionCookie.split(';')[0]
            }
          };

          const testResult = await makeRequest(testOptions);

          if (testResult.statusCode === 200) {
            log('✓ Authenticated request successful!', 'green');
            log(`Response: ${JSON.stringify(testResult.data, null, 2)}`, 'gray');
          } else {
            log(`✗ Authenticated request failed with status ${testResult.statusCode}`, 'red');
            log(`Response: ${JSON.stringify(testResult.data, null, 2)}`, 'gray');
          }

          // Test logout
          log('\n3. Testing logout...', 'yellow');

          const logoutOptions = {
            protocol: PROTOCOL + ':',
            hostname: HOST,
            port: PORT,
            path: '/api/admin/logout',
            method: 'POST',
            headers: {
              'Cookie': sessionCookie.split(';')[0]
            }
          };

          const logoutResult = await makeRequest(logoutOptions);

          if (logoutResult.statusCode === 200) {
            log('✓ Logout successful!', 'green');
            log(`Response: ${JSON.stringify(logoutResult.data, null, 2)}`, 'gray');
          } else {
            log(`✗ Logout failed with status ${logoutResult.statusCode}`, 'red');
            log(`Response: ${JSON.stringify(logoutResult.data, null, 2)}`, 'gray');
          }

        } else {
          log('✗ No session cookie received', 'red');
        }
      } else {
        log('✗ No cookies received', 'red');
      }
    } else {
      log(`✗ Login failed with status ${loginResult.statusCode}`, 'red');
      log(`Response: ${JSON.stringify(loginResult.data, null, 2)}`, 'red');
    }

  } catch (error) {
    log(`\n✗ Test failed with error: ${error.message}`, 'red');
    console.error(error);
  }

  log('\n=== Test Complete ===\n', 'blue');
}

// Alternative auth endpoint test
async function testAuthEndpoint() {
  log('\n=== Testing /api/admin/auth Endpoint ===\n', 'blue');

  try {
    const authData = JSON.stringify({ password: PASSWORD });
    const authOptions = {
      protocol: PROTOCOL + ':',
      hostname: HOST,
      port: PORT,
      path: '/api/admin/auth',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': authData.length
      }
    };

    const authResult = await makeRequest(authOptions, authData);

    if (authResult.statusCode === 200) {
      log('✓ Auth endpoint successful!', 'green');
      log(`Response: ${JSON.stringify(authResult.data, null, 2)}`, 'gray');
    } else {
      log(`✗ Auth endpoint failed with status ${authResult.statusCode}`, 'red');
      log(`Response: ${JSON.stringify(authResult.data, null, 2)}`, 'red');
    }

  } catch (error) {
    log(`\n✗ Auth endpoint test failed: ${error.message}`, 'red');
  }
}

// Run tests
async function runTests() {
  await testLogin();
  await testAuthEndpoint();
}

runTests();