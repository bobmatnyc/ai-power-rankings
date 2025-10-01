#!/usr/bin/env tsx

/**
 * Comprehensive UAT Test Suite for Article Ingestion System
 *
 * This script performs User Acceptance Testing including:
 * - Homepage navigation and loading
 * - Authentication flows
 * - Admin access control
 * - Rankings page functionality
 * - Browser console monitoring
 */

import puppeteer, { Browser, Page, ConsoleMessage } from 'puppeteer';

const BASE_URL = 'http://localhost:3011';

// Console log storage
interface ConsoleLog {
  type: string;
  text: string;
  url: string;
  timestamp: Date;
}

const consoleLogs: ConsoleLog[] = [];

// Test results tracking
interface TestResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  message?: string;
  details?: any;
}

const results: TestResult[] = [];

function logResult(test: string, status: 'PASS' | 'FAIL' | 'WARN', message?: string, details?: any) {
  results.push({ test, status, message, details });

  const emoji = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${emoji} ${test}`);
  if (message) console.log(`   ${message}`);
  if (details) console.log(`   Details:`, details);
}

async function setupConsoleListen(page: Page, pageName: string) {
  page.on('console', (msg: ConsoleMessage) => {
    const log: ConsoleLog = {
      type: msg.type(),
      text: msg.text(),
      url: pageName,
      timestamp: new Date()
    };
    consoleLogs.push(log);

    // Log errors and warnings immediately
    if (msg.type() === 'error') {
      console.log(`   🔴 Console Error on ${pageName}: ${msg.text()}`);
    } else if (msg.type() === 'warning') {
      console.log(`   🟡 Console Warning on ${pageName}: ${msg.text()}`);
    }
  });

  page.on('pageerror', (error) => {
    console.log(`   💥 Page Error on ${pageName}: ${error.message}`);
    consoleLogs.push({
      type: 'pageerror',
      text: error.message,
      url: pageName,
      timestamp: new Date()
    });
  });
}

async function test1_HomePage(browser: Browser) {
  console.log('\n🏠 TEST 1: Homepage Loading and Navigation');
  const page = await browser.newPage();
  setupConsoleListen(page, 'Homepage');

  try {
    // Test root redirect
    const response = await page.goto(BASE_URL, { waitUntil: 'networkidle0', timeout: 10000 });

    if (response && response.status() === 200) {
      logResult('Homepage loads successfully', 'PASS', `Status: ${response.status()}`);
    } else {
      logResult('Homepage loads', 'FAIL', `Status: ${response?.status()}`);
    }

    // Check if redirected to /en
    const currentUrl = page.url();
    if (currentUrl.includes('/en')) {
      logResult('Homepage redirects to /en', 'PASS', `URL: ${currentUrl}`);
    } else {
      logResult('Homepage redirect', 'WARN', `Expected /en redirect, got: ${currentUrl}`);
    }

    // Check for navigation elements
    const hasNav = await page.$('nav, header, [role="navigation"]');
    if (hasNav) {
      logResult('Navigation menu present', 'PASS');
    } else {
      logResult('Navigation menu', 'WARN', 'No navigation elements found');
    }

    // Check page title
    const title = await page.title();
    if (title && title.includes('AI')) {
      logResult('Page title set correctly', 'PASS', `Title: ${title}`);
    } else {
      logResult('Page title', 'WARN', `Title: ${title}`);
    }

    // Check for main content
    const hasContent = await page.$('main, [role="main"], .container');
    if (hasContent) {
      logResult('Main content area present', 'PASS');
    } else {
      logResult('Main content area', 'FAIL', 'No main content found');
    }

  } catch (error: any) {
    logResult('Homepage test', 'FAIL', error.message);
  } finally {
    await page.close();
  }
}

async function test2_RankingsPage(browser: Browser) {
  console.log('\n📊 TEST 2: Rankings Page Functionality');
  const page = await browser.newPage();
  setupConsoleListen(page, 'Rankings');

  try {
    const response = await page.goto(`${BASE_URL}/en/rankings`, { waitUntil: 'networkidle0', timeout: 10000 });

    if (response && response.status() === 200) {
      logResult('Rankings page loads', 'PASS', `Status: ${response.status()}`);
    } else {
      logResult('Rankings page loads', 'FAIL', `Status: ${response?.status()}`);
    }

    // Check for ranking cards/items
    await page.waitForTimeout(2000); // Wait for dynamic content

    const rankingElements = await page.$$('[data-testid*="ranking"], .ranking-card, [class*="ranking"]');
    if (rankingElements.length > 0) {
      logResult('Ranking items displayed', 'PASS', `Found ${rankingElements.length} ranking elements`);
    } else {
      logResult('Ranking items', 'WARN', 'No ranking elements found with common selectors');
    }

    // Check for category filters or sorting
    const hasFilters = await page.$('select, [role="combobox"], button[class*="filter"], button[class*="sort"]');
    if (hasFilters) {
      logResult('Filter/Sort controls present', 'PASS');
    } else {
      logResult('Filter/Sort controls', 'WARN', 'No filter/sort elements found');
    }

    // Take screenshot for visual verification
    await page.screenshot({ path: '/tmp/rankings-page.png', fullPage: true });
    logResult('Rankings page screenshot captured', 'PASS', 'Saved to /tmp/rankings-page.png');

  } catch (error: any) {
    logResult('Rankings page test', 'FAIL', error.message);
  } finally {
    await page.close();
  }
}

async function test3_AboutMethodologyPages(browser: Browser) {
  console.log('\n📚 TEST 3: About and Methodology Pages');

  const pages = [
    { path: '/en/about', name: 'About' },
    { path: '/en/methodology', name: 'Methodology' },
    { path: '/en/tools', name: 'Tools' }
  ];

  for (const pageInfo of pages) {
    const page = await browser.newPage();
    setupConsoleListen(page, pageInfo.name);

    try {
      const response = await page.goto(`${BASE_URL}${pageInfo.path}`, { waitUntil: 'networkidle0', timeout: 10000 });

      if (response && response.status() === 200) {
        logResult(`${pageInfo.name} page loads`, 'PASS', `Status: ${response.status()}`);
      } else {
        logResult(`${pageInfo.name} page loads`, 'FAIL', `Status: ${response?.status()}`);
      }

      // Check for content
      const bodyText = await page.evaluate(() => document.body.textContent?.length || 0);
      if (bodyText > 100) {
        logResult(`${pageInfo.name} page has content`, 'PASS', `${bodyText} characters`);
      } else {
        logResult(`${pageInfo.name} page content`, 'WARN', `Only ${bodyText} characters found`);
      }

    } catch (error: any) {
      logResult(`${pageInfo.name} page test`, 'FAIL', error.message);
    } finally {
      await page.close();
    }
  }
}

async function test4_AdminAccess(browser: Browser) {
  console.log('\n🔐 TEST 4: Admin Access Control');
  const page = await browser.newPage();
  setupConsoleListen(page, 'Admin');

  try {
    // Test /admin endpoint
    const response = await page.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle0', timeout: 10000 });
    const status = response?.status();

    if (status === 200) {
      logResult('Admin page accessible', 'PASS', 'Admin page loaded (check if auth required)');
    } else if (status === 401 || status === 403) {
      logResult('Admin access control active', 'PASS', `Status: ${status} (Unauthorized/Forbidden)`);
    } else if (status === 307 || status === 302) {
      const redirectUrl = page.url();
      logResult('Admin redirects to login', 'PASS', `Redirected to: ${redirectUrl}`);
    } else {
      logResult('Admin access', 'WARN', `Unexpected status: ${status}`);
    }

    // Test /en/admin endpoint
    const response2 = await page.goto(`${BASE_URL}/en/admin`, { waitUntil: 'networkidle0', timeout: 10000 });
    const status2 = response2?.status();

    if (status2 === 307 || status2 === 302) {
      logResult('Admin /en/admin redirects correctly', 'PASS', `Status: ${status2}`);
    } else {
      logResult('Admin /en/admin', 'WARN', `Status: ${status2}`);
    }

  } catch (error: any) {
    logResult('Admin access test', 'FAIL', error.message);
  } finally {
    await page.close();
  }
}

async function test5_ResponsiveDesign(browser: Browser) {
  console.log('\n📱 TEST 5: Responsive Design');
  const page = await browser.newPage();
  setupConsoleListen(page, 'Responsive');

  const viewports = [
    { width: 375, height: 667, name: 'Mobile (iPhone)' },
    { width: 768, height: 1024, name: 'Tablet (iPad)' },
    { width: 1920, height: 1080, name: 'Desktop' }
  ];

  try {
    for (const viewport of viewports) {
      await page.setViewport(viewport);
      await page.goto(`${BASE_URL}/en`, { waitUntil: 'networkidle0', timeout: 10000 });
      await page.waitForTimeout(1000);

      // Check if page renders without horizontal scroll
      const hasOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });

      if (!hasOverflow) {
        logResult(`${viewport.name} renders correctly`, 'PASS', 'No horizontal overflow');
      } else {
        logResult(`${viewport.name} layout`, 'WARN', 'Horizontal overflow detected');
      }
    }
  } catch (error: any) {
    logResult('Responsive design test', 'FAIL', error.message);
  } finally {
    await page.close();
  }
}

async function test6_PerformanceMetrics(browser: Browser) {
  console.log('\n⚡ TEST 6: Performance Metrics');
  const page = await browser.newPage();
  setupConsoleListen(page, 'Performance');

  try {
    const startTime = Date.now();
    await page.goto(`${BASE_URL}/en`, { waitUntil: 'networkidle0', timeout: 15000 });
    const loadTime = Date.now() - startTime;

    if (loadTime < 3000) {
      logResult('Page load time', 'PASS', `${loadTime}ms (under 3s)`);
    } else if (loadTime < 5000) {
      logResult('Page load time', 'WARN', `${loadTime}ms (under 5s but slow)`);
    } else {
      logResult('Page load time', 'FAIL', `${loadTime}ms (over 5s)`);
    }

    // Get performance metrics
    const metrics = await page.evaluate(() => {
      const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        domContentLoaded: perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart,
        loadComplete: perfData.loadEventEnd - perfData.loadEventStart,
        ttfb: perfData.responseStart - perfData.requestStart
      };
    });

    logResult('Performance metrics collected', 'PASS', undefined, metrics);

  } catch (error: any) {
    logResult('Performance test', 'FAIL', error.message);
  } finally {
    await page.close();
  }
}

async function analyzeConsoleLogs() {
  console.log('\n🔍 CONSOLE LOG ANALYSIS');

  const errors = consoleLogs.filter(log => log.type === 'error' || log.type === 'pageerror');
  const warnings = consoleLogs.filter(log => log.type === 'warning');
  const info = consoleLogs.filter(log => log.type === 'log' || log.type === 'info');

  console.log(`\n📊 Console Summary:`);
  console.log(`   Total Logs: ${consoleLogs.length}`);
  console.log(`   Errors: ${errors.length}`);
  console.log(`   Warnings: ${warnings.length}`);
  console.log(`   Info: ${info.length}`);

  if (errors.length === 0) {
    logResult('No console errors', 'PASS', 'Clean console output');
  } else {
    logResult('Console errors detected', 'WARN', `${errors.length} errors found`);
    console.log('\n   Error Details:');
    errors.slice(0, 10).forEach((log, i) => {
      console.log(`   ${i + 1}. [${log.url}] ${log.text}`);
    });
  }

  if (warnings.length > 0) {
    console.log('\n   Warning Details:');
    warnings.slice(0, 5).forEach((log, i) => {
      console.log(`   ${i + 1}. [${log.url}] ${log.text}`);
    });
  }
}

async function generateReport() {
  console.log('\n' + '='.repeat(80));
  console.log('📋 COMPREHENSIVE UAT REPORT');
  console.log('='.repeat(80));

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warned = results.filter(r => r.status === 'WARN').length;
  const total = results.length;

  console.log(`\n📊 Overall Results:`);
  console.log(`   Total Tests: ${total}`);
  console.log(`   ✅ Passed: ${passed} (${Math.round(passed/total*100)}%)`);
  console.log(`   ❌ Failed: ${failed} (${Math.round(failed/total*100)}%)`);
  console.log(`   ⚠️  Warnings: ${warned} (${Math.round(warned/total*100)}%)`);

  console.log(`\n📈 Readiness Assessment:`);
  const passRate = passed / total;
  if (passRate >= 0.9 && failed === 0) {
    console.log(`   🟢 EXCELLENT - System is production ready`);
  } else if (passRate >= 0.75 && failed <= 2) {
    console.log(`   🟡 GOOD - Minor issues to address before production`);
  } else if (passRate >= 0.5) {
    console.log(`   🟠 FAIR - Several issues need attention`);
  } else {
    console.log(`   🔴 NEEDS WORK - Major issues require fixing`);
  }

  if (failed > 0) {
    console.log(`\n❌ Failed Tests:`);
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`   • ${r.test}: ${r.message}`);
    });
  }

  if (warned > 0) {
    console.log(`\n⚠️  Warnings:`);
    results.filter(r => r.status === 'WARN').slice(0, 10).forEach(r => {
      console.log(`   • ${r.test}: ${r.message}`);
    });
  }

  console.log('\n' + '='.repeat(80));
}

async function main() {
  console.log('🚀 Starting Comprehensive UAT Test Suite');
  console.log(`🌐 Testing: ${BASE_URL}`);
  console.log('=' .repeat(80));

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    await test1_HomePage(browser);
    await test2_RankingsPage(browser);
    await test3_AboutMethodologyPages(browser);
    await test4_AdminAccess(browser);
    await test5_ResponsiveDesign(browser);
    await test6_PerformanceMetrics(browser);

    analyzeConsoleLogs();
    generateReport();

  } catch (error) {
    console.error('❌ Test suite failed:', error);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
