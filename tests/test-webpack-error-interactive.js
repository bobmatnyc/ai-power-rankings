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

async function testWebpackErrorInteractive() {
  console.log(`${colors.cyan}Starting INTERACTIVE Puppeteer test for webpack errors...${colors.reset}\n`);

  let browser;
  const allErrors = [];

  try {
    // Launch browser in NON-headless mode to see what's happening
    browser = await puppeteer.launch({
      headless: false, // Show the browser
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--start-maximized'
      ],
      devtools: true // Open devtools automatically
    });

    const page = await browser.newPage();

    // Set viewport
    await page.setViewport({ width: 1920, height: 1080 });

    // Enable detailed console logging
    page.on('console', async msg => {
      const type = msg.type();

      // Try to get the full error details including stack trace
      let details = '';
      try {
        const args = await Promise.all(msg.args().map(arg => arg.jsonValue().catch(() => arg.toString())));
        details = args.join(' ');
      } catch {
        details = msg.text();
      }

      if (type === 'error') {
        const error = {
          type,
          text: msg.text(),
          details,
          location: msg.location(),
          timestamp: new Date().toISOString()
        };
        allErrors.push(error);
        console.log(`${colors.red}[ERROR CAPTURED]${colors.reset} ${msg.text()}`);
        if (details && details !== msg.text()) {
          console.log(`${colors.red}[DETAILS]${colors.reset} ${details}`);
        }
        if (msg.location().url) {
          console.log(`  ${colors.yellow}Source:${colors.reset} ${msg.location().url}:${msg.location().lineNumber}`);
        }
      }
    });

    // Catch page errors (uncaught exceptions)
    page.on('pageerror', error => {
      const errorDetail = {
        type: 'pageerror',
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      };
      allErrors.push(errorDetail);
      console.log(`${colors.red}[UNCAUGHT ERROR]${colors.reset} ${error.message}`);
      if (error.stack) {
        console.log(`${colors.red}[STACK]${colors.reset}\n${error.stack}`);
      }
    });

    console.log(`${colors.blue}Navigating to http://localhost:3001...${colors.reset}\n`);
    console.log(`${colors.yellow}Browser window will open with DevTools. Check the Console tab for errors.${colors.reset}\n`);

    // Navigate to the page
    await page.goto('http://localhost:3001', {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    console.log(`${colors.green}Page loaded. Check the browser console for any errors.${colors.reset}\n`);

    // Wait for user to interact
    console.log(`${colors.cyan}=== INTERACTIVE TEST MODE ===${colors.reset}`);
    console.log('1. The browser window is now open with DevTools');
    console.log('2. Check the Console tab for any errors');
    console.log('3. Try interacting with the page (click buttons, navigate, etc.)');
    console.log('4. Look for the "Cannot read properties of undefined (reading \'call\')" error');
    console.log(`5. Press ${colors.green}ENTER${colors.reset} in this terminal when done to capture the final state\n`);

    // Wait for user input
    await new Promise(resolve => {
      process.stdin.once('data', resolve);
    });

    // Capture the current state
    console.log(`${colors.blue}Capturing final state...${colors.reset}`);

    // Check for webpack-specific issues
    const diagnostics = await page.evaluate(() => {
      const results = {
        webpack: {},
        nextjs: {},
        errors: [],
        performance: {}
      };

      // Check webpack
      if (typeof __webpack_require__ !== 'undefined') {
        results.webpack.loaded = true;
        results.webpack.moduleCount = Object.keys(__webpack_require__.m || {}).length;

        // Try to find problematic modules
        try {
          const modules = __webpack_require__.m;
          for (const id in modules) {
            try {
              // Check if module can be called
              if (typeof modules[id] !== 'function') {
                results.errors.push({
                  type: 'invalid_module',
                  id,
                  moduleType: typeof modules[id]
                });
              }
            } catch (e) {
              results.errors.push({
                type: 'module_check_error',
                id,
                error: e.message
              });
            }
          }
        } catch (e) {
          results.webpack.error = e.message;
        }
      }

      // Check Next.js
      if (window.__NEXT_DATA__) {
        results.nextjs.loaded = true;
        results.nextjs.buildId = window.__NEXT_DATA__.buildId;
        results.nextjs.page = window.__NEXT_DATA__.page;
      }

      // Check performance
      if (window.performance) {
        const entries = performance.getEntriesByType('resource');
        results.performance.resourceCount = entries.length;
        results.performance.failedResources = entries.filter(e => e.responseEnd === 0).map(e => e.name);
      }

      return results;
    });

    console.log(`\n${colors.cyan}=== DIAGNOSTICS ===${colors.reset}`);
    console.log(JSON.stringify(diagnostics, null, 2));

    // Take a final screenshot
    const screenshotPath = path.join(__dirname, 'webpack-error-interactive.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`\n${colors.green}Screenshot saved to: ${screenshotPath}${colors.reset}`);

    // Save all errors
    if (allErrors.length > 0) {
      const errorPath = path.join(__dirname, 'webpack-errors-interactive.json');
      fs.writeFileSync(errorPath, JSON.stringify(allErrors, null, 2));
      console.log(`${colors.green}Errors saved to: ${errorPath}${colors.reset}`);

      console.log(`\n${colors.red}=== TOTAL ERRORS CAPTURED: ${allErrors.length} ===${colors.reset}`);
      allErrors.forEach((error, i) => {
        console.log(`\n${colors.red}Error #${i + 1}:${colors.reset}`);
        console.log(JSON.stringify(error, null, 2));
      });
    } else {
      console.log(`\n${colors.green}No errors were captured during the test.${colors.reset}`);
    }

    // Don't close the browser immediately
    console.log(`\n${colors.yellow}Browser will remain open. Close it manually when done.${colors.reset}`);

  } catch (error) {
    console.error(`${colors.red}Test script error: ${error.message}${colors.reset}`);
    console.error(error.stack);
  }
}

// Enable stdin for interactive mode
process.stdin.setRawMode(true);
process.stdin.resume();

// Run the test
testWebpackErrorInteractive().catch(error => {
  console.error(`${colors.red}Fatal error: ${error}${colors.reset}`);
  process.exit(1);
});