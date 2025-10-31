import { test, expect } from '@playwright/test';

test.describe('Find Syntax Error Source', () => {
  test('Identify exact source of syntax error', async ({ page }) => {
    const consoleMessages: Array<{ type: string; text: string; url?: string; lineNumber?: number; columnNumber?: number }> = [];

    // Monitor console with detailed location info
    page.on('console', msg => {
      const location = msg.location();
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        url: location.url,
        lineNumber: location.lineNumber,
        columnNumber: location.columnNumber
      });
    });

    // Monitor page errors with stack traces
    page.on('pageerror', error => {
      console.error('\n=== PAGE ERROR DETECTED ===');
      console.error('Message:', error.message);
      console.error('Stack:', error.stack);
      console.error('===========================\n');

      consoleMessages.push({
        type: 'pageerror',
        text: error.message,
        url: error.stack
      });
    });

    console.log('Loading homepage...');
    await page.goto('https://aipowerranking.com', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // Wait a bit for scripts to execute
    await page.waitForTimeout(3000);

    console.log('\n=== Console Messages Captured ===');
    console.log(JSON.stringify(consoleMessages, null, 2));

    // Try to get the HTML source to inspect for inline scripts
    const htmlContent = await page.content();

    // Look for script tags with inline content
    const scriptMatches = htmlContent.match(/<script[^>]*>([\s\S]*?)<\/script>/gi);

    if (scriptMatches) {
      console.log(`\n=== Found ${scriptMatches.length} script tags ===`);

      // Check each script for potential syntax issues
      scriptMatches.forEach((script, index) => {
        if (script.length < 500) { // Only log short scripts
          console.log(`\nScript ${index + 1}:`);
          console.log(script.substring(0, 300));
        } else {
          console.log(`\nScript ${index + 1}: ${script.length} characters (too long to display)`);
        }
      });
    }

    // Check for specific problematic patterns
    const preloadTag = await page.locator('link[rel="preload"]').first();
    if (await preloadTag.count() > 0) {
      const outerHTML = await preloadTag.evaluate(el => el.outerHTML);
      console.log('\n=== Preload Tag HTML ===');
      console.log(outerHTML);
    }

    // Check network requests for failed resources
    const failedRequests: string[] = [];
    page.on('requestfailed', request => {
      failedRequests.push(request.url());
    });

    // Wait for potential failures
    await page.waitForTimeout(2000);

    if (failedRequests.length > 0) {
      console.log('\n=== Failed Requests ===');
      failedRequests.forEach(url => console.log(url));
    }

    // Extract all error messages
    const errors = consoleMessages.filter(m => m.type === 'error' || m.type === 'pageerror');
    console.log('\n=== Summary ===');
    console.log(`Total console messages: ${consoleMessages.length}`);
    console.log(`Errors: ${errors.length}`);
    console.log(`Failed requests: ${failedRequests.length}`);
  });
});
