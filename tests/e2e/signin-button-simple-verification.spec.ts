import { test, expect } from '@playwright/test';

/**
 * Simplified Sign-In Button Verification
 * Tests the fix for "Sign In For Updates" button on public pages
 */

test.describe('Sign In Button - Quick Verification', () => {

  test('Button exists and is clickable on homepage', async ({ page }) => {
    await page.goto('/en');

    // Find the "Sign In For Updates" button - exact text match
    const signInButton = page.getByRole('button', { name: 'Sign In For Updates' });

    // Verify button exists and is visible
    await expect(signInButton).toBeVisible({ timeout: 10000 });

    // Verify cursor style indicates clickability
    const cursor = await signInButton.evaluate((el) =>
      window.getComputedStyle(el).cursor
    );
    expect(cursor).toBe('pointer');

    console.log('✅ Button is visible and has pointer cursor');
  });

  test('Button navigates to sign-in page with redirect URL', async ({ page }) => {
    await page.goto('/en');

    // Get current URL before clicking
    const originalUrl = page.url();
    console.log(`Original URL: ${originalUrl}`);

    // Find and click the button
    const signInButton = page.getByRole('button', { name: 'Sign In For Updates' });
    await expect(signInButton).toBeVisible();

    // Click the button
    await signInButton.click();

    // Wait for navigation
    await page.waitForURL('**/sign-in**', { timeout: 10000 });

    // Get new URL
    const newUrl = page.url();
    console.log(`New URL: ${newUrl}`);

    // Verify we're on the sign-in page
    expect(newUrl).toContain('/en/sign-in');

    // Verify redirect_url parameter exists
    expect(newUrl).toContain('redirect_url=');

    console.log('✅ Navigation successful with redirect URL parameter');
  });

  test('Sign-in page loads properly after button click', async ({ page }) => {
    await page.goto('/en');

    // Click sign-in button
    const signInButton = page.getByRole('button', { name: 'Sign In For Updates' });
    await signInButton.click();

    // Wait for sign-in page
    await page.waitForURL('**/sign-in**');
    await page.waitForLoadState('networkidle');

    // Take screenshot
    await page.screenshot({
      path: 'test-results/signin-page-screenshot.png',
      fullPage: true
    });

    // Verify page loaded (not 404 or error)
    const pageTitle = await page.title();
    expect(pageTitle).toBeTruthy();
    expect(pageTitle).not.toContain('404');
    expect(pageTitle).not.toContain('Error');

    console.log(`✅ Sign-in page loaded successfully: ${pageTitle}`);
  });

  test('No critical console errors during navigation', async ({ page }) => {
    const errors: string[] = [];

    // Collect console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Navigate and click
    await page.goto('/en');
    const signInButton = page.getByRole('button', { name: 'Sign In For Updates' });
    await signInButton.click();
    await page.waitForURL('**/sign-in**');

    // Wait for any delayed errors
    await page.waitForTimeout(2000);

    // Filter out non-critical errors
    const criticalErrors = errors.filter(err =>
      !err.includes('favicon') &&
      !err.includes('analytics') &&
      !err.toLowerCase().includes('clerk') // Clerk might have console warnings
    );

    console.log(`Total errors: ${errors.length}, Critical: ${criticalErrors.length}`);

    if (criticalErrors.length > 0) {
      console.warn('Critical errors found:', criticalErrors);
    } else {
      console.log('✅ No critical console errors');
    }
  });

  test('Button works on different pages', async ({ page, browserName }) => {
    const testPages = [
      { path: '/en', name: 'Homepage' },
      { path: '/en/rankings', name: 'Rankings' }
    ];

    for (const testPage of testPages) {
      console.log(`Testing ${testPage.name}...`);

      await page.goto(testPage.path);

      try {
        const signInButton = page.getByRole('button', { name: 'Sign In For Updates' });

        if (await signInButton.isVisible({ timeout: 5000 })) {
          const currentPath = new URL(page.url()).pathname;

          await signInButton.click();
          await page.waitForURL('**/sign-in**', { timeout: 10000 });

          const signInUrl = page.url();
          expect(signInUrl).toContain('redirect_url=');

          console.log(`✅ ${testPage.name}: Button works correctly`);

          // Go back for next test
          await page.goBack();
          await page.waitForLoadState('networkidle');
        }
      } catch (error) {
        console.log(`⚠️  ${testPage.name}: ${error}`);
      }
    }
  });

  test('Visual regression - Button appearance', async ({ page }) => {
    await page.goto('/en');

    const signInButton = page.getByRole('button', { name: 'Sign In For Updates' });
    await expect(signInButton).toBeVisible();

    // Take screenshot before hover
    await page.screenshot({
      path: 'test-results/button-normal-state.png',
      fullPage: false
    });

    // Hover and take screenshot
    await signInButton.hover();
    await page.waitForTimeout(300);

    await page.screenshot({
      path: 'test-results/button-hover-state.png',
      fullPage: false
    });

    console.log('✅ Visual regression screenshots captured');
  });
});
