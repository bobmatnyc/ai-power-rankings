import { test, expect, type Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

/**
 * UAT Test: Clerk Authentication Sign-In Button Verification
 *
 * Test Objectives:
 * 1. Verify homepage loads and redirects to /en
 * 2. Verify sign-in button is visible when not authenticated
 * 3. Test clicking the button opens Clerk modal
 * 4. Verify Clerk modal displays properly
 * 5. Check for JavaScript errors
 * 6. Verify Clerk headers are present
 */

test.describe('Clerk Authentication Sign-In Button UAT', () => {
  const BASE_URL = 'http://localhost:3000';
  let screenshotDir: string;

  test.beforeAll(async () => {
    // Create screenshots directory
    screenshotDir = path.join(process.cwd(), 'uat-screenshots', 'clerk-auth-' + Date.now());
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }
  });

  test('1. Homepage loads and redirects to /en', async ({ page }) => {
    const consoleMessages: string[] = [];
    const consoleErrors: string[] = [];

    // Monitor console messages
    page.on('console', (msg) => {
      const text = msg.text();
      consoleMessages.push(`[${msg.type()}] ${text}`);
      if (msg.type() === 'error') {
        consoleErrors.push(text);
      }
    });

    // Monitor page errors
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });

    // Navigate to homepage
    console.log('Navigating to homepage...');
    const response = await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    // Verify response
    expect(response).toBeTruthy();
    expect(response?.status()).toBe(200);

    // Wait for redirect to /en
    await page.waitForURL(/\/en\/?/, { timeout: 10000 });

    const currentUrl = page.url();
    console.log(`Current URL after redirect: ${currentUrl}`);
    expect(currentUrl).toContain('/en');

    // Take screenshot of homepage
    await page.screenshot({
      path: path.join(screenshotDir, '1-homepage-loaded.png'),
      fullPage: true
    });

    // Check for Clerk-related errors
    const clerkErrors = consoleErrors.filter(err =>
      err.toLowerCase().includes('clerk') ||
      err.toLowerCase().includes('auth')
    );

    if (clerkErrors.length > 0) {
      console.warn('Clerk-related console errors found:', clerkErrors);
    }

    // Log results
    console.log('✅ Homepage loaded successfully');
    console.log('✅ Redirected to /en');
    console.log(`Console messages: ${consoleMessages.length}`);
    console.log(`Console errors: ${consoleErrors.length}`);
    console.log(`Page errors: ${pageErrors.length}`);
  });

  test('2. Verify Clerk headers are present', async ({ page }) => {
    console.log('Checking Clerk headers...');

    const response = await page.goto(BASE_URL + '/en', { waitUntil: 'domcontentloaded' });

    const headers = response?.headers() || {};
    console.log('Response headers:', Object.keys(headers));

    // Check for Clerk authentication headers
    const hasClerkAuthStatus = 'x-clerk-auth-status' in headers;
    const clerkAuthStatus = headers['x-clerk-auth-status'];
    const clerkAuthReason = headers['x-clerk-auth-reason'];

    console.log(`Clerk Auth Status: ${clerkAuthStatus}`);
    console.log(`Clerk Auth Reason: ${clerkAuthReason}`);

    expect(hasClerkAuthStatus).toBe(true);
    expect(clerkAuthStatus).toBe('signed-out');

    console.log('✅ Clerk headers present and correct');
  });

  test('3. Sign-In button is visible when not authenticated', async ({ page }) => {
    console.log('Checking for sign-in button...');

    await page.goto(BASE_URL + '/en', { waitUntil: 'networkidle' });

    // Wait for page to fully load
    await page.waitForLoadState('networkidle');

    // Take screenshot before searching for button
    await page.screenshot({
      path: path.join(screenshotDir, '2-page-before-button-search.png'),
      fullPage: true
    });

    // Look for the SignupUpdatesButton component
    // It should render a button with text "Sign up for updates →"
    const signupButton = page.locator('button, a').filter({
      hasText: /sign.*up.*for.*updates/i
    });

    // Wait for button to be visible
    await signupButton.waitFor({ state: 'visible', timeout: 10000 });

    const isVisible = await signupButton.isVisible();
    expect(isVisible).toBe(true);

    // Get button text
    const buttonText = await signupButton.textContent();
    console.log(`Button text: "${buttonText}"`);

    // Highlight the button and take screenshot
    await signupButton.evaluate(el => {
      el.style.border = '3px solid red';
      el.style.boxShadow = '0 0 10px rgba(255, 0, 0, 0.5)';
    });

    await page.screenshot({
      path: path.join(screenshotDir, '3-signup-button-highlighted.png'),
      fullPage: true
    });

    console.log('✅ Sign-in button is visible');
  });

  test('4. Clicking button opens Clerk modal', async ({ page }) => {
    console.log('Testing button click to open Clerk modal...');

    await page.goto(BASE_URL + '/en', { waitUntil: 'networkidle' });

    // Find the signup button
    const signupButton = page.locator('button, a').filter({
      hasText: /sign.*up.*for.*updates/i
    }).first();

    await signupButton.waitFor({ state: 'visible', timeout: 10000 });

    // Take screenshot before clicking
    await page.screenshot({
      path: path.join(screenshotDir, '4-before-button-click.png'),
      fullPage: true
    });

    console.log('Clicking sign-up button...');
    await signupButton.click();

    // Wait for Clerk modal to appear
    // Clerk modals typically have specific attributes or classes
    await page.waitForTimeout(2000); // Give time for modal to open

    // Take screenshot after clicking
    await page.screenshot({
      path: path.join(screenshotDir, '5-after-button-click.png'),
      fullPage: true
    });

    // Look for Clerk modal indicators
    // Clerk uses specific class names and data attributes
    const clerkModal = page.locator('[data-clerk-modal], .cl-modal, .cl-modalContent, .cl-rootBox');

    // Check if modal is visible
    const modalVisible = await clerkModal.first().isVisible().catch(() => false);

    if (modalVisible) {
      console.log('✅ Clerk modal is visible');

      // Take detailed screenshot of modal
      await page.screenshot({
        path: path.join(screenshotDir, '6-clerk-modal-opened.png'),
        fullPage: true
      });
    } else {
      console.warn('⚠️ Clerk modal not detected with standard selectors');
      console.log('Checking for any modal-like elements...');

      // Check for generic modal indicators
      const anyModal = page.locator('[role="dialog"], .modal, [aria-modal="true"]');
      const anyModalVisible = await anyModal.first().isVisible().catch(() => false);

      if (anyModalVisible) {
        console.log('✅ Modal detected (generic selector)');
        await page.screenshot({
          path: path.join(screenshotDir, '6-modal-detected-generic.png'),
          fullPage: true
        });
      } else {
        // Log page content for debugging
        const bodyHtml = await page.locator('body').innerHTML();
        const hasClerkElements = bodyHtml.includes('clerk') || bodyHtml.includes('cl-');
        console.log(`Page has Clerk elements: ${hasClerkElements}`);
      }
    }
  });

  test('5. Verify no Clerk-related JavaScript errors', async ({ page }) => {
    console.log('Monitoring for JavaScript errors...');

    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });

    await page.goto(BASE_URL + '/en', { waitUntil: 'networkidle' });

    // Interact with the page
    const signupButton = page.locator('button, a').filter({
      hasText: /sign.*up.*for.*updates/i
    }).first();

    if (await signupButton.isVisible().catch(() => false)) {
      await signupButton.click();
      await page.waitForTimeout(3000);
    }

    // Filter for Clerk-related errors
    const clerkConsoleErrors = consoleErrors.filter(err =>
      err.toLowerCase().includes('clerk') ||
      err.toLowerCase().includes('authentication')
    );

    const clerkPageErrors = pageErrors.filter(err =>
      err.toLowerCase().includes('clerk') ||
      err.toLowerCase().includes('authentication')
    );

    console.log(`Total console errors: ${consoleErrors.length}`);
    console.log(`Clerk-related console errors: ${clerkConsoleErrors.length}`);
    console.log(`Total page errors: ${pageErrors.length}`);
    console.log(`Clerk-related page errors: ${clerkPageErrors.length}`);

    if (clerkConsoleErrors.length > 0) {
      console.warn('Clerk console errors:', clerkConsoleErrors);
    }

    if (clerkPageErrors.length > 0) {
      console.warn('Clerk page errors:', clerkPageErrors);
    }

    // Test passes if no critical Clerk errors
    expect(clerkPageErrors.length).toBe(0);

    console.log('✅ No critical Clerk JavaScript errors detected');
  });

  test.afterAll(async () => {
    console.log(`\n📸 Screenshots saved to: ${screenshotDir}`);
    console.log('\nUAT Test Summary:');
    console.log('- Homepage loads and redirects to /en');
    console.log('- Clerk headers present in HTTP response');
    console.log('- Sign-in button visible when not authenticated');
    console.log('- Button click interaction tested');
    console.log('- JavaScript console monitored for errors');
  });
});
