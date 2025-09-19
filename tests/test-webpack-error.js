#!/usr/bin/env node

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

// Colors for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  reset: '\x1b[0m'
};

async function testWebpackError() {
  console.log(`${colors.cyan}Starting Puppeteer test for webpack errors...${colors.reset}\n`);

  let browser;
  const errors = [];
  const warnings = [];
  const logs = [];

  try {
    // Launch browser with detailed settings
    browser = await puppeteer.launch({
      headless: 'new', // Use new headless mode
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ],
      dumpio: false // Set to true if you want to see browser console
    });

    const page = await browser.newPage();

    // Set viewport
    await page.setViewport({ width: 1920, height: 1080 });

    // Enable console logging
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      const location = msg.location();

      // Capture the full message details
      const fullMessage = {
        type,
        text,
        location,
        timestamp: new Date().toISOString()
      };

      if (type === 'error') {
        errors.push(fullMessage);
        console.log(`${colors.red}[BROWSER ERROR]${colors.reset} ${text}`);
        if (location.url) {
          console.log(`  Source: ${location.url}:${location.lineNumber}:${location.columnNumber}`);
        }
      } else if (type === 'warning' || type === 'warn') {
        warnings.push(fullMessage);
        console.log(`${colors.yellow}[BROWSER WARNING]${colors.reset} ${text}`);
      } else {
        logs.push(fullMessage);
        if (process.env.VERBOSE) {
          console.log(`${colors.white}[BROWSER LOG]${colors.reset} ${text}`);
        }
      }
    });

    // Catch page errors (uncaught exceptions)
    page.on('pageerror', error => {
      const errorDetail = {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      };
      errors.push(errorDetail);
      console.log(`${colors.red}[PAGE ERROR]${colors.reset} ${error.message}`);
      if (error.stack) {
        console.log(`${colors.red}Stack trace:${colors.reset}`);
        console.log(error.stack);
      }
    });

    // Catch failed requests
    page.on('requestfailed', request => {
      const failure = {
        url: request.url(),
        failure: request.failure(),
        timestamp: new Date().toISOString()
      };
      console.log(`${colors.red}[REQUEST FAILED]${colors.reset} ${request.url()}`);
      if (request.failure()) {
        console.log(`  Reason: ${request.failure().errorText}`);
      }
    });

    // Track responses
    page.on('response', response => {
      if (!response.ok() && response.status() >= 400) {
        console.log(`${colors.yellow}[HTTP ${response.status()}]${colors.reset} ${response.url()}`);
      }
    });

    console.log(`${colors.blue}Navigating to http://localhost:3001...${colors.reset}\n`);

    // Navigate to the page with timeout
    try {
      const response = await page.goto('http://localhost:3001', {
        waitUntil: 'networkidle0', // Wait for network to be idle
        timeout: 30000
      });

      console.log(`${colors.green}Page loaded with status: ${response.status()}${colors.reset}\n`);
    } catch (navError) {
      console.log(`${colors.red}Navigation error: ${navError.message}${colors.reset}`);
    }

    // Wait a bit for any async errors to appear
    console.log(`${colors.blue}Waiting for potential async errors...${colors.reset}`);
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Try to get more detailed error information from the page
    const pageErrors = await page.evaluate(() => {
      const errors = [];

      // Check if there are any webpack-specific errors
      if (window.__webpack_require__) {
        errors.push({
          type: 'webpack_info',
          message: 'Webpack is loaded',
          modules: Object.keys(window.__webpack_require__.m || {}).length
        });
      }

      // Check for Next.js specific errors
      if (window.__NEXT_DATA__) {
        errors.push({
          type: 'nextjs_info',
          buildId: window.__NEXT_DATA__.buildId,
          page: window.__NEXT_DATA__.page
        });
      }

      // Look for any error elements on the page
      const errorElements = document.querySelectorAll('[class*="error"], [class*="Error"], #__next-build-error');
      errorElements.forEach(el => {
        if (el.textContent) {
          errors.push({
            type: 'dom_error',
            text: el.textContent.substring(0, 500),
            className: el.className
          });
        }
      });

      return errors;
    });

    if (pageErrors.length > 0) {
      console.log(`\n${colors.cyan}Page context information:${colors.reset}`);
      pageErrors.forEach(err => {
        console.log(JSON.stringify(err, null, 2));
      });
    }

    // Take a screenshot
    const screenshotPath = path.join(__dirname, 'webpack-error-screenshot.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`\n${colors.green}Screenshot saved to: ${screenshotPath}${colors.reset}`);

    // Get the page HTML for debugging
    const html = await page.content();
    const htmlPath = path.join(__dirname, 'webpack-error-page.html');
    fs.writeFileSync(htmlPath, html);
    console.log(`${colors.green}Page HTML saved to: ${htmlPath}${colors.reset}`);

    // Summary
    console.log(`\n${colors.magenta}=== TEST SUMMARY ===${colors.reset}`);
    console.log(`Total errors found: ${colors.red}${errors.length}${colors.reset}`);
    console.log(`Total warnings found: ${colors.yellow}${warnings.length}${colors.reset}`);
    console.log(`Total logs captured: ${logs.length}`);

    if (errors.length > 0) {
      console.log(`\n${colors.red}=== DETAILED ERRORS ===${colors.reset}`);
      errors.forEach((error, index) => {
        console.log(`\n${colors.red}Error #${index + 1}:${colors.reset}`);
        console.log(JSON.stringify(error, null, 2));
      });

      // Save errors to file for further analysis
      const errorPath = path.join(__dirname, 'webpack-errors.json');
      fs.writeFileSync(errorPath, JSON.stringify({ errors, warnings, logs }, null, 2));
      console.log(`\n${colors.green}Detailed errors saved to: ${errorPath}${colors.reset}`);

      // Analyze the error to find the root cause
      console.log(`\n${colors.cyan}=== ERROR ANALYSIS ===${colors.reset}`);
      errors.forEach(error => {
        if (error.text && error.text.includes('Cannot read properties of undefined')) {
          console.log(`${colors.red}Found the webpack error!${colors.reset}`);
          console.log('This error typically indicates:');
          console.log('1. A missing module dependency');
          console.log('2. Incorrect import/export syntax');
          console.log('3. Circular dependencies');
          console.log('4. Missing polyfills or browser compatibility issues');

          if (error.location && error.location.url) {
            console.log(`\nError location: ${error.location.url}`);
            console.log(`Line: ${error.location.lineNumber}, Column: ${error.location.columnNumber}`);
          }
        }
      });
    }

    // Check if the page is actually functional
    const pageTitle = await page.title();
    console.log(`\n${colors.blue}Page title: "${pageTitle}"${colors.reset}`);

    // Try to interact with the page
    const hasContent = await page.evaluate(() => {
      const content = document.body.textContent || '';
      return {
        hasText: content.trim().length > 0,
        bodyClasses: document.body.className,
        rootElement: document.getElementById('__next') ? 'Next.js app found' : 'No Next.js root'
      };
    });

    console.log(`\n${colors.cyan}Page state:${colors.reset}`);
    console.log(JSON.stringify(hasContent, null, 2));

  } catch (error) {
    console.error(`${colors.red}Test script error: ${error.message}${colors.reset}`);
    console.error(error.stack);
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  // Return exit code based on errors
  process.exit(errors.length > 0 ? 1 : 0);
}

// Run the test
testWebpackError().catch(error => {
  console.error(`${colors.red}Fatal error: ${error}${colors.reset}`);
  process.exit(1);
});