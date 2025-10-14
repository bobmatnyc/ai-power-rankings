import { chromium, type Browser, type Page, type ConsoleMessage } from 'playwright';

interface BrowserChecks {
  clerkAvailable: boolean;
  providerAvailable: boolean;
  hasContextError: boolean;
  clerkLoaded: boolean;
  hasLoadingSpinner?: boolean;
  hasClerkUI?: boolean;
  hasSignInButton?: boolean;
}

async function runTests() {
  const baseURL = 'http://localhost:3000';
  let browser: Browser | null = null;
  let page: Page | null = null;

  const consoleMessages: Array<{ type: string; text: string }> = [];
  const errorMessages: string[] = [];
  const warningMessages: string[] = [];

  try {
    console.log('\n========================================');
    console.log('  CLERK CONTEXT ERROR VERIFICATION TEST');
    console.log('========================================\n');
    console.log(`Testing server: ${baseURL}`);
    console.log('Starting browser...\n');

    // Launch browser
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    });
    page = await context.newPage();

    // Set up console monitoring
    page.on('console', (msg: ConsoleMessage) => {
      const message = {
        type: msg.type(),
        text: msg.text()
      };

      consoleMessages.push(message);
      console.log(`[BROWSER ${msg.type().toUpperCase()}]:`, msg.text());

      if (msg.type() === 'error') {
        errorMessages.push(msg.text());
      } else if (msg.type() === 'warning') {
        warningMessages.push(msg.text());
      }
    });

    page.on('pageerror', (error) => {
      const errorText = `PAGE ERROR: ${error.message}`;
      console.error(errorText);
      errorMessages.push(errorText);
    });

    // TEST 1: Sign-In Page
    console.log('\n=== TEST 1: Sign-In Page ===\n');
    console.log(`Navigating to: ${baseURL}/en/sign-in`);

    await page.goto(`${baseURL}/en/sign-in`, { waitUntil: 'domcontentloaded', timeout: 45000 });

    console.log('Waiting 3 seconds for Clerk component to load...');
    await page.waitForTimeout(3000);

    // Take screenshot
    await page.screenshot({
      path: '/Users/masa/Projects/aipowerranking/tests/screenshots/clerk-signin-page.png',
      fullPage: true
    });
    console.log('✓ Screenshot saved: clerk-signin-page.png');

    // Run browser checks
    const signInChecks = await page.evaluate((): BrowserChecks => {
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

    console.log('\n--- Browser Environment Checks (Sign-In) ---');
    console.log('Clerk Available:', signInChecks.clerkAvailable ? '✅' : '❌');
    console.log('Provider Available:', signInChecks.providerAvailable ? '✅' : '❌');
    console.log('Context Error in Page Text:', signInChecks.hasContextError ? '❌' : '✅');
    console.log('Clerk Loaded:', signInChecks.clerkLoaded ? '✅' : '❌');
    console.log('Has Loading Spinner:', signInChecks.hasLoadingSpinner ? '✅' : '➖');
    console.log('Has Clerk UI:', signInChecks.hasClerkUI ? '✅' : '❌');

    const signInErrorCount = errorMessages.length;
    const signInWarningCount = warningMessages.length;

    // TEST 2: Homepage
    console.log('\n=== TEST 2: Homepage ===\n');
    console.log(`Navigating to: ${baseURL}/en`);

    await page.goto(`${baseURL}/en`, { waitUntil: 'domcontentloaded', timeout: 45000 });

    console.log('Waiting for page to load completely...');
    await page.waitForTimeout(2000);

    // Take screenshot
    await page.screenshot({
      path: '/Users/masa/Projects/aipowerranking/tests/screenshots/clerk-homepage.png',
      fullPage: true
    });
    console.log('✓ Screenshot saved: clerk-homepage.png');

    // Run browser checks
    const homeChecks = await page.evaluate((): BrowserChecks => {
      return {
        clerkAvailable: !!(window as any).Clerk,
        providerAvailable: !!(window as any).__clerkProviderAvailable,
        hasContextError: document.body.innerText.includes('useSession'),
        clerkLoaded: (window as any).Clerk?.loaded || false,
        hasSignInButton: document.querySelector('[href*="sign-in"]') !== null ||
                         document.body.innerText.toLowerCase().includes('sign in')
      };
    });

    console.log('\n--- Browser Environment Checks (Homepage) ---');
    console.log('Clerk Available:', homeChecks.clerkAvailable ? '✅' : '❌');
    console.log('Provider Available:', homeChecks.providerAvailable ? '✅' : '❌');
    console.log('Context Error in Page Text:', homeChecks.hasContextError ? '❌' : '✅');
    console.log('Clerk Loaded:', homeChecks.clerkLoaded ? '✅' : '❌');
    console.log('Has Sign-In Button:', homeChecks.hasSignInButton ? '✅' : '❌');

    // Analyze console messages
    console.log('\n--- Console Message Summary ---');
    console.log('Total Messages:', consoleMessages.length);
    console.log('Errors:', errorMessages.length);
    console.log('Warnings:', warningMessages.length);

    const contextErrorPresent = errorMessages.some(msg =>
      msg.includes('useSession can only be used within ClerkProvider') ||
      msg.includes('useUser can only be used within ClerkProvider') ||
      msg.includes('useAuth can only be used within ClerkProvider') ||
      (msg.includes('ClerkProvider') && msg.includes('can only be used within'))
    );

    if (errorMessages.length > 0) {
      console.log('\n--- ERROR MESSAGES ---');
      errorMessages.forEach((err, idx) => {
        console.log(`${idx + 1}. ${err.substring(0, 200)}${err.length > 200 ? '...' : ''}`);
      });
    }

    if (warningMessages.length > 5) {
      console.log(`\n--- WARNING MESSAGES (First 5 of ${warningMessages.length}) ---`);
      warningMessages.slice(0, 5).forEach((warn, idx) => {
        console.log(`${idx + 1}. ${warn.substring(0, 200)}${warn.length > 200 ? '...' : ''}`);
      });
    } else if (warningMessages.length > 0) {
      console.log('\n--- WARNING MESSAGES ---');
      warningMessages.forEach((warn, idx) => {
        console.log(`${idx + 1}. ${warn.substring(0, 200)}${warn.length > 200 ? '...' : ''}`);
      });
    }

    // Final Report
    console.log('\n========================================');
    console.log('         FINAL TEST RESULTS');
    console.log('========================================\n');

    if (contextErrorPresent) {
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
    console.log(contextErrorPresent ? '❌' : '✅', 'NO "useSession can only be used within ClerkProvider"');
    console.log(signInChecks.hasClerkUI ? '✅' : '❌', 'Sign-in page shows Clerk UI');
    console.log(signInChecks.clerkAvailable ? '✅' : '❌', 'window.Clerk is defined');
    console.log((!signInChecks.hasContextError && !homeChecks.hasContextError) ? '✅' : '❌', 'No error text visible on pages');

    console.log('\n--- Additional Info ---');
    console.log('📸 Screenshots saved to: tests/screenshots/');
    console.log('🔍 Total console messages captured:', consoleMessages.length);
    console.log('⚠️  Total errors:', errorMessages.length);
    console.log('⚡ Total warnings:', warningMessages.length);

    console.log('\n========================================\n');

    // Exit with appropriate code
    if (contextErrorPresent || signInChecks.hasContextError || homeChecks.hasContextError) {
      process.exit(1);
    } else {
      process.exit(0);
    }

  } catch (error) {
    console.error('\n❌ TEST EXECUTION FAILED:\n');
    console.error(error);
    process.exit(1);
  } finally {
    if (page) await page.close();
    if (browser) await browser.close();
  }
}

// Run tests
runTests();
