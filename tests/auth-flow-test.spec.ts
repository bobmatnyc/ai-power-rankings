import { test, expect, type Page } from '@playwright/test';

interface ClerkState {
  clerkAvailable: boolean;
  clerkUser: string | null;
  clerkSession: string | null;
}

interface TestResult {
  page: string;
  url: string;
  status: string;
  consoleErrors: string[];
  consoleWarnings: string[];
  cookies: Array<{ name: string; value: string; domain: string }>;
  clerkState?: ClerkState;
  elementsFound?: Record<string, boolean>;
  redirectUrl?: string;
}

const results: TestResult[] = [];
const middlewareLogs: string[] = [];

test.describe('Clerk Authentication Flow Testing', () => {
  let context: any;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      // Clear storage to start fresh
      storageState: undefined
    });
    page = await context.newPage();

    // Capture console messages
    page.on('console', (msg) => {
      const text = msg.text();
      console.log(`[CONSOLE ${msg.type().toUpperCase()}] ${text}`);

      // Store middleware logs if they appear in console
      if (text.includes('[middleware]')) {
        middlewareLogs.push(text);
      }
    });
  });

  test.afterAll(async () => {
    console.log('\n========================================');
    console.log('AUTHENTICATION FLOW TEST RESULTS');
    console.log('========================================\n');

    results.forEach((result, index) => {
      console.log(`\n--- Test ${index + 1}: ${result.page} ---`);
      console.log(`URL: ${result.url}`);
      console.log(`Status: ${result.status}`);

      if (result.redirectUrl) {
        console.log(`Redirect URL: ${result.redirectUrl}`);
      }

      if (result.consoleErrors.length > 0) {
        console.log(`Console Errors (${result.consoleErrors.length}):`);
        result.consoleErrors.forEach(err => console.log(`  - ${err}`));
      }

      if (result.consoleWarnings.length > 0) {
        console.log(`Console Warnings (${result.consoleWarnings.length}):`);
        result.consoleWarnings.forEach(warn => console.log(`  - ${warn}`));
      }

      if (result.cookies.length > 0) {
        console.log(`Cookies (${result.cookies.length}):`);
        result.cookies.forEach(cookie => {
          const value = cookie.value.substring(0, 50) + (cookie.value.length > 50 ? '...' : '');
          console.log(`  - ${cookie.name}: ${value}`);
        });
      }

      if (result.clerkState) {
        console.log('Clerk State:');
        console.log(`  - Clerk Available: ${result.clerkState.clerkAvailable}`);
        console.log(`  - User ID: ${result.clerkState.clerkUser || 'null'}`);
        console.log(`  - Session ID: ${result.clerkState.clerkSession || 'null'}`);
      }

      if (result.elementsFound) {
        console.log('Elements Found:');
        Object.entries(result.elementsFound).forEach(([key, found]) => {
          console.log(`  - ${key}: ${found}`);
        });
      }
    });

    if (middlewareLogs.length > 0) {
      console.log('\n========================================');
      console.log('MIDDLEWARE LOGS CAPTURED');
      console.log('========================================\n');
      middlewareLogs.forEach(log => console.log(log));
    }

    await context.close();
  });

  async function capturePageState(
    page: Page,
    testName: string,
    checkElements?: Record<string, string>
  ): Promise<TestResult> {
    const consoleErrors: string[] = [];
    const consoleWarnings: string[] = [];

    const consoleListener = (msg: any) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      } else if (msg.type() === 'warning') {
        consoleWarnings.push(msg.text());
      }
    };

    page.on('console', consoleListener);

    // Wait for network to be idle
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
      console.log('Network did not become idle within timeout');
    });

    const url = page.url();
    const cookies = await context.cookies();
    const localhostCookies = cookies.filter((c: any) => c.domain.includes('localhost'));

    // Check Clerk state
    const clerkState = await page.evaluate(() => {
      return {
        clerkAvailable: !!(window as any).Clerk,
        clerkUser: (window as any).Clerk?.user?.id || null,
        clerkSession: (window as any).Clerk?.session?.id || null,
      };
    }).catch(() => ({
      clerkAvailable: false,
      clerkUser: null,
      clerkSession: null,
    }));

    // Check for specific elements
    let elementsFound: Record<string, boolean> | undefined;
    if (checkElements) {
      elementsFound = {};
      for (const [name, selector] of Object.entries(checkElements)) {
        try {
          const element = await page.locator(selector).first();
          elementsFound[name] = await element.isVisible({ timeout: 2000 }).catch(() => false);
        } catch {
          elementsFound[name] = false;
        }
      }
    }

    page.off('console', consoleListener);

    return {
      page: testName,
      url,
      status: 'success',
      consoleErrors,
      consoleWarnings,
      cookies: localhostCookies.map((c: any) => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
      })),
      clerkState,
      elementsFound,
    };
  }

  test('1. Test Sign-In Page (/en/sign-in)', async () => {
    console.log('\n=== Testing Sign-In Page ===');

    await page.goto('http://localhost:3000/en/sign-in', {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });

    // Wait a bit for Clerk to load
    await page.waitForTimeout(2000);

    const result = await capturePageState(page, 'Sign-In Page', {
      'Clerk SignIn Component': '[data-clerk-component="SignIn"]',
      'Email Input': 'input[name="identifier"], input[type="email"]',
      'Password Input': 'input[name="password"], input[type="password"]',
      'Sign In Button': 'button:has-text("Sign in"), button:has-text("Continue")',
    });

    results.push(result);

    // Take screenshot
    await page.screenshot({
      path: '/Users/masa/Projects/aipowerranking/tests/screenshots/signin-page.png',
      fullPage: true
    });

    expect(result.url).toContain('/sign-in');
  });

  test('2. Test Homepage (/en)', async () => {
    console.log('\n=== Testing Homepage ===');

    await page.goto('http://localhost:3000/en', {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    });

    await page.waitForTimeout(2000);

    const result = await capturePageState(page, 'Homepage', {
      'Sign In Link/Button': 'a[href*="sign-in"], button:has-text("Sign in"), a:has-text("Sign in")',
      'User Menu': '[data-clerk-component="UserButton"]',
      'Main Content': 'main, [role="main"]',
    });

    results.push(result);

    await page.screenshot({
      path: '/Users/masa/Projects/aipowerranking/tests/screenshots/homepage.png',
      fullPage: true
    });

    expect(result.url).toBe('http://localhost:3000/en');
  });

  test('3. Test Admin Access (/en/admin)', async () => {
    console.log('\n=== Testing Admin Access ===');

    const initialUrl = page.url();

    await page.goto('http://localhost:3000/en/admin', {
      waitUntil: 'domcontentloaded',
      timeout: 15000
    }).catch(async (error) => {
      console.log(`Navigation error: ${error.message}`);
    });

    // Wait for any redirects
    await page.waitForTimeout(3000);

    const finalUrl = page.url();
    const wasRedirected = finalUrl !== 'http://localhost:3000/en/admin';

    const result = await capturePageState(page, 'Admin Page Attempt', {
      'Admin Dashboard': '[data-testid="admin-dashboard"], h1:has-text("Admin")',
      'Unauthorized Message': ':has-text("Unauthorized"), :has-text("Access Denied")',
      'Sign In Redirect': '[data-clerk-component="SignIn"]',
    });

    if (wasRedirected) {
      result.redirectUrl = finalUrl;
    }

    results.push(result);

    await page.screenshot({
      path: '/Users/masa/Projects/aipowerranking/tests/screenshots/admin-access.png',
      fullPage: true
    });

    console.log(`Admin access result: ${wasRedirected ? 'Redirected to ' + finalUrl : 'Loaded admin page'}`);
  });

  test('4. Check Browser State Details', async () => {
    console.log('\n=== Checking Browser State ===');

    // Get all storage
    const localStorage = await page.evaluate(() => {
      const items: Record<string, string> = {};
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key) {
          items[key] = window.localStorage.getItem(key) || '';
        }
      }
      return items;
    });

    console.log('\nLocalStorage Keys:');
    Object.keys(localStorage).forEach(key => {
      if (key.includes('clerk')) {
        console.log(`  - ${key}: ${localStorage[key].substring(0, 100)}...`);
      }
    });

    const sessionStorage = await page.evaluate(() => {
      const items: Record<string, string> = {};
      for (let i = 0; i < window.sessionStorage.length; i++) {
        const key = window.sessionStorage.key(i);
        if (key) {
          items[key] = window.sessionStorage.getItem(key) || '';
        }
      }
      return items;
    });

    console.log('\nSessionStorage Keys:');
    Object.keys(sessionStorage).forEach(key => {
      if (key.includes('clerk')) {
        console.log(`  - ${key}: ${sessionStorage[key].substring(0, 100)}...`);
      }
    });

    // Get detailed Clerk state
    const detailedClerkState = await page.evaluate(() => {
      const clerk = (window as any).Clerk;
      if (!clerk) return { available: false };

      return {
        available: true,
        loaded: clerk.loaded,
        userId: clerk.user?.id,
        sessionId: clerk.session?.id,
        userEmail: clerk.user?.primaryEmailAddress?.emailAddress,
        userRole: clerk.user?.publicMetadata?.role,
        isSignedIn: !!clerk.user,
      };
    });

    console.log('\nDetailed Clerk State:');
    console.log(JSON.stringify(detailedClerkState, null, 2));
  });
});
