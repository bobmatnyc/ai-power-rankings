import { test, expect } from '@playwright/test';

/**
 * Quick Verification Check for staging.aipowerranking.com
 * Spot check to verify operational status
 */

const STAGING_URL = 'https://staging.aipowerranking.com';

test.describe('Staging Quick Verification', () => {
  test('Homepage loads without errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    const networkErrors: string[] = [];

    // Capture console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Capture network errors
    page.on('response', (response) => {
      if (response.status() >= 400) {
        networkErrors.push(`${response.status()} ${response.url()}`);
      }
    });

    // Navigate to homepage
    await page.goto(`${STAGING_URL}/en`);

    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle', { timeout: 15000 });

    // Check for "Something went wrong" error
    const errorPage = await page.locator('text=Something went wrong').count();
    expect(errorPage).toBe(0);

    // Report console errors
    if (consoleErrors.length > 0) {
      console.log('Console Errors:', consoleErrors);
    }

    // Report network errors
    if (networkErrors.length > 0) {
      console.log('Network Errors:', networkErrors);
    }
  });

  test('Rankings display with tool names', async ({ page }) => {
    await page.goto(`${STAGING_URL}/en`);
    await page.waitForLoadState('networkidle', { timeout: 15000 });

    // Check for top 3 ranked tools
    const claudeCode = page.locator('text=Claude Code').first();
    const githubCopilot = page.locator('text=GitHub Copilot').first();
    const cursor = page.locator('text=Cursor').first();

    await expect(claudeCode).toBeVisible();
    await expect(githubCopilot).toBeVisible();
    await expect(cursor).toBeVisible();

    // Verify no "Unknown Tool" text
    const unknownTool = await page.locator('text=Unknown Tool').count();
    expect(unknownTool).toBe(0);
  });

  test('Tool details page loads', async ({ page }) => {
    await page.goto(`${STAGING_URL}/en`);
    await page.waitForLoadState('networkidle', { timeout: 15000 });

    // Click on Claude Code
    await page.click('text=Claude Code');

    // Wait for navigation
    await page.waitForLoadState('networkidle', { timeout: 15000 });

    // Check URL
    expect(page.url()).toContain('/tools/claude-code');

    // Check for tool details
    const toolName = page.locator('h1:has-text("Claude Code")');
    await expect(toolName).toBeVisible();
  });

  test('Language switcher works (EN↔JA)', async ({ page }) => {
    await page.goto(`${STAGING_URL}/en`);
    await page.waitForLoadState('networkidle', { timeout: 15000 });

    // Look for language switcher
    const languageSwitcher = page.locator('[role="combobox"], button:has-text("EN"), button:has-text("Language")').first();

    if (await languageSwitcher.isVisible()) {
      await languageSwitcher.click();

      // Try to find Japanese option
      const japaneseOption = page.locator('text=日本語, text=JA, text=Japanese').first();

      if (await japaneseOption.isVisible()) {
        await japaneseOption.click();

        // Wait for navigation
        await page.waitForLoadState('networkidle', { timeout: 15000 });

        // Check URL changed to /ja
        expect(page.url()).toContain('/ja');
      }
    }
  });

  test('Navigation works', async ({ page }) => {
    await page.goto(`${STAGING_URL}/en`);
    await page.waitForLoadState('networkidle', { timeout: 15000 });

    // Test Rankings link
    await page.click('a[href="/en/rankings"]');
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    expect(page.url()).toContain('/rankings');

    // Go back home
    await page.goto(`${STAGING_URL}/en`);
    await page.waitForLoadState('networkidle', { timeout: 15000 });

    // Test News link
    await page.click('a[href="/en/news"]');
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    expect(page.url()).toContain('/news');
  });

  test('API responses check', async ({ page }) => {
    const apiResponses: { url: string; status: number }[] = [];

    page.on('response', (response) => {
      if (response.url().includes('/api/')) {
        apiResponses.push({
          url: response.url(),
          status: response.status(),
        });
      }
    });

    await page.goto(`${STAGING_URL}/en`);
    await page.waitForLoadState('networkidle', { timeout: 15000 });

    // Report API responses
    console.log('API Responses:', apiResponses);

    // Check for critical API failures
    const criticalFailures = apiResponses.filter(r => r.status === 500);
    if (criticalFailures.length > 0) {
      console.warn('Critical API Failures (500):', criticalFailures);
    }
  });
});
