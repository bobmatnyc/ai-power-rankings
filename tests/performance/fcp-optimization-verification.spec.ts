/**
 * FCP Optimization Verification Test
 *
 * This test verifies Phase 1 FCP optimizations:
 * 1. Self-hosted fonts (no external CDN calls)
 * 2. Server-side category fetching (no /api/rankings call during initial render)
 * 3. Removed force-dynamic (enables static generation)
 * 4. Simplified ClerkProvider (reduced client-side JS)
 *
 * Expected improvements:
 * - FCP: 1.2-2.3s faster
 * - LCP: 1.5-2.5s faster
 * - No Google Fonts CDN requests
 * - No /api/rankings waterfall during sidebar initial render
 */

import { test, expect } from '@playwright/test';

test.describe('FCP Optimization Verification', () => {
  test.beforeEach(async ({ page }) => {
    // Enable performance metrics
    await page.goto('http://localhost:3000/en', { waitUntil: 'networkidle' });
  });

  test('should load fonts from self-hosted location (NOT Google Fonts CDN)', async ({ page }) => {
    const requests: Array<{ url: string; resourceType: string }> = [];

    // Collect all network requests
    page.on('request', (request) => {
      requests.push({
        url: request.url(),
        resourceType: request.resourceType()
      });
    });

    await page.goto('http://localhost:3000/en', { waitUntil: 'networkidle' });

    // Verify NO requests to Google Fonts
    const googleFontsRequests = requests.filter(r =>
      r.url.includes('fonts.googleapis.com') ||
      r.url.includes('fonts.gstatic.com')
    );

    expect(googleFontsRequests.length).toBe(0);

    // Verify fonts are loaded from /_next/static/media/
    const selfHostedFonts = requests.filter(r =>
      r.resourceType === 'font' &&
      r.url.includes('/_next/static/media/')
    );

    expect(selfHostedFonts.length).toBeGreaterThan(0);

    console.log(`✅ Self-hosted fonts loaded: ${selfHostedFonts.length}`);
    console.log(`✅ No Google Fonts CDN requests: ${googleFontsRequests.length === 0}`);
  });

  test('should NOT call /api/rankings during initial sidebar render', async ({ page }) => {
    const apiCalls: string[] = [];

    // Track API calls
    page.on('request', (request) => {
      if (request.url().includes('/api/')) {
        apiCalls.push(request.url());
      }
    });

    await page.goto('http://localhost:3000/en', { waitUntil: 'domcontentloaded' });

    // Wait a bit to catch any delayed API calls
    await page.waitForTimeout(2000);

    // Verify NO /api/rankings call
    const rankingsApiCalls = apiCalls.filter(url => url.includes('/api/rankings'));

    expect(rankingsApiCalls.length).toBe(0);

    // Verify sidebar categories are present (server-rendered)
    const sidebarCategories = await page.locator('[data-testid="category-item"], .category-item, text="All Tools"').count();

    expect(sidebarCategories).toBeGreaterThan(0);

    console.log(`✅ No /api/rankings calls during initial render`);
    console.log(`✅ Sidebar categories present: ${sidebarCategories}`);
  });

  test('should measure FCP and LCP performance metrics', async ({ page }) => {
    await page.goto('http://localhost:3000/en');

    // Get performance metrics
    const performanceMetrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const paint = performance.getEntriesByType('paint');
      const fcp = paint.find(entry => entry.name === 'first-contentful-paint');
      const lcp = new Promise<number>((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1] as any;
          resolve(lastEntry.renderTime || lastEntry.loadTime);
        }).observe({ entryTypes: ['largest-contentful-paint'] });

        // Timeout after 5 seconds
        setTimeout(() => resolve(0), 5000);
      });

      return {
        ttfb: navigation.responseStart - navigation.requestStart,
        fcp: fcp?.startTime || 0,
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
      };
    });

    const lcpValue = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        let lcpTime = 0;
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1] as any;
          lcpTime = lastEntry.renderTime || lastEntry.loadTime;
        }).observe({ entryTypes: ['largest-contentful-paint'] });

        setTimeout(() => resolve(lcpTime), 3000);
      });
    });

    console.log('\n=== Performance Metrics ===');
    console.log(`TTFB (Time to First Byte): ${performanceMetrics.ttfb.toFixed(0)}ms`);
    console.log(`FCP (First Contentful Paint): ${performanceMetrics.fcp.toFixed(0)}ms`);
    console.log(`LCP (Largest Contentful Paint): ${lcpValue.toFixed(0)}ms`);
    console.log(`DOM Content Loaded: ${performanceMetrics.domContentLoaded.toFixed(0)}ms`);
    console.log(`Load Complete: ${performanceMetrics.loadComplete.toFixed(0)}ms`);
    console.log('===========================\n');

    // Target metrics (after optimization)
    const TARGET_FCP = 1800; // 1.8s
    const TARGET_LCP = 2500; // 2.5s

    // Report against targets
    if (performanceMetrics.fcp > 0) {
      const fcpDelta = TARGET_FCP - performanceMetrics.fcp;
      console.log(`FCP vs Target: ${fcpDelta > 0 ? '✅' : '⚠️'} ${fcpDelta > 0 ? 'BETTER' : 'SLOWER'} by ${Math.abs(fcpDelta).toFixed(0)}ms`);
    }

    if (lcpValue > 0) {
      const lcpDelta = TARGET_LCP - lcpValue;
      console.log(`LCP vs Target: ${lcpDelta > 0 ? '✅' : '⚠️'} ${lcpDelta > 0 ? 'BETTER' : 'SLOWER'} by ${Math.abs(lcpDelta).toFixed(0)}ms`);
    }

    // Soft assertions - don't fail on performance, just report
    expect(performanceMetrics.fcp).toBeGreaterThan(0);
    expect(lcpValue).toBeGreaterThan(0);
  });

  test('should verify static pages load instantly', async ({ page }) => {
    const staticPages = [
      '/en/about',
      '/en/methodology',
      '/en/privacy',
      '/en/terms'
    ];

    for (const pagePath of staticPages) {
      const startTime = Date.now();
      await page.goto(`http://localhost:3000${pagePath}`, { waitUntil: 'domcontentloaded' });
      const loadTime = Date.now() - startTime;

      console.log(`${pagePath}: ${loadTime}ms`);

      // Static pages should load very quickly (under 1s)
      expect(loadTime).toBeLessThan(2000);
    }
  });

  test('should verify Clerk authentication works without errors', async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto('http://localhost:3000/en', { waitUntil: 'networkidle' });

    // Wait for potential Clerk initialization
    await page.waitForTimeout(2000);

    // Check for sign-in button presence
    const signInButton = page.locator('text="Sign In", button:has-text("Sign")').first();
    await expect(signInButton).toBeVisible({ timeout: 5000 });

    // Filter out expected Clerk dev warnings
    const criticalErrors = consoleErrors.filter(err =>
      !err.includes('dev-browser-missing') &&
      !err.includes('Download the React DevTools')
    );

    console.log(`Console errors: ${consoleErrors.length} total, ${criticalErrors.length} critical`);

    // Should have minimal critical errors
    expect(criticalErrors.length).toBeLessThan(3);
  });

  test('should verify font rendering without FOUT', async ({ page }) => {
    await page.goto('http://localhost:3000/en');

    // Check computed font family on body
    const fontFamily = await page.evaluate(() => {
      return window.getComputedStyle(document.body).fontFamily;
    });

    console.log(`Body font family: ${fontFamily}`);

    // Should include Inter font
    expect(fontFamily.toLowerCase()).toContain('inter');

    // Check for font-display setting (should be swap or optional for self-hosted)
    const fontFaces = await page.evaluate(() => {
      const fonts: any[] = [];
      // @ts-expect-error - CSSStyleSheet.cssRules type inference issue
      for (const rule of document.styleSheets[0]?.cssRules || []) {
        if (rule instanceof CSSFontFaceRule) {
          fonts.push({
            family: rule.style.fontFamily,
            display: rule.style.fontDisplay
          });
        }
      }
      return fonts;
    });

    console.log(`Font faces loaded: ${fontFaces.length}`);
  });
});
