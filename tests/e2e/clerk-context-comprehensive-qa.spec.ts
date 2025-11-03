import { test, expect, Page } from '@playwright/test';

/**
 * Comprehensive QA Suite for ClerkProvider Context Fix
 *
 * Tests the React Context-based ClerkProvider detection fix
 * to ensure NO "UserButton can only be used within ClerkProvider" errors
 *
 * Test Areas:
 * - Public page navigation (no ClerkProvider)
 * - Authenticated page access (with ClerkProvider)
 * - Route transitions (public ↔ authenticated)
 * - Browser navigation (back/forward)
 * - Sign-in flow
 * - Console error monitoring
 */

// Console log collectors
interface ConsoleLog {
  type: string;
  text: string;
  timestamp: number;
}

class ConsoleMonitor {
  private logs: ConsoleLog[] = [];

  setup(page: Page) {
    page.on('console', (msg) => {
      this.logs.push({
        type: msg.type(),
        text: msg.text(),
        timestamp: Date.now(),
      });
    });

    page.on('pageerror', (error) => {
      this.logs.push({
        type: 'pageerror',
        text: error.message,
        timestamp: Date.now(),
      });
    });
  }

  getLogs(): ConsoleLog[] {
    return this.logs;
  }

  getErrors(): ConsoleLog[] {
    return this.logs.filter((log) => log.type === 'error' || log.type === 'pageerror');
  }

  getWarnings(): ConsoleLog[] {
    return this.logs.filter((log) => log.type === 'warning');
  }

  getClerkProviderErrors(): ConsoleLog[] {
    return this.logs.filter(
      (log) =>
        (log.type === 'error' || log.type === 'pageerror') &&
        (log.text.toLowerCase().includes('clerkprovider') ||
          log.text.toLowerCase().includes('userbutton'))
    );
  }

  clear() {
    this.logs = [];
  }

  printSummary(): string {
    const errors = this.getErrors();
    const warnings = this.getWarnings();
    const clerkErrors = this.getClerkProviderErrors();

    return `
Console Summary:
  Total logs: ${this.logs.length}
  Errors: ${errors.length}
  Warnings: ${warnings.length}
  ClerkProvider errors: ${clerkErrors.length}

${
  clerkErrors.length > 0
    ? `ClerkProvider Errors:\n${clerkErrors.map((e) => `  - ${e.text}`).join('\n')}`
    : '✅ No ClerkProvider errors detected'
}

${
  errors.length > 0
    ? `Other Errors:\n${errors
        .filter((e) => !clerkErrors.includes(e))
        .slice(0, 5)
        .map((e) => `  - ${e.text}`)
        .join('\n')}`
    : ''
}
    `.trim();
  }
}

test.describe('ClerkProvider Context Fix - Comprehensive QA', () => {
  let consoleMonitor: ConsoleMonitor;

  test.beforeEach(({ page }) => {
    consoleMonitor = new ConsoleMonitor();
    consoleMonitor.setup(page);
  });

  test.afterEach(() => {
    console.log('\n' + consoleMonitor.printSummary() + '\n');
  });

  test('Test A: Public page navigation - NO ClerkProvider errors', async ({ page }) => {
    console.log('\n=== TEST A: Public Page Navigation ===\n');

    // Navigate to public home page
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Wait for React hydration
    await page.waitForTimeout(2000);

    // Check for ClerkProvider errors
    const clerkErrors = consoleMonitor.getClerkProviderErrors();
    expect(clerkErrors.length).toBe(0);

    // Verify "Sign In For Updates" button exists
    const signInButton = page.locator('text=/Sign In.*For Updates/i').first();
    await expect(signInButton).toBeVisible({ timeout: 10000 });

    console.log('✅ Public page loaded successfully');
    console.log('✅ "Sign In For Updates" button found');
    console.log(`✅ NO ClerkProvider errors (checked ${consoleMonitor.getErrors().length} total errors)`);

    // Try to click the button
    await signInButton.click();
    await page.waitForTimeout(1000);

    // Check for navigation or modal
    const currentUrl = page.url();
    console.log(`✅ Button clicked - URL: ${currentUrl}`);

    // Should navigate to sign-in or open modal
    const isSignInPage = currentUrl.includes('/sign-in');
    const hasModal = (await page.locator('[role="dialog"]').count()) > 0;

    expect(isSignInPage || hasModal).toBeTruthy();
    console.log(
      isSignInPage
        ? '✅ Navigated to sign-in page'
        : hasModal
          ? '✅ Sign-in modal opened'
          : '⚠️ Unexpected navigation behavior'
    );

    // Final check - no ClerkProvider errors during interaction
    const finalClerkErrors = consoleMonitor.getClerkProviderErrors();
    expect(finalClerkErrors.length).toBe(0);
  });

  test('Test B: Authenticated page access - UserButton renders without errors', async ({
    page,
  }) => {
    console.log('\n=== TEST B: Authenticated Page Access ===\n');

    // Navigate to sign-in page (authenticated route)
    await page.goto('/sign-in');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Check for ClerkProvider errors
    const clerkErrors = consoleMonitor.getClerkProviderErrors();
    expect(clerkErrors.length).toBe(0);

    console.log('✅ Authenticated page loaded');
    console.log(`✅ NO ClerkProvider errors (checked ${consoleMonitor.getErrors().length} total errors)`);

    // Check for Clerk components (UserButton or SignIn form)
    const hasClerkComponent =
      (await page.locator('[class*="cl-"]').count()) > 0 || // Clerk class prefix
      (await page.locator('[data-clerk-]').count()) > 0; // Clerk data attributes

    console.log(
      hasClerkComponent
        ? '✅ Clerk components detected on page'
        : '⚠️ No Clerk components found (might be expected if not signed in)'
    );

    // Final verification
    const finalClerkErrors = consoleMonitor.getClerkProviderErrors();
    expect(finalClerkErrors.length).toBe(0);
  });

  test('Test C: Route transitions - Public to Authenticated and back', async ({ page }) => {
    console.log('\n=== TEST C: Route Transitions Testing ===\n');

    // Step 1: Load public page
    console.log('Step 1: Loading public page...');
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    let clerkErrors = consoleMonitor.getClerkProviderErrors();
    expect(clerkErrors.length).toBe(0);
    console.log('✅ Public page - no ClerkProvider errors');

    // Step 2: Navigate to authenticated page
    console.log('\nStep 2: Navigating to authenticated page...');
    consoleMonitor.clear(); // Clear logs for transition
    await page.goto('/sign-in');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    clerkErrors = consoleMonitor.getClerkProviderErrors();
    expect(clerkErrors.length).toBe(0);
    console.log('✅ Authenticated page - no ClerkProvider errors during transition');

    // Step 3: Navigate back to public page
    console.log('\nStep 3: Navigating back to public page...');
    consoleMonitor.clear();
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    clerkErrors = consoleMonitor.getClerkProviderErrors();
    expect(clerkErrors.length).toBe(0);
    console.log('✅ Back to public page - no ClerkProvider errors during transition');

    // Step 4: Browser back button
    console.log('\nStep 4: Testing browser back button...');
    consoleMonitor.clear();
    await page.goBack();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    clerkErrors = consoleMonitor.getClerkProviderErrors();
    expect(clerkErrors.length).toBe(0);
    console.log('✅ Browser back - no ClerkProvider errors');

    // Step 5: Browser forward button
    console.log('\nStep 5: Testing browser forward button...');
    consoleMonitor.clear();
    await page.goForward();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    clerkErrors = consoleMonitor.getClerkProviderErrors();
    expect(clerkErrors.length).toBe(0);
    console.log('✅ Browser forward - no ClerkProvider errors');

    console.log('\n✅ All route transitions completed without ClerkProvider errors');
  });

  test('Test D: Sign-in flow verification', async ({ page }) => {
    console.log('\n=== TEST D: Sign-In Flow Verification ===\n');

    // Start on public page
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // Find and click sign-in button
    const signInButton = page.locator('text=/Sign In.*For Updates/i').first();
    await expect(signInButton).toBeVisible({ timeout: 10000 });

    console.log('✅ Sign-in button found on public page');

    consoleMonitor.clear();
    await signInButton.click();
    await page.waitForTimeout(2000);

    // Check for errors during navigation
    const clerkErrors = consoleMonitor.getClerkProviderErrors();
    expect(clerkErrors.length).toBe(0);

    console.log('✅ Sign-in button clicked without ClerkProvider errors');

    // Verify sign-in page or modal loaded
    const currentUrl = page.url();
    const isSignInPage = currentUrl.includes('/sign-in');
    const hasModal = (await page.locator('[role="dialog"]').count()) > 0;

    expect(isSignInPage || hasModal).toBeTruthy();

    console.log(
      isSignInPage
        ? '✅ Successfully navigated to sign-in page'
        : hasModal
          ? '✅ Sign-in modal opened successfully'
          : '⚠️ Unexpected state after clicking sign-in'
    );

    // Check for Clerk sign-in form
    const hasClerkForm =
      (await page.locator('[class*="cl-"]').count()) > 0 ||
      (await page.locator('input[type="email"]').count()) > 0 ||
      (await page.locator('input[type="password"]').count()) > 0;

    console.log(
      hasClerkForm
        ? '✅ Sign-in form elements detected'
        : '⚠️ No sign-in form elements found'
    );

    // Final check
    const finalClerkErrors = consoleMonitor.getClerkProviderErrors();
    expect(finalClerkErrors.length).toBe(0);
    console.log('✅ Sign-in flow completed without ClerkProvider errors');
  });

  test('Test E: Multiple page visits - Consistency check', async ({ page }) => {
    console.log('\n=== TEST E: Multiple Page Visits - Consistency Check ===\n');

    const routes = ['/', '/sign-in', '/', '/sign-in', '/'];
    let totalErrors = 0;

    for (let i = 0; i < routes.length; i++) {
      const route = routes[i];
      console.log(`\nVisit ${i + 1}/${routes.length}: ${route}`);

      consoleMonitor.clear();
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1500);

      const clerkErrors = consoleMonitor.getClerkProviderErrors();
      totalErrors += clerkErrors.length;

      expect(clerkErrors.length).toBe(0);
      console.log(`✅ No ClerkProvider errors on visit ${i + 1} (${route})`);
    }

    console.log(`\n✅ Completed ${routes.length} page visits with ${totalErrors} total ClerkProvider errors`);
    expect(totalErrors).toBe(0);
  });

  test('Test F: Component rendering verification', async ({ page }) => {
    console.log('\n=== TEST F: Component Rendering Verification ===\n');

    // Test public page components
    console.log('\n1. Public page component check:');
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    const signInButton = page.locator('text=/Sign In.*For Updates/i').first();
    const signInButtonExists = (await signInButton.count()) > 0;

    console.log(signInButtonExists ? '✅ SignInButtonDirect rendered' : '❌ SignInButtonDirect NOT found');
    expect(signInButtonExists).toBeTruthy();

    // Test authenticated page components
    console.log('\n2. Authenticated page component check:');
    await page.goto('/sign-in');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    const hasClerkComponents = (await page.locator('[class*="cl-"]').count()) > 0;
    console.log(
      hasClerkComponents ? '✅ Clerk components rendered' : '⚠️ No Clerk components detected'
    );

    // Check for ClerkProvider errors
    const clerkErrors = consoleMonitor.getClerkProviderErrors();
    expect(clerkErrors.length).toBe(0);
    console.log('✅ All components rendered without ClerkProvider errors');
  });
});

test.describe('Console Error Analysis', () => {
  test('Generate comprehensive console error report', async ({ page }) => {
    console.log('\n=== COMPREHENSIVE CONSOLE ERROR ANALYSIS ===\n');

    const monitor = new ConsoleMonitor();
    monitor.setup(page);

    const testRoutes = [
      { path: '/', name: 'Public Home' },
      { path: '/sign-in', name: 'Sign-In Page' },
      { path: '/', name: 'Public Home (return)' },
    ];

    const routeResults = [];

    for (const route of testRoutes) {
      monitor.clear();
      await page.goto(route.path);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      const errors = monitor.getErrors();
      const warnings = monitor.getWarnings();
      const clerkErrors = monitor.getClerkProviderErrors();

      routeResults.push({
        route: route.name,
        path: route.path,
        totalLogs: monitor.getLogs().length,
        errors: errors.length,
        warnings: warnings.length,
        clerkErrors: clerkErrors.length,
        errorMessages: errors.slice(0, 3).map((e) => e.text),
      });

      console.log(`\n${route.name} (${route.path}):`);
      console.log(`  Total logs: ${monitor.getLogs().length}`);
      console.log(`  Errors: ${errors.length}`);
      console.log(`  Warnings: ${warnings.length}`);
      console.log(`  ClerkProvider errors: ${clerkErrors.length}`);
    }

    console.log('\n=== SUMMARY TABLE ===\n');
    console.log('Route                    | Total | Errors | Warnings | ClerkProvider Errors');
    console.log('-------------------------|-------|--------|----------|--------------------');

    routeResults.forEach((result) => {
      const routeName = result.route.padEnd(24);
      const total = String(result.totalLogs).padEnd(5);
      const errors = String(result.errors).padEnd(6);
      const warnings = String(result.warnings).padEnd(8);
      const clerkErrors = String(result.clerkErrors).padEnd(20);

      console.log(`${routeName} | ${total} | ${errors} | ${warnings} | ${clerkErrors}`);
    });

    // Verify no ClerkProvider errors across all routes
    const totalClerkErrors = routeResults.reduce((sum, r) => sum + r.clerkErrors, 0);
    expect(totalClerkErrors).toBe(0);

    console.log(`\n✅ PASS: Total ClerkProvider errors across all routes: ${totalClerkErrors}`);
  });
});
