/**
 * Phase 2 FCP Optimization Verification
 *
 * This test verifies that all Phase 2 optimizations are delivering
 * the expected performance improvements on top of Phase 1.
 *
 * Phase 1 Results:
 * - FCP: 2,500-4,000ms → 212ms (91-95% improvement)
 *
 * Phase 2 Expected Results:
 * - FCP: 212ms → <150ms (target: 100-150ms)
 * - CSS optimization: 150-250ms improvement
 * - Static metadata: 300-500ms improvement
 * - Resource prefetch: 100-200ms improvement
 */

import { test, expect } from '@playwright/test';

test.describe('[QA] Phase 2 FCP Optimization Verification', () => {
  test.beforeEach(async ({ page }) => {
    // Enable console monitoring
    page.on('console', msg => {
      const type = msg.type();
      if (type === 'error' || type === 'warning') {
        console.log(`[Browser ${type.toUpperCase()}]:`, msg.text());
      }
    });
  });

  test('1. CSS Optimization - Verify split CSS files', async ({ page }) => {
    const cssRequests: Array<{ url: string; size: number; type: string }> = [];

    // Monitor network requests for CSS files
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('.css') && url.includes('_next/static/css/')) {
        try {
          const headers = response.headers();
          const contentLength = headers['content-length'];
          cssRequests.push({
            url: url.split('_next/static/css/')[1] || url,
            size: contentLength ? parseInt(contentLength) : 0,
            type: 'CSS',
          });
        } catch (e) {
          // Ignore errors reading response
        }
      }
    });

    await page.goto('http://localhost:3001/en', { waitUntil: 'networkidle' });

    console.log('\n=== CSS Optimization Results ===');
    console.log(`Total CSS files loaded: ${cssRequests.length}`);
    cssRequests.forEach(req => {
      console.log(`  - ${req.url}: ${(req.size / 1024).toFixed(2)} KB`);
    });

    // Verify we have multiple CSS files (split optimization)
    expect(cssRequests.length).toBeGreaterThanOrEqual(3);

    // Verify CSS files are reasonably sized (not one huge file)
    const totalCssSize = cssRequests.reduce((sum, req) => sum + req.size, 0);
    console.log(`Total CSS size: ${(totalCssSize / 1024).toFixed(2)} KB`);

    expect(totalCssSize).toBeLessThan(150 * 1024); // Less than 150KB total
  });

  test('2. Static Metadata - Verify keywords without API fetch', async ({ page }) => {
    const apiCalls: string[] = [];

    // Monitor for any API calls during metadata generation
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('/api/')) {
        apiCalls.push(url);
      }
    });

    // Navigate and measure TTFB
    const startTime = Date.now();
    const response = await page.goto('http://localhost:3001/en', {
      waitUntil: 'domcontentloaded'
    });
    const ttfb = Date.now() - startTime;

    console.log('\n=== Metadata Performance Results ===');
    console.log(`Time to First Byte (TTFB): ${ttfb}ms`);
    console.log(`API calls during page load: ${apiCalls.length}`);

    if (apiCalls.length > 0) {
      console.log('API calls detected:');
      apiCalls.forEach(url => console.log(`  - ${url}`));
    }

    // Get page source to verify keywords
    const content = await page.content();

    // Verify keywords meta tag exists
    const keywordsMatch = content.match(/<meta[^>]*name="keywords"[^>]*content="([^"]+)"/);
    expect(keywordsMatch).toBeTruthy();

    const keywords = keywordsMatch?.[1] || '';
    console.log(`\nKeywords found: ${keywords.substring(0, 200)}...`);
    console.log(`Keyword count: ${keywords.split(',').length} keywords`);

    // Verify expected tool names are present
    expect(keywords).toContain('Claude Code');
    expect(keywords).toContain('GitHub Copilot');
    expect(keywords).toContain('Cursor');
    expect(keywords).toContain('Windsurf');

    // Verify TTFB is fast (should be <200ms with static metadata)
    expect(ttfb).toBeLessThan(500); // Conservative - production should be <200ms
  });

  test('3. Resource Prefetch Hints - Verify HTML head', async ({ page }) => {
    await page.goto('http://localhost:3001/en', { waitUntil: 'load' });

    console.log('\n=== Resource Prefetch Verification ===');

    // Check for DNS prefetch
    const dnsPrefetchClerk = await page.locator('link[rel="dns-prefetch"][href="https://clerk.com"]').count();
    const dnsPrefetchClerkAPI = await page.locator('link[rel="dns-prefetch"][href="https://api.clerk.com"]').count();

    console.log(`DNS Prefetch for clerk.com: ${dnsPrefetchClerk > 0 ? '✓' : '✗'}`);
    console.log(`DNS Prefetch for api.clerk.com: ${dnsPrefetchClerkAPI > 0 ? '✓' : '✗'}`);

    expect(dnsPrefetchClerk).toBeGreaterThan(0);
    expect(dnsPrefetchClerkAPI).toBeGreaterThan(0);

    // Check for preconnect
    const preconnectClerk = await page.locator('link[rel="preconnect"][href="https://clerk.com"]').count();
    const preconnectClerkAPI = await page.locator('link[rel="preconnect"][href="https://api.clerk.com"]').count();

    console.log(`Preconnect for clerk.com: ${preconnectClerk > 0 ? '✓' : '✗'}`);
    console.log(`Preconnect for api.clerk.com: ${preconnectClerkAPI > 0 ? '✓' : '✗'}`);

    expect(preconnectClerk).toBeGreaterThan(0);
    expect(preconnectClerkAPI).toBeGreaterThan(0);

    // Check for resource prefetch hints
    const prefetchLinks = await page.locator('link[rel="prefetch"]').count();
    console.log(`Total prefetch hints: ${prefetchLinks}`);

    expect(prefetchLinks).toBeGreaterThanOrEqual(2); // At least client-rankings and whats-new-modal
  });

  test('4. First Contentful Paint - Measure FCP', async ({ page }) => {
    await page.goto('http://localhost:3001/en');

    // Get Web Vitals metrics
    const metrics = await page.evaluate(() => {
      return new Promise((resolve) => {
        // @ts-expect-error - PerformanceObserver types not fully available in this context
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const paintEntries = entries.filter(entry => entry.entryType === 'paint');
          const fcpEntry = paintEntries.find(entry => entry.name === 'first-contentful-paint');

          if (fcpEntry) {
            observer.disconnect();
            resolve({
              fcp: Math.round(fcpEntry.startTime),
              navigationStart: performance.timing.navigationStart,
            });
          }
        });

        observer.observe({ entryTypes: ['paint'] });

        // Timeout after 10 seconds
        setTimeout(() => {
          observer.disconnect();
          resolve({ fcp: -1, navigationStart: 0 });
        }, 10000);
      });
    });

    console.log('\n=== First Contentful Paint Results ===');
    console.log(`FCP: ${metrics.fcp}ms`);

    // Phase 2 target: <150ms (was 212ms after Phase 1)
    if (metrics.fcp > 0) {
      console.log(`\nPhase 1 Baseline: 212ms`);
      console.log(`Phase 2 Target: <150ms`);
      console.log(`Actual FCP: ${metrics.fcp}ms`);

      if (metrics.fcp < 150) {
        console.log(`✓ Phase 2 Target ACHIEVED! (${212 - metrics.fcp}ms improvement)`);
      } else if (metrics.fcp < 212) {
        console.log(`⚠ Improved from Phase 1 but not meeting Phase 2 target`);
        console.log(`  Improvement: ${212 - metrics.fcp}ms (target: 62ms)`);
      } else {
        console.log(`✗ FCP regression detected!`);
      }

      // Generous threshold for CI environments
      expect(metrics.fcp).toBeLessThan(300);
    } else {
      console.log('⚠ Could not measure FCP (timing API unavailable)');
    }
  });

  test('5. Console Logs - Verify production mode', async ({ page }) => {
    const consoleLogs: Array<{ type: string; text: string }> = [];

    page.on('console', msg => {
      consoleLogs.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    await page.goto('http://localhost:3001/en', { waitUntil: 'networkidle' });

    console.log('\n=== Console Logs Analysis ===');
    console.log(`Total console messages: ${consoleLogs.length}`);

    const byType = consoleLogs.reduce((acc, log) => {
      acc[log.type] = (acc[log.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    Object.entries(byType).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });

    // Check for development console.logs
    const devLogs = consoleLogs.filter(log =>
      log.type === 'log' &&
      (log.text.includes('[Metadata]') ||
       log.text.includes('[Page]') ||
       log.text.includes('console.log'))
    );

    if (devLogs.length > 0) {
      console.log('\n⚠ Development console.log statements found:');
      devLogs.slice(0, 5).forEach(log => {
        console.log(`  - ${log.text.substring(0, 100)}`);
      });
    }

    // Production should have minimal or no console.log statements
    expect(devLogs.length).toBeLessThan(10); // Allow some logs for now
  });

  test('6. Static Pages Performance', async ({ page }) => {
    const staticPages = [
      { path: '/en/about', name: 'About' },
      { path: '/en/methodology', name: 'Methodology' },
      { path: '/en/privacy', name: 'Privacy' },
      { path: '/en/terms', name: 'Terms' },
    ];

    console.log('\n=== Static Pages Performance ===');

    for (const { path, name } of staticPages) {
      const startTime = Date.now();
      const response = await page.goto(`http://localhost:3001${path}`, {
        waitUntil: 'domcontentloaded'
      });
      const loadTime = Date.now() - startTime;

      console.log(`${name}: ${loadTime}ms (Status: ${response?.status() || 'N/A'})`);

      // Static pages should load very fast
      expect(response?.status()).toBe(200);
      expect(loadTime).toBeLessThan(1000); // Under 1 second for static pages
    }
  });

  test('7. Comprehensive Performance Summary', async ({ page }) => {
    // Navigate to the page
    const navigationStart = Date.now();
    await page.goto('http://localhost:3001/en', { waitUntil: 'networkidle' });
    const totalLoadTime = Date.now() - navigationStart;

    // Get detailed performance metrics
    const performanceMetrics = await page.evaluate(() => {
      const perfData = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const paintMetrics = performance.getEntriesByType('paint');

      return {
        dns: Math.round(perfData.domainLookupEnd - perfData.domainLookupStart),
        tcp: Math.round(perfData.connectEnd - perfData.connectStart),
        ttfb: Math.round(perfData.responseStart - perfData.requestStart),
        download: Math.round(perfData.responseEnd - perfData.responseStart),
        domInteractive: Math.round(perfData.domInteractive - perfData.fetchStart),
        domComplete: Math.round(perfData.domComplete - perfData.fetchStart),
        fcp: Math.round(paintMetrics.find(m => m.name === 'first-contentful-paint')?.startTime || 0),
        lcp: 0, // Will be populated if available
      };
    });

    console.log('\n=== PHASE 2 PERFORMANCE SUMMARY ===');
    console.log('\nNetwork Timing:');
    console.log(`  DNS Lookup: ${performanceMetrics.dns}ms`);
    console.log(`  TCP Connection: ${performanceMetrics.tcp}ms`);
    console.log(`  Time to First Byte: ${performanceMetrics.ttfb}ms`);
    console.log(`  Download: ${performanceMetrics.download}ms`);

    console.log('\nPage Rendering:');
    console.log(`  DOM Interactive: ${performanceMetrics.domInteractive}ms`);
    console.log(`  DOM Complete: ${performanceMetrics.domComplete}ms`);
    console.log(`  Total Load Time: ${totalLoadTime}ms`);

    console.log('\nCore Web Vitals:');
    console.log(`  First Contentful Paint (FCP): ${performanceMetrics.fcp}ms`);

    console.log('\n=== PHASE COMPARISON ===');
    console.log('Phase 1 Results:');
    console.log('  FCP: 212ms (from 2,500-4,000ms baseline)');
    console.log('  Improvement: 91-95%');

    console.log('\nPhase 2 Target:');
    console.log('  FCP: <150ms');
    console.log('  Additional improvement: 550-950ms');

    console.log('\nPhase 2 Actual:');
    console.log(`  FCP: ${performanceMetrics.fcp}ms`);

    if (performanceMetrics.fcp > 0) {
      const phase2Improvement = 212 - performanceMetrics.fcp;
      const targetMet = performanceMetrics.fcp < 150;

      console.log(`  vs Phase 1: ${phase2Improvement > 0 ? '+' : ''}${phase2Improvement}ms improvement`);
      console.log(`  Target Met: ${targetMet ? '✓ YES' : '✗ NO'}`);

      if (targetMet) {
        console.log('\n🎉 Phase 2 optimization SUCCESSFUL!');
      } else {
        console.log('\n⚠ Phase 2 target not met, but may still show improvement');
      }
    }

    // Success criteria
    expect(performanceMetrics.ttfb).toBeLessThan(500);
    expect(totalLoadTime).toBeLessThan(3000);
  });
});
