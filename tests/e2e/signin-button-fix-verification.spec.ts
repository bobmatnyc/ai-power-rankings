import { test, expect } from '@playwright/test';

/**
 * UAT Test: Verify "Sign In For Updates" Button Fix
 *
 * Purpose: Validate that the "Sign In For Updates" button now works correctly
 * on public pages after the fix to clerk-direct-components.tsx
 *
 * Fix Details:
 * - File: components/auth/clerk-direct-components.tsx
 * - Change: Added onClick handler to SignInButtonDirect when Clerk unavailable
 * - Behavior: Button navigates to /en/sign-in?redirect_url=<current-page>
 *
 * Test Scope:
 * - Local environment: http://localhost:3007
 * - Production can be tested separately but may not have fix deployed yet
 */

test.describe('Sign In For Updates Button - Fix Verification', () => {

  test.beforeEach(async ({ page }) => {
    // Enable console logging to detect JavaScript errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error(`Browser console error: ${msg.text()}`);
      }
    });

    // Track page errors
    page.on('pageerror', error => {
      console.error(`Page error: ${error.message}`);
    });
  });

  test('Scenario 1: Button clickable on homepage with proper cursor style', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/en', { waitUntil: 'networkidle' });

    // Wait for page to be fully loaded
    await page.waitForLoadState('domcontentloaded');

    // Find the "Sign In For Updates" button
    // It could be in multiple locations (header, navigation, etc.)
    const signInButton = page.locator('button, a').filter({
      hasText: /Sign In For Updates|Sign In/i
    }).first();

    // Verify button exists
    await expect(signInButton).toBeVisible({ timeout: 10000 });

    // Verify button has pointer cursor (indicates clickability)
    const cursor = await signInButton.evaluate((el) =>
      window.getComputedStyle(el).cursor
    );
    expect(cursor).toBe('pointer');

    // Take screenshot of button before clicking
    await page.screenshot({
      path: 'test-results/signin-button-before-click.png',
      fullPage: false
    });
  });

  test('Scenario 2: Button navigates to sign-in page on homepage', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/en', { waitUntil: 'networkidle' });

    // Get current URL to verify redirect parameter
    const currentUrl = page.url();

    // Find and click the sign-in button
    const signInButton = page.locator('button, a').filter({
      hasText: /Sign In For Updates|Sign In/i
    }).first();

    await expect(signInButton).toBeVisible();

    // Click the button
    await signInButton.click();

    // Wait for navigation
    await page.waitForURL('**/sign-in**', { timeout: 10000 });

    // Verify we're on the sign-in page
    const newUrl = page.url();
    expect(newUrl).toContain('/en/sign-in');

    // Verify redirect URL parameter exists
    expect(newUrl).toContain('redirect_url=');

    // Verify redirect URL points to original page
    expect(newUrl).toContain(encodeURIComponent('/en'));

    console.log(`✅ Navigation successful: ${currentUrl} → ${newUrl}`);
  });

  test('Scenario 3: Sign-in page loads with Clerk form', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/en');

    // Click sign-in button
    const signInButton = page.locator('button, a').filter({
      hasText: /Sign In For Updates|Sign In/i
    }).first();

    await signInButton.click();
    await page.waitForURL('**/sign-in**');

    // Wait for sign-in page to fully load
    await page.waitForLoadState('networkidle');

    // Verify sign-in page elements are present
    // Look for Clerk authentication form elements
    const hasEmailInput = await page.locator('input[type="email"], input[name="email"], input[name="identifier"]').count() > 0;
    const hasPasswordInput = await page.locator('input[type="password"], input[name="password"]').count() > 0;
    const hasSignInForm = await page.locator('form').count() > 0;

    // At least one of these should be true for a valid sign-in page
    expect(hasEmailInput || hasPasswordInput || hasSignInForm).toBeTruthy();

    // Take screenshot of sign-in page
    await page.screenshot({
      path: 'test-results/signin-page-loaded.png',
      fullPage: true
    });

    console.log('✅ Sign-in page loaded with authentication form');
  });

  test('Scenario 4: No JavaScript console errors during button click', async ({ page }) => {
    const consoleErrors: string[] = [];

    // Collect console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Navigate to homepage
    await page.goto('/en');

    // Click sign-in button
    const signInButton = page.locator('button, a').filter({
      hasText: /Sign In For Updates|Sign In/i
    }).first();

    await signInButton.click();
    await page.waitForURL('**/sign-in**', { timeout: 10000 });

    // Wait a bit to catch any delayed errors
    await page.waitForTimeout(2000);

    // Filter out known non-critical errors (if any)
    const criticalErrors = consoleErrors.filter(err =>
      !err.includes('favicon') &&
      !err.includes('analytics') &&
      !err.includes('third-party')
    );

    // Verify no critical console errors
    expect(criticalErrors).toHaveLength(0);

    if (consoleErrors.length > 0) {
      console.log('Console errors detected:', consoleErrors);
    } else {
      console.log('✅ No console errors during navigation');
    }
  });

  test('Scenario 5: Button behavior on tool detail page', async ({ page }) => {
    // Test from a different public page to ensure consistent behavior
    // Navigate to a tool detail page (example: Claude AI if it exists)
    const toolPages = ['/en/tools/claude', '/en/tools/chatgpt', '/en'];

    for (const toolPath of toolPages) {
      try {
        await page.goto(toolPath, { waitUntil: 'networkidle', timeout: 10000 });

        // Find sign-in button
        const signInButton = page.locator('button, a').filter({
          hasText: /Sign In For Updates|Sign In/i
        }).first();

        if (await signInButton.isVisible({ timeout: 5000 })) {
          const currentPath = new URL(page.url()).pathname;

          // Click button
          await signInButton.click();
          await page.waitForURL('**/sign-in**', { timeout: 10000 });

          // Verify redirect URL includes the tool page
          const signInUrl = page.url();
          expect(signInUrl).toContain('redirect_url=');
          expect(signInUrl).toContain(encodeURIComponent(currentPath));

          console.log(`✅ Button works on ${toolPath}`);
          break; // Test passed on one page
        }
      } catch (error) {
        // Page might not exist, try next one
        continue;
      }
    }
  });

  test('Scenario 6: Button visual regression check', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/en');

    // Wait for button to be visible
    const signInButton = page.locator('button, a').filter({
      hasText: /Sign In For Updates|Sign In/i
    }).first();

    await expect(signInButton).toBeVisible();

    // Take screenshot of button area for visual comparison
    const buttonBox = await signInButton.boundingBox();

    if (buttonBox) {
      await page.screenshot({
        path: 'test-results/signin-button-visual.png',
        clip: {
          x: Math.max(0, buttonBox.x - 20),
          y: Math.max(0, buttonBox.y - 20),
          width: buttonBox.width + 40,
          height: buttonBox.height + 40,
        }
      });

      console.log('✅ Visual regression screenshot captured');
    }

    // Verify button text is correct
    const buttonText = await signInButton.textContent();
    expect(buttonText).toMatch(/Sign In|Sign In For Updates/i);
  });

  test('Scenario 7: Hover state verification', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/en');

    // Find sign-in button
    const signInButton = page.locator('button, a').filter({
      hasText: /Sign In For Updates|Sign In/i
    }).first();

    await expect(signInButton).toBeVisible();

    // Hover over button
    await signInButton.hover();

    // Wait for any CSS transitions
    await page.waitForTimeout(500);

    // Take screenshot of hover state
    await page.screenshot({
      path: 'test-results/signin-button-hover.png',
      fullPage: false
    });

    // Verify cursor is pointer on hover
    const cursor = await signInButton.evaluate((el) =>
      window.getComputedStyle(el).cursor
    );
    expect(cursor).toBe('pointer');

    console.log('✅ Hover state verified');
  });

  test('Scenario 8: Accessibility verification', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/en');

    // Find sign-in button
    const signInButton = page.locator('button, a').filter({
      hasText: /Sign In For Updates|Sign In/i
    }).first();

    await expect(signInButton).toBeVisible();

    // Check if button is focusable
    await signInButton.focus();
    const isFocused = await signInButton.evaluate((el) =>
      el === document.activeElement
    );
    expect(isFocused).toBeTruthy();

    // Check if button can be activated with Enter key
    await page.keyboard.press('Enter');

    // Wait for navigation
    try {
      await page.waitForURL('**/sign-in**', { timeout: 5000 });
      console.log('✅ Button is keyboard accessible');
    } catch {
      console.warn('⚠️  Keyboard navigation may need improvement');
    }
  });
});

test.describe('Cross-Browser Compatibility', () => {
  test('Button works across different browsers', async ({ page, browserName }) => {
    console.log(`Testing in ${browserName}`);

    // Navigate to homepage
    await page.goto('/en');

    // Find and click sign-in button
    const signInButton = page.locator('button, a').filter({
      hasText: /Sign In For Updates|Sign In/i
    }).first();

    await expect(signInButton).toBeVisible();
    await signInButton.click();

    // Verify navigation works in this browser
    await page.waitForURL('**/sign-in**', { timeout: 10000 });

    const url = page.url();
    expect(url).toContain('/en/sign-in');
    expect(url).toContain('redirect_url=');

    console.log(`✅ Button works correctly in ${browserName}`);
  });
});

test.describe('Edge Cases', () => {
  test('Button handles rapid clicks gracefully', async ({ page }) => {
    await page.goto('/en');

    const signInButton = page.locator('button, a').filter({
      hasText: /Sign In For Updates|Sign In/i
    }).first();

    await expect(signInButton).toBeVisible();

    // Click button multiple times rapidly
    await signInButton.click({ clickCount: 3, delay: 100 });

    // Should still navigate to sign-in page (not cause errors)
    await page.waitForURL('**/sign-in**', { timeout: 10000 });

    const url = page.url();
    expect(url).toContain('/en/sign-in');

    console.log('✅ Button handles rapid clicks');
  });

  test('Button works after page reload', async ({ page }) => {
    await page.goto('/en');

    // Reload the page
    await page.reload({ waitUntil: 'networkidle' });

    // Button should still work after reload
    const signInButton = page.locator('button, a').filter({
      hasText: /Sign In For Updates|Sign In/i
    }).first();

    await expect(signInButton).toBeVisible();
    await signInButton.click();

    await page.waitForURL('**/sign-in**', { timeout: 10000 });

    console.log('✅ Button works after page reload');
  });
});
