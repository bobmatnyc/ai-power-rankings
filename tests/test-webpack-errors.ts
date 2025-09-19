#!/usr/bin/env node
import puppeteer from 'puppeteer';

async function testWebpackErrors() {
  console.log('🔍 Testing for webpack module loading errors...');

  const browser = await puppeteer.launch({
    headless: false, // Set to false to see the browser
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // Collect console errors
  const consoleErrors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      consoleErrors.push(text);
      console.log('❌ Console Error:', text);
    }
  });

  page.on('pageerror', (error) => {
    const message = error.message;
    consoleErrors.push(message);
    console.log('❌ Page Error:', message);
  });

  try {
    console.log('📱 Navigating to http://localhost:3001/en...');
    await page.goto('http://localhost:3001/en', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Wait for dynamic imports to load
    console.log('⏳ Waiting for dynamic imports to load...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check for webpack errors specifically
    const webpackErrors = consoleErrors.filter(error =>
      error.includes('Cannot read properties of undefined') ||
      error.includes('webpack') ||
      error.includes('module') ||
      error.includes('call')
    );

    if (webpackErrors.length > 0) {
      console.log('\n❌ WEBPACK ERRORS FOUND:');
      webpackErrors.forEach(error => console.log('  -', error));
      console.log('\n🔴 Test FAILED: Webpack module loading errors detected');
      process.exit(1);
    } else if (consoleErrors.length > 0) {
      console.log('\n⚠️  Other console errors found (not webpack related):');
      consoleErrors.forEach(error => console.log('  -', error));
      console.log('\n🟡 Test PASSED: No webpack errors, but other console errors present');
    } else {
      console.log('\n✅ Test PASSED: No console errors detected!');
    }

    // Take a screenshot for verification
    await page.screenshot({ path: 'webpack-test-result.png' });
    console.log('📸 Screenshot saved as webpack-test-result.png');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

testWebpackErrors().catch(console.error);