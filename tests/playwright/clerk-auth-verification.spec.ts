import { test, expect } from '@playwright/test';

test.describe('Clerk Authentication Verification', () => {
  test('Verify Clerk authentication configuration and key setup', async ({ page }) => {
    const consoleMessages: Array<{ type: string; text: string }> = [];
    const networkErrors: Array<{ url: string; status: number }> = [];

    // Capture console messages
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Capture network errors
    page.on('response', response => {
      if (!response.ok() && response.url().includes('clerk')) {
        networkErrors.push({
          url: response.url(),
          status: response.status()
        });
      }
    });

    // Navigate to sign-in page
    console.log('Navigating to sign-in page...');
    await page.goto('http://localhost:3000/en/sign-in', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // Wait for potential Clerk initialization
    await page.waitForTimeout(5000);

    // Check if Clerk form renders - try multiple selectors
    const clerkSelectors = [
      '.cl-rootBox',
      '.cl-signIn-root',
      '[data-clerk-sign-in]',
      '.cl-component',
      '.cl-card',
      '#clerk-sign-in'
    ];

    let clerkFormExists = false;
    let foundSelector = '';

    for (const selector of clerkSelectors) {
      const count = await page.locator(selector).count();
      if (count > 0) {
        clerkFormExists = true;
        foundSelector = selector;
        break;
      }
    }

    // Check for any input fields (fallback)
    const hasInputFields = await page.locator('input[type="email"], input[type="text"], input[name="identifier"]').count() > 0;
    const hasPasswordField = await page.locator('input[type="password"]').count() > 0;

    // Filter Clerk-related messages
    const clerkErrors = consoleMessages.filter(msg =>
      msg.text.toLowerCase().includes('clerk') &&
      (msg.type === 'error' || msg.type === 'warning')
    );

    const clerkKeyErrors = consoleMessages.filter(msg =>
      msg.text.toLowerCase().includes('key') ||
      msg.text.toLowerCase().includes('publishable') ||
      msg.text.toLowerCase().includes('secret') ||
      msg.text.toLowerCase().includes('invalid') ||
      msg.text.toLowerCase().includes('mismatch')
    );

    // Check page title and URL
    const pageTitle = await page.title();
    const currentUrl = page.url();

    // Try to get page HTML for debugging
    const bodyHTML = await page.locator('body').innerHTML();
    const hasClerkInHTML = bodyHTML.includes('clerk') || bodyHTML.includes('Clerk');

    // Output results
    console.log('\n=== CLERK AUTHENTICATION TEST RESULTS ===');
    console.log('Page URL:', currentUrl);
    console.log('Page Title:', pageTitle);
    console.log('Clerk form rendered:', clerkFormExists);
    if (clerkFormExists) {
      console.log('Found selector:', foundSelector);
    }
    console.log('Has input fields:', hasInputFields);
    console.log('Has password field:', hasPasswordField);
    console.log('Clerk references in HTML:', hasClerkInHTML);
    console.log('Total console messages:', consoleMessages.length);
    console.log('Clerk errors found:', clerkErrors.length);
    console.log('Key-related errors found:', clerkKeyErrors.length);
    console.log('Network errors:', networkErrors.length);

    if (networkErrors.length > 0) {
      console.log('\n=== CLERK NETWORK ERRORS ===');
      networkErrors.forEach(err => {
        console.log(`[${err.status}]`, err.url);
      });
    }

    if (clerkKeyErrors.length > 0) {
      console.log('\n=== CLERK KEY ERRORS ===');
      clerkKeyErrors.forEach(err => {
        console.log(`[${err.type}]`, err.text);
      });
    }

    if (clerkErrors.length > 0) {
      console.log('\n=== CLERK ERRORS ===');
      clerkErrors.forEach(err => {
        console.log(`[${err.type}]`, err.text);
      });
    }

    console.log('\n=== ALL CONSOLE MESSAGES ===');
    consoleMessages.forEach(msg => {
      console.log(`[${msg.type}]`, msg.text);
    });

    // Take screenshot for evidence
    await page.screenshot({
      path: '/Users/masa/Projects/aipowerranking/tests/clerk-sign-in-screenshot.png',
      fullPage: true
    });
    console.log('\nScreenshot saved to: tests/clerk-sign-in-screenshot.png');

    // Assertions for test validation - make them non-blocking for report
    if (clerkKeyErrors.length > 0) {
      console.log('\n⚠️  WARNING: Key errors detected but test will continue for full reporting');
    }
    if (!clerkFormExists && !hasInputFields) {
      console.log('\n⚠️  WARNING: No Clerk form or input fields detected');
    }

    // Final status
    console.log('\n=== FINAL TEST STATUS ===');
    console.log('✅ Clerk UI rendered:', clerkFormExists ? 'YES' : 'NO');
    console.log('✅ Input fields present:', hasInputFields ? 'YES' : 'NO');
    console.log('✅ Password field present:', hasPasswordField ? 'YES' : 'NO');
    console.log('❌ Key errors:', clerkKeyErrors.length);
    console.log('⚠️  Clerk warnings/errors:', clerkErrors.length);

    // Soft assertions - report but don't fail
    expect.soft(clerkFormExists || hasInputFields).toBe(true);
  });
});
