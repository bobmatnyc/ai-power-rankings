/**
 * Standalone Sign-In Test Script
 * Independent test that doesn't rely on playwright.config.ts
 */

import { chromium } from '@playwright/test';

const ENVIRONMENTS = {
  local: 'http://localhost:3000',
  production: 'https://aipowerranking.com'
};

const SIGN_IN_PATH = '/en/sign-in';

interface TestResult {
  environment: string;
  url: string;
  statusCode: number | undefined;
  jsErrors: any[];
  consoleErrors: any[];
  consoleWarnings: any[];
  clerkElementFound: boolean;
  formElements: {
    emailInput: boolean;
    passwordInput: boolean;
    submitButton: boolean;
  };
  clerkRequests: number;
  pageTitle: string;
  hasClerkInHTML: boolean;
  hasSignInText: boolean;
  interactivityTest: {
    emailInputWorks: boolean;
    error?: string;
  };
}

async function testSignInPage(environmentName: string, baseUrl: string): Promise<TestResult> {
  const url = `${baseUrl}${SIGN_IN_PATH}`;

  console.log(`\n${'='.repeat(70)}`);
  console.log(`Testing ${environmentName.toUpperCase()} Environment`);
  console.log(`URL: ${url}`);
  console.log('='.repeat(70));

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true
  });

  const page = await context.newPage();

  // Capture console messages
  const consoleMessages: any[] = [];
  page.on('console', msg => {
    consoleMessages.push({
      type: msg.type(),
      text: msg.text(),
      location: msg.location()
    });
  });

  // Capture JavaScript errors
  const jsErrors: any[] = [];
  page.on('pageerror', error => {
    jsErrors.push({
      message: error.message,
      stack: error.stack,
      name: error.name
    });
  });

  try {
    // Test 1: Navigate to sign-in page
    console.log('\n[TEST 1] Navigating to sign-in page...');
    let response;
    try {
      // Try with networkidle first
      response = await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: 30000
      });
    } catch (networkIdleError: any) {
      console.log(`  ⚠ Network idle timeout, trying with 'load' instead...`);
      // Fallback to 'load' which is less strict
      response = await page.goto(url, {
        waitUntil: 'load',
        timeout: 30000
      });
    }

    const statusCode = response?.status();
    console.log(`✓ Page loaded with status: ${statusCode}`);

    // Wait for page to be ready
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(5000); // Give Clerk more time to initialize

    // Test 2: Check for JavaScript errors
    console.log('\n[TEST 2] Checking for JavaScript errors...');
    if (jsErrors.length > 0) {
      console.log(`⚠ Found ${jsErrors.length} JavaScript errors:`);
      jsErrors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error.name}: ${error.message}`);
        if (error.stack) {
          console.log(`     Stack: ${error.stack.substring(0, 200)}...`);
        }
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
      console.log('\n  Console Errors (first 10):');
      errors.slice(0, 10).forEach((error, index) => {
        console.log(`    ${index + 1}. ${error.text}`);
      });
    }

    if (warnings.length > 0) {
      console.log('\n  Console Warnings (first 5):');
      warnings.slice(0, 5).forEach((warning, index) => {
        console.log(`    ${index + 1}. ${warning.text}`);
      });
    }

    // Test 4: Check page title
    console.log('\n[TEST 4] Verifying page metadata...');
    const title = await page.title();
    console.log(`  Page title: "${title}"`);

    // Test 5: Check for Clerk sign-in component
    console.log('\n[TEST 5] Checking for Clerk sign-in component...');

    // Take screenshot for debugging
    const screenshotPath = `/Users/masa/Projects/aipowerranking/tests/screenshots/${environmentName}-sign-in-${Date.now()}.png`;
    await page.screenshot({
      path: screenshotPath,
      fullPage: true
    });
    console.log(`✓ Screenshot saved to ${screenshotPath}`);

    // Look for Clerk-specific elements
    const clerkSelectors = [
      '[data-clerk-id]',
      '.cl-component',
      '.cl-rootBox',
      '.cl-signIn-root',
      '[class*="clerk"]',
      'form[data-clerk-form]'
    ];

    let clerkElementFound = false;
    let foundSelector = '';

    for (const selector of clerkSelectors) {
      const element = await page.$(selector);
      if (element) {
        clerkElementFound = true;
        foundSelector = selector;
        console.log(`✓ Clerk component found (selector: ${foundSelector})`);
        break;
      }
    }

    if (!clerkElementFound) {
      console.log('⚠ No Clerk-specific elements detected with standard selectors');

      // Try to find any form
      const anyForm = await page.$('form');
      if (anyForm) {
        const formClasses = await anyForm.getAttribute('class');
        const formId = await anyForm.getAttribute('id');
        console.log(`  Found a form element with class="${formClasses}" id="${formId}"`);
      }
    }

    // Test 6: Check for form elements
    console.log('\n[TEST 6] Checking for form elements...');
    const emailInput = await page.$('input[type="text"], input[type="email"], input[name="identifier"], input[name="email"]');
    const passwordInput = await page.$('input[type="password"]');
    const submitButton = await page.$('button[type="submit"], button:has-text("Sign in"), button:has-text("Continue")');

    const formElements = {
      emailInput: !!emailInput,
      passwordInput: !!passwordInput,
      submitButton: !!submitButton
    };

    console.log(`  ${emailInput ? '✓' : '✗'} Email/Username input found`);
    console.log(`  ${passwordInput ? '✓' : '✗'} Password input found`);
    console.log(`  ${submitButton ? '✓' : '✗'} Submit button found`);

    // Test 7: Get page HTML structure for analysis
    console.log('\n[TEST 7] Analyzing page structure...');
    const bodyContent = await page.content();
    const hasClerkInHTML = bodyContent.includes('clerk') || bodyContent.includes('Clerk');
    const hasSignInText = bodyContent.toLowerCase().includes('sign in') || bodyContent.toLowerCase().includes('sign-in');

    console.log(`  - Contains 'clerk' in HTML: ${hasClerkInHTML}`);
    console.log(`  - Contains 'sign in' text: ${hasSignInText}`);

    // Count specific patterns
    const clerkCount = (bodyContent.match(/clerk/gi) || []).length;
    console.log(`  - 'clerk' appears ${clerkCount} times in HTML`);

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
    let interactivityTest = {
      emailInputWorks: false,
      error: undefined as string | undefined
    };

    try {
      if (emailInput) {
        await emailInput.click();
        await page.keyboard.type('test@example.com');
        const value = await emailInput.inputValue();
        if (value === 'test@example.com') {
          console.log('  ✓ Email input is interactive and functional');
          interactivityTest.emailInputWorks = true;
        } else {
          console.log(`  ⚠ Email input accepted text but value is: "${value}"`);
        }
      } else {
        console.log('  ⚠ No email input found to test');
        interactivityTest.error = 'No email input found';
      }
    } catch (error: any) {
      console.log(`  ✗ Form interaction failed: ${error.message}`);
      interactivityTest.error = error.message;
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

    if (clerkRequests.length > 0) {
      console.log('  Clerk requests:');
      clerkRequests.slice(0, 5).forEach((req: any) => {
        console.log(`    - ${req.name.substring(0, 80)}...`);
      });
    }

    // Test 11: Check for iframes (Clerk might use iframes)
    console.log('\n[TEST 11] Checking for iframes...');
    const iframes = await page.$$('iframe');
    console.log(`  - Found ${iframes.length} iframe(s)`);

    if (iframes.length > 0) {
      for (let i = 0; i < Math.min(iframes.length, 3); i++) {
        const src = await iframes[i].getAttribute('src');
        const title = await iframes[i].getAttribute('title');
        console.log(`    Iframe ${i + 1}: src="${src?.substring(0, 60)}..." title="${title}"`);
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log(`${environmentName.toUpperCase()} Environment Test Complete`);
    console.log('='.repeat(70) + '\n');

    await browser.close();

    return {
      environment: environmentName,
      url,
      statusCode,
      jsErrors,
      consoleErrors: errors,
      consoleWarnings: warnings,
      clerkElementFound,
      formElements,
      clerkRequests: clerkRequests.length,
      pageTitle: title,
      hasClerkInHTML,
      hasSignInText,
      interactivityTest
    };
  } catch (error: any) {
    console.error(`\n❌ Test failed with error: ${error.message}`);
    console.error(`Stack: ${error.stack}`);

    await browser.close();

    throw error;
  }
}

async function main() {
  console.log('\n' + '█'.repeat(70));
  console.log('     SIGN-IN FUNCTIONALITY TEST SUITE');
  console.log('█'.repeat(70));

  const results: TestResult[] = [];

  try {
    // Test Local Environment
    console.log('\n\n📍 PHASE 1: Testing LOCAL Environment');
    const localResult = await testSignInPage('local', ENVIRONMENTS.local);
    results.push(localResult);

    // Brief pause between tests
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test Production Environment
    console.log('\n\n📍 PHASE 2: Testing PRODUCTION Environment');
    const prodResult = await testSignInPage('production', ENVIRONMENTS.production);
    results.push(prodResult);

    // Summary Report
    console.log('\n\n' + '█'.repeat(70));
    console.log('     FINAL TEST SUMMARY');
    console.log('█'.repeat(70));

    results.forEach(result => {
      console.log(`\n### ${result.environment.toUpperCase()} Environment:`);
      console.log(`  URL: ${result.url}`);
      console.log(`  Status Code: ${result.statusCode}`);
      console.log(`  JavaScript Errors: ${result.jsErrors.length}`);
      console.log(`  Console Errors: ${result.consoleErrors.length}`);
      console.log(`  Console Warnings: ${result.consoleWarnings.length}`);
      console.log(`  Clerk Component Found: ${result.clerkElementFound ? '✓ Yes' : '✗ No'}`);
      console.log(`  Email Input: ${result.formElements.emailInput ? '✓ Found' : '✗ Not Found'}`);
      console.log(`  Password Input: ${result.formElements.passwordInput ? '✓ Found' : '✗ Not Found'}`);
      console.log(`  Submit Button: ${result.formElements.submitButton ? '✓ Found' : '✗ Not Found'}`);
      console.log(`  Form Interactive: ${result.interactivityTest.emailInputWorks ? '✓ Yes' : '✗ No'}`);
      console.log(`  Clerk Requests: ${result.clerkRequests}`);
      console.log(`  Has Clerk in HTML: ${result.hasClerkInHTML ? 'Yes' : 'No'}`);
      console.log(`  Has Sign-In Text: ${result.hasSignInText ? 'Yes' : 'No'}`);

      // Overall assessment
      const isWorking =
        result.statusCode === 200 &&
        result.jsErrors.length < 5 &&
        (result.clerkElementFound || result.formElements.emailInput);

      console.log(`\n  Overall Status: ${isWorking ? '✅ WORKING' : '❌ ISSUES DETECTED'}`);
    });

    console.log('\n' + '█'.repeat(70));
    console.log('     TEST EXECUTION COMPLETED');
    console.log('█'.repeat(70) + '\n');

    // Exit with appropriate code
    const hasFailures = results.some(r =>
      r.statusCode !== 200 ||
      r.jsErrors.length >= 5 ||
      (!r.clerkElementFound && !r.formElements.emailInput)
    );

    process.exit(hasFailures ? 1 : 0);

  } catch (error: any) {
    console.error('\n❌ Test suite failed:');
    console.error(error);
    process.exit(1);
  }
}

main();
