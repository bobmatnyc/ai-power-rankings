import { test, expect, chromium, Browser, BrowserContext, Page } from '@playwright/test';

/**
 * Sign-In Functionality Test Suite
 * Tests the Clerk sign-in functionality on both local and production environments
 *
 * Test Coverage:
 * 1. Page loading and routing
 * 2. Clerk sign-in component rendering
 * 3. Form elements presence
 * 4. JavaScript errors monitoring
 * 5. Interactive form testing
 */

const ENVIRONMENTS = {
  local: 'http://localhost:3000',
  production: 'https://aipowerranking.com'
};

const SIGN_IN_PATH = '/en/sign-in';

test.describe('Sign-In Functionality Tests', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  let consoleMessages: any[] = [];
  let jsErrors: any[] = [];

  test.beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
  });

  test.afterAll(async () => {
    await browser?.close();
  });

  test.beforeEach(async () => {
    context = await browser.newContext({
      viewport: { width: 1280, height: 720 }
    });

    page = await context.newPage();

    // Capture console messages
    consoleMessages = [];
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        location: msg.location()
      });
    });

    // Capture JavaScript errors
    jsErrors = [];
    page.on('pageerror', error => {
      jsErrors.push({
        message: error.message,
        stack: error.stack,
        name: error.name
      });
    });
  });

  test.afterEach(async () => {
    await context?.close();
  });

  // Helper function to run tests for each environment
  async function testSignInPage(environmentName: string, baseUrl: string) {
    const url = `${baseUrl}${SIGN_IN_PATH}`;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing ${environmentName.toUpperCase()} Environment`);
    console.log(`URL: ${url}`);
    console.log('='.repeat(60));

    // Test 1: Navigate to sign-in page
    console.log('\n[TEST 1] Navigating to sign-in page...');
    const response = await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    console.log(`✓ Page loaded with status: ${response?.status()}`);
    expect(response?.status()).toBe(200);

    // Wait for page to be ready
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000); // Give Clerk time to initialize

    // Test 2: Check for JavaScript errors
    console.log('\n[TEST 2] Checking for JavaScript errors...');
    if (jsErrors.length > 0) {
      console.log(`⚠ Found ${jsErrors.length} JavaScript errors:`);
      jsErrors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error.name}: ${error.message}`);
      });
    } else {
      console.log('✓ No JavaScript errors detected');
    }

    // Test 3: Check for critical console errors
    console.log('\n[TEST 3] Analyzing console messages...');
    const errors = consoleMessages.filter(msg => msg.type === 'error');
    const warnings = consoleMessages.filter(msg => msg.type === 'warning');

    console.log(`  - Total console messages: ${consoleMessages.length}`);
    console.log(`  - Errors: ${errors.length}`);
    console.log(`  - Warnings: ${warnings.length}`);

    if (errors.length > 0) {
      console.log('\n  Console Errors:');
      errors.slice(0, 5).forEach((error, index) => {
        console.log(`    ${index + 1}. ${error.text}`);
      });
    }

    // Test 4: Check page title
    console.log('\n[TEST 4] Verifying page metadata...');
    const title = await page.title();
    console.log(`  Page title: "${title}"`);

    // Test 5: Check for Clerk sign-in component
    console.log('\n[TEST 5] Checking for Clerk sign-in component...');

    // Take screenshot for debugging
    await page.screenshot({
      path: `/Users/masa/Projects/aipowerranking/tests/screenshots/${environmentName}-sign-in.png`,
      fullPage: true
    });
    console.log(`✓ Screenshot saved to tests/screenshots/${environmentName}-sign-in.png`);

    // Look for Clerk-specific elements
    const clerkSelectors = [
      '[data-clerk-id]',
      '.cl-component',
      '.cl-rootBox',
      '.cl-signIn-root',
      '[class*="clerk"]',
      'form[data-clerk-form]',
      'input[name="identifier"]',
      'input[type="password"]',
      'button[type="submit"]'
    ];

    let clerkElementFound = false;
    let foundSelector = '';

    for (const selector of clerkSelectors) {
      const element = await page.$(selector);
      if (element) {
        clerkElementFound = true;
        foundSelector = selector;
        break;
      }
    }

    if (clerkElementFound) {
      console.log(`✓ Clerk component found (selector: ${foundSelector})`);
    } else {
      console.log('⚠ No Clerk-specific elements detected');
    }

    // Test 6: Check for form elements
    console.log('\n[TEST 6] Checking for form elements...');
    const formElements = {
      'Email/Username input': await page.$('input[type="text"], input[type="email"], input[name="identifier"]'),
      'Password input': await page.$('input[type="password"]'),
      'Submit button': await page.$('button[type="submit"]')
    };

    Object.entries(formElements).forEach(([name, element]) => {
      if (element) {
        console.log(`  ✓ ${name} found`);
      } else {
        console.log(`  ✗ ${name} NOT found`);
      }
    });

    // Test 7: Get page HTML structure for analysis
    console.log('\n[TEST 7] Analyzing page structure...');
    const bodyContent = await page.content();
    const hasClerkInHTML = bodyContent.includes('clerk') || bodyContent.includes('Clerk');
    const hasSignInText = bodyContent.toLowerCase().includes('sign in') || bodyContent.toLowerCase().includes('sign-in');

    console.log(`  - Contains 'clerk' in HTML: ${hasClerkInHTML}`);
    console.log(`  - Contains 'sign in' text: ${hasSignInText}`);

    // Test 8: Check for specific Clerk error messages
    console.log('\n[TEST 8] Checking for Clerk-specific errors...');
    const clerkErrors = consoleMessages.filter(msg =>
      msg.text.toLowerCase().includes('clerk') && msg.type === 'error'
    );

    if (clerkErrors.length > 0) {
      console.log('  ⚠ Found Clerk-related errors:');
      clerkErrors.forEach(error => {
        console.log(`    - ${error.text}`);
      });
    } else {
      console.log('  ✓ No Clerk-specific errors');
    }

    // Test 9: Try to interact with the form (if present)
    console.log('\n[TEST 9] Testing form interactivity...');
    try {
      const emailInput = await page.$('input[type="text"], input[type="email"], input[name="identifier"]');
      if (emailInput) {
        await emailInput.click();
        await page.keyboard.type('test@example.com');
        const value = await emailInput.inputValue();
        if (value === 'test@example.com') {
          console.log('  ✓ Email input is interactive and functional');
        } else {
          console.log('  ⚠ Email input accepted text but value mismatch');
        }
      } else {
        console.log('  ⚠ No email input found to test');
      }
    } catch (error: any) {
      console.log(`  ✗ Form interaction failed: ${error.message}`);
    }

    // Test 10: Network requests analysis
    console.log('\n[TEST 10] Checking network requests...');
    const requests = await page.evaluate(() => {
      return window.performance.getEntriesByType('resource').map((r: any) => ({
        name: r.name,
        type: r.initiatorType
      }));
    });

    const clerkRequests = requests.filter((r: any) => r.name.includes('clerk'));
    console.log(`  - Total resources loaded: ${requests.length}`);
    console.log(`  - Clerk-related requests: ${clerkRequests.length}`);

    console.log('\n' + '='.repeat(60));
    console.log(`${environmentName.toUpperCase()} Environment Test Complete`);
    console.log('='.repeat(60) + '\n');

    return {
      environment: environmentName,
      url,
      statusCode: response?.status(),
      jsErrors: jsErrors.length,
      consoleErrors: errors.length,
      consoleWarnings: warnings.length,
      clerkElementFound,
      formElementsPresent: Object.values(formElements).filter(e => e !== null).length,
      clerkRequests: clerkRequests.length
    };
  }

  test('LOCAL - Sign-in page functionality', async () => {
    const result = await testSignInPage('local', ENVIRONMENTS.local);

    // Assertions
    expect(result.statusCode).toBe(200);
    expect(result.jsErrors).toBeLessThan(5); // Allow some minor errors
  });

  test('PRODUCTION - Sign-in page functionality', async () => {
    const result = await testSignInPage('production', ENVIRONMENTS.production);

    // Assertions
    expect(result.statusCode).toBe(200);
    expect(result.jsErrors).toBeLessThan(5); // Allow some minor errors
  });
});
