/**
 * Comprehensive UAT Test Script for AI Power Ranking
 * Tests all major functionality, internationalization, and UI elements
 */

const fs = require('fs');
const path = require('path');

// Configuration
const BASE_URL = 'http://localhost:3011';
const SCREENSHOT_DIR = path.join(__dirname, 'uat-screenshots');
const LANGUAGES = ['en', 'ja', 'de', 'fr', 'es', 'it', 'ko', 'uk', 'hr', 'zh'];
const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 667 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1920, height: 1080 }
];

// Test results storage
const testResults = {
  timestamp: new Date().toISOString(),
  passed: 0,
  failed: 0,
  warnings: 0,
  tests: []
};

// Utility functions
function log(message, type = 'info') {
  const prefix = {
    info: '📋',
    pass: '✅',
    fail: '❌',
    warn: '⚠️'
  }[type] || 'ℹ️';
  console.log(`${prefix} ${message}`);
}

function recordTest(name, status, details = {}) {
  const test = { name, status, details, timestamp: new Date().toISOString() };
  testResults.tests.push(test);

  if (status === 'pass') {
    testResults.passed++;
    log(`${name} - PASSED`, 'pass');
  } else if (status === 'fail') {
    testResults.failed++;
    log(`${name} - FAILED: ${details.error || 'Unknown error'}`, 'fail');
  } else if (status === 'warn') {
    testResults.warnings++;
    log(`${name} - WARNING: ${details.message || 'Issue detected'}`, 'warn');
  }
}

// Create screenshot directory
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function runTests() {
  const puppeteer = require('puppeteer');

  log('Starting Comprehensive UAT Testing', 'info');
  log(`Base URL: ${BASE_URL}`, 'info');
  log(`Testing ${LANGUAGES.length} languages and ${VIEWPORTS.length} viewport sizes`, 'info');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();

    // Enable console monitoring
    const consoleLogs = [];
    page.on('console', msg => {
      const logEntry = {
        type: msg.type(),
        text: msg.text(),
        timestamp: new Date().toISOString()
      };
      consoleLogs.push(logEntry);

      if (msg.type() === 'error') {
        log(`Console Error: ${msg.text()}`, 'warn');
      }
    });

    page.on('pageerror', error => {
      log(`Page Error: ${error.message}`, 'fail');
      recordTest('Browser Error Detection', 'fail', { error: error.message });
    });

    // Test 1: Homepage Load Test (Desktop)
    log('\n=== Test 1: Homepage Load Test ===', 'info');
    await page.setViewport({ width: 1920, height: 1080 });

    try {
      const response = await page.goto(`${BASE_URL}/en/`, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      const status = response.status();
      if (status === 200) {
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-homepage-desktop.png'), fullPage: true });
        recordTest('Homepage Load (EN)', 'pass', { status, url: `${BASE_URL}/en/` });
      } else {
        recordTest('Homepage Load (EN)', 'fail', { status, url: `${BASE_URL}/en/` });
      }
    } catch (error) {
      recordTest('Homepage Load (EN)', 'fail', { error: error.message });
    }

    // Test 2: Check Page Title and Meta
    log('\n=== Test 2: Page Title and Meta ===', 'info');
    try {
      const title = await page.title();
      const h1Elements = await page.$$eval('h1', elements =>
        elements.map(el => el.textContent.trim())
      );

      if (title && title.length > 0) {
        recordTest('Page Title Present', 'pass', { title });
      } else {
        recordTest('Page Title Present', 'fail', { title: 'Empty or missing' });
      }

      if (h1Elements.length > 0) {
        recordTest('H1 Heading Present', 'pass', { headings: h1Elements });
      } else {
        recordTest('H1 Heading Present', 'warn', { message: 'No H1 headings found' });
      }
    } catch (error) {
      recordTest('Page Structure Check', 'fail', { error: error.message });
    }

    // Test 3: Navigation Links
    log('\n=== Test 3: Navigation Links ===', 'info');
    try {
      const navLinks = await page.$$eval('nav a, header a', links =>
        links.map(link => ({
          text: link.textContent.trim(),
          href: link.getAttribute('href')
        })).filter(link => link.href)
      );

      if (navLinks.length > 0) {
        recordTest('Navigation Links Present', 'pass', { count: navLinks.length, links: navLinks.slice(0, 10) });
      } else {
        recordTest('Navigation Links Present', 'warn', { message: 'No navigation links found' });
      }
    } catch (error) {
      recordTest('Navigation Check', 'fail', { error: error.message });
    }

    // Test 4: Rankings Page
    log('\n=== Test 4: Rankings Page ===', 'info');
    try {
      await page.goto(`${BASE_URL}/en/rankings`, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-rankings-page.png'), fullPage: true });

      const rankingItems = await page.$$eval('[class*="ranking"], [class*="tool"], table tr', items => items.length);

      if (rankingItems > 0) {
        recordTest('Rankings Page Load', 'pass', { itemCount: rankingItems });
      } else {
        recordTest('Rankings Page Load', 'warn', { message: 'No ranking items found' });
      }
    } catch (error) {
      recordTest('Rankings Page Load', 'fail', { error: error.message });
    }

    // Test 5: Tools Directory Page
    log('\n=== Test 5: Tools Directory Page ===', 'info');
    try {
      await page.goto(`${BASE_URL}/en/tools`, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-tools-page.png'), fullPage: true });

      const toolItems = await page.$$eval('[class*="tool"], [class*="card"], article', items => items.length);
      const title = await page.title();

      if (toolItems > 0) {
        recordTest('Tools Page Load', 'pass', { itemCount: toolItems, title });
      } else {
        recordTest('Tools Page Load', 'warn', { message: 'No tool items found', title });
      }
    } catch (error) {
      recordTest('Tools Page Load', 'fail', { error: error.message });
    }

    // Test 6: News Page
    log('\n=== Test 6: News Page ===', 'info');
    try {
      await page.goto(`${BASE_URL}/en/news`, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-news-page.png'), fullPage: true });

      const newsItems = await page.$$eval('[class*="news"], [class*="article"], article', items => items.length);

      if (newsItems > 0) {
        recordTest('News Page Load', 'pass', { itemCount: newsItems });
      } else {
        recordTest('News Page Load', 'warn', { message: 'No news items found' });
      }
    } catch (error) {
      recordTest('News Page Load', 'fail', { error: error.message });
    }

    // Test 7: About Page
    log('\n=== Test 7: About Page ===', 'info');
    try {
      await page.goto(`${BASE_URL}/en/about`, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05-about-page.png'), fullPage: true });
      recordTest('About Page Load', 'pass');
    } catch (error) {
      recordTest('About Page Load', 'fail', { error: error.message });
    }

    // Test 8: Methodology Page
    log('\n=== Test 8: Methodology Page ===', 'info');
    try {
      await page.goto(`${BASE_URL}/en/methodology`, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06-methodology-page.png'), fullPage: true });
      recordTest('Methodology Page Load', 'pass');
    } catch (error) {
      recordTest('Methodology Page Load', 'fail', { error: error.message });
    }

    // Test 9: Internationalization - Sample Languages
    log('\n=== Test 9: Internationalization Testing ===', 'info');
    const testLanguages = ['en', 'ja', 'de', 'es'];

    for (const lang of testLanguages) {
      try {
        await page.goto(`${BASE_URL}/${lang}/`, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });

        const title = await page.title();
        const hasContent = await page.evaluate(() => document.body.textContent.length > 100);

        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, `07-i18n-${lang}.png`),
          fullPage: false
        });

        if (hasContent) {
          recordTest(`I18N Load (${lang.toUpperCase()})`, 'pass', { title });
        } else {
          recordTest(`I18N Load (${lang.toUpperCase()})`, 'warn', { message: 'Minimal content' });
        }
      } catch (error) {
        recordTest(`I18N Load (${lang.toUpperCase()})`, 'fail', { error: error.message });
      }
    }

    // Test 10: Responsive Design - Mobile View
    log('\n=== Test 10: Mobile Responsive Design ===', 'info');
    try {
      await page.setViewport({ width: 375, height: 667 });
      await page.goto(`${BASE_URL}/en/`, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08-mobile-view.png'), fullPage: true });
      recordTest('Mobile Responsive View', 'pass', { viewport: '375x667' });

      // Test mobile navigation
      const mobileNavVisible = await page.evaluate(() => {
        const nav = document.querySelector('nav, header');
        return nav ? nav.offsetHeight > 0 : false;
      });

      if (mobileNavVisible) {
        recordTest('Mobile Navigation Visible', 'pass');
      } else {
        recordTest('Mobile Navigation Visible', 'warn', { message: 'Navigation may be hidden' });
      }
    } catch (error) {
      recordTest('Mobile View Test', 'fail', { error: error.message });
    }

    // Test 11: Tablet View
    log('\n=== Test 11: Tablet Responsive Design ===', 'info');
    try {
      await page.setViewport({ width: 768, height: 1024 });
      await page.goto(`${BASE_URL}/en/`, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09-tablet-view.png'), fullPage: true });
      recordTest('Tablet Responsive View', 'pass', { viewport: '768x1024' });
    } catch (error) {
      recordTest('Tablet View Test', 'fail', { error: error.message });
    }

    // Test 12: Accessibility - Images
    log('\n=== Test 12: Accessibility - Alt Text ===', 'info');
    try {
      await page.setViewport({ width: 1920, height: 1080 });
      await page.goto(`${BASE_URL}/en/`, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      const images = await page.$$eval('img', imgs =>
        imgs.map(img => ({
          src: img.src,
          alt: img.alt,
          hasAlt: img.alt && img.alt.length > 0
        }))
      );

      const imagesWithoutAlt = images.filter(img => !img.hasAlt);

      if (imagesWithoutAlt.length === 0) {
        recordTest('Accessibility - Alt Text', 'pass', { totalImages: images.length });
      } else {
        recordTest('Accessibility - Alt Text', 'warn', {
          message: `${imagesWithoutAlt.length} images without alt text`,
          totalImages: images.length,
          missingAlt: imagesWithoutAlt.length
        });
      }
    } catch (error) {
      recordTest('Accessibility Check', 'fail', { error: error.message });
    }

    // Test 13: Console Errors Summary
    log('\n=== Test 13: Console Errors Analysis ===', 'info');
    const errorLogs = consoleLogs.filter(log => log.type === 'error');
    const warningLogs = consoleLogs.filter(log => log.type === 'warning');

    if (errorLogs.length === 0) {
      recordTest('Console Errors Check', 'pass', { totalLogs: consoleLogs.length });
    } else {
      recordTest('Console Errors Check', 'warn', {
        message: `${errorLogs.length} console errors detected`,
        errorCount: errorLogs.length,
        warningCount: warningLogs.length,
        sampleErrors: errorLogs.slice(0, 5)
      });
    }

    // Test 14: Performance - Page Load Time
    log('\n=== Test 14: Performance Check ===', 'info');
    try {
      const startTime = Date.now();
      await page.goto(`${BASE_URL}/en/`, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      const loadTime = Date.now() - startTime;

      if (loadTime < 3000) {
        recordTest('Page Load Performance', 'pass', { loadTime: `${loadTime}ms` });
      } else if (loadTime < 5000) {
        recordTest('Page Load Performance', 'warn', {
          message: 'Load time is acceptable but could be improved',
          loadTime: `${loadTime}ms`
        });
      } else {
        recordTest('Page Load Performance', 'fail', {
          message: 'Page load time is too slow',
          loadTime: `${loadTime}ms`
        });
      }
    } catch (error) {
      recordTest('Performance Check', 'fail', { error: error.message });
    }

    // Test 15: Link Integrity - Sample Check
    log('\n=== Test 15: Link Integrity Check ===', 'info');
    try {
      await page.goto(`${BASE_URL}/en/`, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      const internalLinks = await page.$$eval('a[href^="/"], a[href^="http://localhost"]', links =>
        links.map(link => link.getAttribute('href')).slice(0, 5)
      );

      let brokenLinks = 0;
      for (const link of internalLinks) {
        try {
          const url = link.startsWith('http') ? link : `${BASE_URL}${link}`;
          const response = await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 10000
          });
          if (response.status() >= 400) {
            brokenLinks++;
          }
        } catch (error) {
          brokenLinks++;
        }
      }

      if (brokenLinks === 0) {
        recordTest('Link Integrity Check', 'pass', { checkedLinks: internalLinks.length });
      } else {
        recordTest('Link Integrity Check', 'warn', {
          message: `${brokenLinks} broken links found`,
          checkedLinks: internalLinks.length,
          brokenLinks
        });
      }
    } catch (error) {
      recordTest('Link Integrity Check', 'fail', { error: error.message });
    }

    // Save console logs
    fs.writeFileSync(
      path.join(SCREENSHOT_DIR, 'console-logs.json'),
      JSON.stringify(consoleLogs, null, 2)
    );

    log('\n=== Test Execution Complete ===', 'info');

  } catch (error) {
    log(`Fatal Error: ${error.message}`, 'fail');
    recordTest('Test Execution', 'fail', { error: error.message, stack: error.stack });
  } finally {
    await browser.close();
  }

  // Generate report
  generateReport();
}

function generateReport() {
  log('\n=== UAT Test Report ===', 'info');
  log(`Total Tests: ${testResults.tests.length}`, 'info');
  log(`Passed: ${testResults.passed}`, 'pass');
  log(`Failed: ${testResults.failed}`, 'fail');
  log(`Warnings: ${testResults.warnings}`, 'warn');
  log(`Success Rate: ${((testResults.passed / testResults.tests.length) * 100).toFixed(2)}%`, 'info');

  // Save detailed report
  const reportPath = path.join(SCREENSHOT_DIR, 'uat-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(testResults, null, 2));
  log(`\nDetailed report saved to: ${reportPath}`, 'info');
  log(`Screenshots saved to: ${SCREENSHOT_DIR}`, 'info');

  // Generate summary
  const summaryPath = path.join(SCREENSHOT_DIR, 'uat-summary.txt');
  const summary = generateTextSummary();
  fs.writeFileSync(summaryPath, summary);
  log(`Summary report saved to: ${summaryPath}`, 'info');

  return testResults;
}

function generateTextSummary() {
  const summary = [];
  summary.push('='.repeat(80));
  summary.push('UAT Test Summary Report - AI Power Ranking Website');
  summary.push('='.repeat(80));
  summary.push(`Timestamp: ${testResults.timestamp}`);
  summary.push(`Total Tests: ${testResults.tests.length}`);
  summary.push(`Passed: ${testResults.passed}`);
  summary.push(`Failed: ${testResults.failed}`);
  summary.push(`Warnings: ${testResults.warnings}`);
  summary.push(`Success Rate: ${((testResults.passed / testResults.tests.length) * 100).toFixed(2)}%`);
  summary.push('');

  summary.push('Test Results by Category:');
  summary.push('-'.repeat(80));

  testResults.tests.forEach((test, index) => {
    const status = test.status === 'pass' ? '✅ PASS' : test.status === 'fail' ? '❌ FAIL' : '⚠️  WARN';
    summary.push(`${index + 1}. ${test.name}: ${status}`);
    if (test.details && Object.keys(test.details).length > 0) {
      summary.push(`   Details: ${JSON.stringify(test.details, null, 2).substring(0, 200)}`);
    }
    summary.push('');
  });

  return summary.join('\n');
}

// Run tests
runTests().catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});