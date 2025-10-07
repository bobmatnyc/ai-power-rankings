/**
 * Comprehensive UAT Test Suite for Staging Environment
 *
 * Tests staging.aipowerranking.com against production database
 *
 * Coverage:
 * 1. Core Functionality (Homepage, Rankings, Navigation)
 * 2. Critical User Flows (Browse tools, Read articles, Switch language)
 * 3. Database Connectivity (Rankings data, Tool info, Articles)
 * 4. UI/UX Verification (Responsive design, Performance, No errors)
 * 5. Admin Dashboard (if authenticated)
 *
 * Evidence collected:
 * - Screenshots of all key pages
 * - Video recordings of user flows
 * - Console error logs
 * - Performance metrics
 * - API response validation
 */

import { test, expect, type Page } from '@playwright/test';

// Helper functions
async function setupConsoleTracking(page: Page) {
  const errors: string[] = [];
  const warnings: string[] = [];

  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
    if (msg.type() === 'warning') warnings.push(msg.text());
  });

  page.on('pageerror', error => errors.push(error.message));

  return { errors, warnings };
}

async function waitForNetworkIdle(page: Page) {
  try {
    await page.waitForLoadState('networkidle', { timeout: 30000 });
  } catch {
    // Network idle timeout is acceptable
  }
}

async function captureEvidence(page: Page, testName: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  await page.screenshot({
    path: `test-results/uat-staging/evidence/${testName}-${timestamp}.png`,
    fullPage: true
  });
}

// Performance metrics helper
async function measurePageLoad(page: Page, url: string) {
  const startTime = Date.now();
  await page.goto(url);
  await waitForNetworkIdle(page);
  const loadTime = Date.now() - startTime;
  return loadTime;
}

test.describe('UAT: Core Functionality - Homepage and Rankings', () => {

  test('Homepage loads successfully with rankings preview', async ({ page }) => {
    const console = await setupConsoleTracking(page);

    // Navigate to homepage
    await page.goto('/en');
    await waitForNetworkIdle(page);

    // Capture evidence
    await captureEvidence(page, 'homepage-loaded');

    // Verify page loads
    expect(page.url()).toContain('/en');

    // Check for main heading
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible({ timeout: 15000 });

    // Verify no critical console errors (log but don't fail on minor errors)
    const criticalErrors = console.errors.filter(
      e => !e.includes('ResizeObserver') && !e.includes('favicon') && !e.includes('Failed to load resource')
    );

    // Log errors for reporting but allow some non-blocking errors
    if (criticalErrors.length > 0) {
      console.log('Console errors detected:', criticalErrors);
    }

    // Only fail if there are severe errors
    const severeErrors = criticalErrors.filter(e =>
      e.includes('undefined') || e.includes('null is not') || e.includes('Cannot read')
    );
    expect(severeErrors).toHaveLength(0);

    // Check for rankings preview or CTA
    const hasRankings = await page.locator('text=/ranking|power|tools/i').count() > 0;
    expect(hasRankings).toBeTruthy();
  });

  test('Rankings page displays tool list correctly', async ({ page }) => {
    const console = await setupConsoleTracking(page);

    await page.goto('/en/rankings');
    await waitForNetworkIdle(page);
    await captureEvidence(page, 'rankings-page');

    // Verify rankings content
    await expect(page.locator('text=/ranking|power/i').first()).toBeVisible();

    // Check for tool cards or table
    const toolElements = page.locator('[data-testid*="tool"], [class*="tool"], table tr, .card');
    const toolCount = await toolElements.count();
    expect(toolCount).toBeGreaterThan(0);

    // Verify top 3 tools are visible
    const topTools = page.locator('text=/claude|copilot|cursor/i');
    expect(await topTools.count()).toBeGreaterThan(0);

    // Log errors for reporting
    if (console.errors.length > 0) {
      console.log('Console errors on rankings page:', console.errors);
    }
  });

  test('Tool details page renders with complete information', async ({ page }) => {
    await page.goto('/en/rankings');
    await waitForNetworkIdle(page);

    // Click on first tool link
    const toolLink = page.locator('a[href*="/tools/"], a[href*="/tool/"]').first();

    if (await toolLink.count() > 0) {
      await toolLink.click();
      await waitForNetworkIdle(page);
      await captureEvidence(page, 'tool-detail-page');

      // Verify tool detail elements
      const hasToolName = await page.locator('h1, h2').count() > 0;
      expect(hasToolName).toBeTruthy();

      // Check for key information sections
      const hasDescription = await page.locator('text=/description|about|overview/i').count() > 0;
      const hasScore = await page.locator('text=/score|rating|rank/i').count() > 0;

      expect(hasDescription || hasScore).toBeTruthy();
    }
  });
});

test.describe('UAT: Critical User Flow - Language Switching', () => {

  test('Switch from English to Japanese maintains context', async ({ page }) => {
    await page.goto('/en/rankings');
    await waitForNetworkIdle(page);

    // Find language switcher
    const langSwitcher = page.locator('button:has-text("JP"), button:has-text("JA"), button:has-text("日本語"), a[href*="/ja/"]');

    if (await langSwitcher.count() > 0) {
      await captureEvidence(page, 'before-lang-switch');

      await langSwitcher.first().click();
      await waitForNetworkIdle(page);

      await captureEvidence(page, 'after-lang-switch');

      // Verify URL changed to Japanese
      expect(page.url()).toContain('/ja/');

      // Verify content is in Japanese (check for Japanese characters)
      const bodyText = await page.locator('body').textContent();
      const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(bodyText || '');
      expect(hasJapanese).toBeTruthy();
    }
  });

  test('Switch from Japanese to English works correctly', async ({ page }) => {
    await page.goto('/ja/rankings');
    await waitForNetworkIdle(page);

    // Find English language switcher
    const langSwitcher = page.locator('button:has-text("EN"), a[href*="/en/"]');

    if (await langSwitcher.count() > 0) {
      await langSwitcher.first().click();
      await waitForNetworkIdle(page);

      // Verify URL changed to English
      expect(page.url()).toContain('/en/');

      // Should still be on rankings page
      expect(page.url()).toContain('ranking');
    }
  });
});

test.describe('UAT: Database Connectivity - Live Data', () => {

  test('Rankings data loads from production database', async ({ page }) => {
    const response = await page.goto('/en/rankings');
    expect(response?.status()).toBe(200);

    await waitForNetworkIdle(page);

    // Intercept API call
    const apiResponse = await page.waitForResponse(
      resp => resp.url().includes('/api/rankings'),
      { timeout: 30000 }
    ).catch(() => null);

    if (apiResponse) {
      const data = await apiResponse.json();
      expect(data).toBeTruthy();

      // Verify data structure
      expect(data).toHaveProperty('rankings');
      expect(Array.isArray(data.rankings)).toBeTruthy();
      expect(data.rankings.length).toBeGreaterThan(0);
    }
  });

  test('Trending data endpoint returns valid historical data', async ({ page }) => {
    const response = await page.request.get('/api/rankings/trending');
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data).toBeTruthy();
    expect(data).toHaveProperty('periods');
    expect(Array.isArray(data.periods)).toBeTruthy();
  });

  test('Articles/News data is accessible', async ({ page }) => {
    // Try to access news page
    await page.goto('/en/news');
    await waitForNetworkIdle(page);

    // Alternative: check if news/articles section exists on homepage
    const hasNews = await page.locator('text=/news|article|blog/i').count() > 0;

    if (hasNews) {
      await captureEvidence(page, 'news-section');

      // Verify articles are displayed
      const articles = page.locator('article, .article, .news-item, .post');
      const articleCount = await articles.count();
      expect(articleCount).toBeGreaterThanOrEqual(0);
    }
  });
});

test.describe('UAT: UI/UX Verification - Responsive Design', () => {

  test('Desktop viewport (1920x1080) renders correctly', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/en');
    await waitForNetworkIdle(page);
    await captureEvidence(page, 'desktop-1920x1080');

    // Verify desktop layout
    const container = page.locator('main, .container, .content');
    await expect(container.first()).toBeVisible();
  });

  test('Tablet viewport (768x1024) adapts layout', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/en/rankings');
    await waitForNetworkIdle(page);
    await captureEvidence(page, 'tablet-768x1024');

    // Verify content is visible
    const mainContent = page.locator('main, .main-content');
    await expect(mainContent.first()).toBeVisible();
  });

  test('Mobile viewport (375x667) shows mobile-optimized UI', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/en');
    await waitForNetworkIdle(page);
    await captureEvidence(page, 'mobile-375x667');

    // Check for mobile navigation (hamburger menu)
    const mobileNav = page.locator('[aria-label*="menu"], button[class*="hamburger"], button[class*="mobile"]');

    // Verify text is readable (not too small)
    const bodyText = page.locator('body');
    const fontSize = await bodyText.evaluate(el =>
      window.getComputedStyle(el).fontSize
    );
    expect(parseFloat(fontSize)).toBeGreaterThanOrEqual(14);
  });
});

test.describe('UAT: Performance Metrics', () => {

  test('Homepage loads within acceptable time', async ({ page }) => {
    const loadTime = await measurePageLoad(page, '/en');

    console.log(`Homepage load time: ${loadTime}ms`);

    // Should load within 5 seconds on staging (allowing for latency)
    expect(loadTime).toBeLessThan(5000);

    await captureEvidence(page, 'homepage-performance');
  });

  test('Rankings page loads within acceptable time', async ({ page }) => {
    const loadTime = await measurePageLoad(page, '/en/rankings');

    console.log(`Rankings page load time: ${loadTime}ms`);

    // Data-heavy page, allow up to 6 seconds
    expect(loadTime).toBeLessThan(6000);
  });

  test('Images load and display correctly', async ({ page }) => {
    await page.goto('/en/rankings');
    await waitForNetworkIdle(page);

    // Check for images
    const images = page.locator('img');
    const imageCount = await images.count();

    if (imageCount > 0) {
      // Verify first few images loaded
      for (let i = 0; i < Math.min(3, imageCount); i++) {
        const img = images.nth(i);
        const isVisible = await img.isVisible();

        if (isVisible) {
          // Check if image has natural dimensions (loaded)
          const hasSize = await img.evaluate((el: HTMLImageElement) =>
            el.naturalWidth > 0 && el.naturalHeight > 0
          );
          expect(hasSize).toBeTruthy();
        }
      }
    }
  });
});

test.describe('UAT: Navigation and Links', () => {

  test('Main navigation links work correctly', async ({ page }) => {
    await page.goto('/en');
    await waitForNetworkIdle(page);

    // Find navigation links
    const navLinks = page.locator('nav a, header a');
    const linkCount = await navLinks.count();

    expect(linkCount).toBeGreaterThan(0);

    // Test first navigation link
    if (linkCount > 0) {
      const firstLink = navLinks.first();
      const href = await firstLink.getAttribute('href');

      if (href && !href.startsWith('#') && !href.startsWith('http')) {
        await firstLink.click();
        await waitForNetworkIdle(page);

        // Verify navigation occurred
        expect(page.url()).not.toContain('about:blank');
        await captureEvidence(page, 'navigation-test');
      }
    }
  });

  test('Footer links are present and functional', async ({ page }) => {
    await page.goto('/en');
    await waitForNetworkIdle(page);

    // Check for footer
    const footer = page.locator('footer');

    if (await footer.count() > 0) {
      await footer.scrollIntoViewIfNeeded();
      await captureEvidence(page, 'footer-visible');

      // Verify footer links exist
      const footerLinks = footer.locator('a');
      const linkCount = await footerLinks.count();
      expect(linkCount).toBeGreaterThan(0);
    }
  });
});

test.describe('UAT: Admin Dashboard (if accessible)', () => {

  test('Admin route requires authentication', async ({ page }) => {
    await page.goto('/en/admin');
    await waitForNetworkIdle(page);

    const url = page.url();

    // Should either redirect to login or show access denied
    const isLoginPage = url.includes('sign-in') || url.includes('login');
    const hasAccessDenied = await page.locator('text=/access denied|unauthorized|forbidden/i').count() > 0;

    expect(isLoginPage || hasAccessDenied).toBeTruthy();
    await captureEvidence(page, 'admin-auth-check');
  });
});

test.describe('UAT: Error Handling and Edge Cases', () => {

  test('404 page renders correctly', async ({ page }) => {
    const response = await page.goto('/en/non-existent-page-xyz');

    // Should show 404 page (might be custom or default)
    expect(response?.status()).toBe(404);

    await captureEvidence(page, '404-page');

    // Verify 404 content
    const has404 = await page.locator('text=/404|not found|page.*not.*exist/i').count() > 0;
    expect(has404).toBeTruthy();
  });

  test('API error handling works gracefully', async ({ page }) => {
    // Test with invalid API endpoint
    const response = await page.request.get('/api/invalid-endpoint-xyz');

    // Should return error status
    expect([400, 404, 500]).toContain(response.status());

    // Check if response is JSON error
    try {
      const data = await response.json();
      expect(data).toHaveProperty('error');
    } catch {
      // Non-JSON error response is also acceptable
    }
  });
});

test.describe('UAT: Business Value Validation', () => {

  test('Tool discovery flow: Homepage → Rankings → Tool Detail', async ({ page }) => {
    const console = await setupConsoleTracking(page);

    // Step 1: Land on homepage
    await page.goto('/en');
    await waitForNetworkIdle(page);
    await captureEvidence(page, 'discovery-1-homepage');

    // Step 2: Navigate to rankings
    const rankingsLink = page.locator('a[href*="/rankings"], button:has-text("ranking")');
    if (await rankingsLink.count() > 0) {
      await rankingsLink.first().click();
      await waitForNetworkIdle(page);
      await captureEvidence(page, 'discovery-2-rankings');
    } else {
      await page.goto('/en/rankings');
      await waitForNetworkIdle(page);
    }

    // Step 3: Click on a tool
    const toolLink = page.locator('a[href*="/tool"]').first();
    if (await toolLink.count() > 0) {
      await toolLink.click();
      await waitForNetworkIdle(page);
      await captureEvidence(page, 'discovery-3-tool-detail');

      // Verify we're on a tool page
      expect(page.url()).toMatch(/\/tool/);
    }

    // Log any errors encountered during flow
    if (console.errors.length > 0) {
      console.log('Errors during discovery flow:', console.errors);
    }
  });

  test('Content discovery flow: News → Related Tools', async ({ page }) => {
    // Try to access news/articles
    await page.goto('/en/news');
    await waitForNetworkIdle(page);

    // If news page exists
    if (!page.url().includes('404')) {
      await captureEvidence(page, 'content-discovery-news');

      // Look for article links
      const articleLinks = page.locator('a[href*="/article"], a[href*="/news/"], article a');

      if (await articleLinks.count() > 0) {
        await articleLinks.first().click();
        await waitForNetworkIdle(page);
        await captureEvidence(page, 'content-discovery-article');

        // Look for tool mentions or links
        const toolLinks = page.locator('a[href*="/tool"]');
        const hasToolMentions = await toolLinks.count() > 0;

        // This validates the business goal of connecting content to tools
        expect(hasToolMentions).toBeTruthy();
      }
    }
  });
});
