import { test, expect, ConsoleMessage } from '@playwright/test';

test.describe('Clerk Context Error Verification', () => {
  const baseURL = 'http://localhost:3000';
  let consoleMessages: Array<{ type: string; text: string; location: string }> = [];
  let errorMessages: string[] = [];
  let warningMessages: string[] = [];

  test.beforeEach(async ({ page }) => {
    // Reset message arrays for each test
    consoleMessages = [];
    errorMessages = [];
    warningMessages = [];

    // Capture all console messages
    page.on('console', (msg: ConsoleMessage) => {
      const message = {
        type: msg.type(),
        text: msg.text(),
        location: msg.location().url || 'unknown'
      };

      consoleMessages.push(message);

      console.log(`[BROWSER ${msg.type().toUpperCase()}]:`, msg.text());

      // Track errors and warnings separately
      if (msg.type() === 'error') {
        errorMessages.push(msg.text());
      } else if (msg.type() === 'warning') {
        warningMessages.push(msg.text());
      }
    });

    // Capture page errors
    page.on('pageerror', (error) => {
      const errorText = `PAGE ERROR: ${error.message}`;
      console.error(errorText);
      errorMessages.push(errorText);
    });
  });

  test('Sign-In Page - Verify Clerk Context Available', async ({ page }) => {
    console.log('\n=== TEST 1: Sign-In Page ===\n');

    // Navigate to sign-in page
    await page.goto(`${baseURL}/en/sign-in`, { waitUntil: 'networkidle' });

    console.log('Waiting 3 seconds for Clerk component to load...');
    await page.waitForTimeout(3000);

    // Take screenshot
    await page.screenshot({
      path: '/Users/masa/Projects/aipowerranking/tests/screenshots/clerk-signin-page.png',
      fullPage: true
    });
    console.log('Screenshot saved: clerk-signin-page.png');

    // Run browser console checks
    const browserChecks = await page.evaluate(() => {
      return {
        clerkAvailable: !!(window as any).Clerk,
        providerAvailable: !!(window as any).__clerkProviderAvailable,
        hasContextError: document.body.innerText.includes('useSession'),
        clerkLoaded: (window as any).Clerk?.loaded || false,
        hasLoadingSpinner: document.querySelector('[class*="loading"]') !== null,
        hasClerkUI: document.querySelector('[data-clerk-id]') !== null ||
                    document.querySelector('.cl-component') !== null ||
                    document.querySelector('[id^="clerk"]') !== null
      };
    });

    console.log('\n--- Browser Environment Checks ---');
    console.log('Clerk Available:', browserChecks.clerkAvailable);
    console.log('Provider Available:', browserChecks.providerAvailable);
    console.log('Context Error in Page Text:', browserChecks.hasContextError);
    console.log('Clerk Loaded:', browserChecks.clerkLoaded);
    console.log('Has Loading Spinner:', browserChecks.hasLoadingSpinner);
    console.log('Has Clerk UI:', browserChecks.hasClerkUI);

    // Check for specific error text
    const contextErrorPresent = errorMessages.some(msg =>
      msg.includes('useSession can only be used within ClerkProvider') ||
      msg.includes('useUser can only be used within ClerkProvider') ||
      msg.includes('ClerkProvider')
    );

    console.log('\n--- Console Message Summary ---');
    console.log('Total Messages:', consoleMessages.length);
    console.log('Errors:', errorMessages.length);
    console.log('Warnings:', warningMessages.length);
    console.log('Context Error Present:', contextErrorPresent);

    if (errorMessages.length > 0) {
      console.log('\n--- ERROR MESSAGES ---');
      errorMessages.forEach((err, idx) => {
        console.log(`${idx + 1}. ${err}`);
      });
    }

    if (warningMessages.length > 0) {
      console.log('\n--- WARNING MESSAGES ---');
      warningMessages.forEach((warn, idx) => {
        console.log(`${idx + 1}. ${warn}`);
      });
    }

    // Assertions
    expect(contextErrorPresent, 'No ClerkProvider context errors should be present').toBe(false);
    expect(browserChecks.hasContextError, 'Page should not display context error text').toBe(false);
  });

  test('Homepage - Verify Clerk Integration', async ({ page }) => {
    console.log('\n=== TEST 2: Homepage ===\n');

    // Navigate to homepage
    await page.goto(`${baseURL}/en`, { waitUntil: 'networkidle' });

    console.log('Waiting for page to load completely...');
    await page.waitForTimeout(2000);

    // Take screenshot
    await page.screenshot({
      path: '/Users/masa/Projects/aipowerranking/tests/screenshots/clerk-homepage.png',
      fullPage: true
    });
    console.log('Screenshot saved: clerk-homepage.png');

    // Run browser console checks
    const browserChecks = await page.evaluate(() => {
      return {
        clerkAvailable: !!(window as any).Clerk,
        providerAvailable: !!(window as any).__clerkProviderAvailable,
        hasContextError: document.body.innerText.includes('useSession'),
        clerkLoaded: (window as any).Clerk?.loaded || false,
        hasSignInButton: document.querySelector('[href*="sign-in"]') !== null ||
                         document.body.innerText.toLowerCase().includes('sign in')
      };
    });

    console.log('\n--- Browser Environment Checks ---');
    console.log('Clerk Available:', browserChecks.clerkAvailable);
    console.log('Provider Available:', browserChecks.providerAvailable);
    console.log('Context Error in Page Text:', browserChecks.hasContextError);
    console.log('Clerk Loaded:', browserChecks.clerkLoaded);
    console.log('Has Sign-In Button:', browserChecks.hasSignInButton);

    // Check for specific error text
    const contextErrorPresent = errorMessages.some(msg =>
      msg.includes('useSession can only be used within ClerkProvider') ||
      msg.includes('useUser can only be used within ClerkProvider') ||
      msg.includes('ClerkProvider')
    );

    console.log('\n--- Console Message Summary ---');
    console.log('Total Messages:', consoleMessages.length);
    console.log('Errors:', errorMessages.length);
    console.log('Warnings:', warningMessages.length);
    console.log('Context Error Present:', contextErrorPresent);

    if (errorMessages.length > 0) {
      console.log('\n--- ERROR MESSAGES ---');
      errorMessages.forEach((err, idx) => {
        console.log(`${idx + 1}. ${err}`);
      });
    }

    // Assertions
    expect(contextErrorPresent, 'No ClerkProvider context errors should be present').toBe(false);
    expect(browserChecks.hasContextError, 'Page should not display context error text').toBe(false);
  });

  test.afterAll(async () => {
    // Generate final report
    console.log('\n========================================');
    console.log('     CLERK CONTEXT ERROR VERIFICATION');
    console.log('========================================\n');

    const hasContextErrors = errorMessages.some(msg =>
      msg.includes('useSession can only be used within ClerkProvider') ||
      msg.includes('useUser can only be used within ClerkProvider') ||
      msg.includes('ClerkProvider')
    );

    if (hasContextErrors) {
      console.log('❌ RESULT: Context error STILL PRESENT');
      console.log('\nThe following ClerkProvider errors were detected:');
      errorMessages
        .filter(msg => msg.includes('ClerkProvider'))
        .forEach(msg => console.log(`  - ${msg}`));
    } else {
      console.log('✅ RESULT: Context error RESOLVED');
      console.log('\nNo ClerkProvider context errors detected during testing.');
    }

    console.log('\n--- Success Criteria Check ---');
    console.log(hasContextErrors ? '❌' : '✅', 'NO "useSession can only be used within ClerkProvider" in console');
    console.log('📸 Screenshots saved to tests/screenshots/');
    console.log('\n========================================\n');
  });
});
