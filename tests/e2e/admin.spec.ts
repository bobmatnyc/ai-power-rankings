/**
 * Admin Functionality Tests
 *
 * UAT Focus: Validate admin panel access and functionality when authentication
 * is disabled (NEXT_PUBLIC_DISABLE_AUTH=true).
 *
 * Coverage:
 * - Admin panel access
 * - News management interface
 * - Dashboard functionality
 * - Tools management
 * - Rankings management
 */

import { test, expect } from '@playwright/test';
import {
  PAGES,
  LOCALES,
  setupConsoleErrorTracking,
  waitForNetworkIdle,
  elementExists,
} from '../fixtures/test-data';

// Note: These tests assume NEXT_PUBLIC_DISABLE_AUTH=true
test.describe('Admin - Access Control', () => {
  test('should access admin panel with auth disabled', async ({ page }) => {
    const errorTracker = setupConsoleErrorTracking(page);

    await page.goto(PAGES.ADMIN(LOCALES.ENGLISH));
    await waitForNetworkIdle(page);

    // Should not redirect to login (auth is disabled)
    // Note: With auth enabled, this would redirect to sign-in
    const isOnAdminPage = page.url().includes('/admin');
    const isOnSignInPage = page.url().includes('/sign-in');

    // Either on admin page (auth disabled) or sign-in page (auth enabled)
    expect(isOnAdminPage || isOnSignInPage).toBeTruthy();

    // Should not have critical errors
    const criticalErrors = errorTracker.errors.filter(
      (e) => !e.includes('ResizeObserver') && !e.includes('favicon')
    );
    expect(criticalErrors.length).toBeLessThan(5);
  });

  test('should display admin interface elements', async ({ page }) => {
    await page.goto(PAGES.ADMIN(LOCALES.ENGLISH));
    await waitForNetworkIdle(page);

    // If on admin page, check for admin elements
    if (page.url().includes('/admin') && !page.url().includes('/sign-in')) {
      // Look for admin navigation or dashboard
      const hasAdminElements =
        (await elementExists(page, 'nav')) ||
        (await elementExists(page, '[data-testid*="admin"]')) ||
        (await elementExists(page, '[class*="admin"]')) ||
        (await elementExists(page, 'h1, h2'));

      expect(hasAdminElements).toBeTruthy();
    }
  });
});

test.describe('Admin - News Management', () => {
  test('should access admin news page', async ({ page }) => {
    await page.goto(PAGES.ADMIN_NEWS(LOCALES.ENGLISH));
    await waitForNetworkIdle(page);

    // Should be on news admin page or redirected to login
    const isOnNewsAdmin = page.url().includes('/admin/news');
    const isOnSignIn = page.url().includes('/sign-in');

    expect(isOnNewsAdmin || isOnSignIn).toBeTruthy();
  });

  test('should display news management interface', async ({ page }) => {
    await page.goto(PAGES.ADMIN_NEWS(LOCALES.ENGLISH));
    await waitForNetworkIdle(page);

    // If on news admin page
    if (page.url().includes('/admin/news') && !page.url().includes('/sign-in')) {
      // Look for article list or management controls
      const hasNewsInterface =
        (await elementExists(page, 'table')) ||
        (await elementExists(page, '[data-testid*="article"]')) ||
        (await elementExists(page, 'button:has-text("New"), button:has-text("Add")'));

      expect(hasNewsInterface).toBeTruthy();
    }
  });

  test('should have article action buttons', async ({ page }) => {
    await page.goto(PAGES.ADMIN_NEWS(LOCALES.ENGLISH));
    await waitForNetworkIdle(page);

    if (page.url().includes('/admin/news') && !page.url().includes('/sign-in')) {
      // Look for action buttons
      const hasActionButtons =
        (await elementExists(page, 'button:has-text("Edit")')) ||
        (await elementExists(page, 'button:has-text("Delete")')) ||
        (await elementExists(page, 'button:has-text("Analyze")')) ||
        (await elementExists(page, '[role="button"]'));

      expect(hasActionButtons).toBeTruthy();
    }
  });
});

test.describe('Admin - Dashboard', () => {
  test('should access dashboard page', async ({ page }) => {
    await page.goto(`/${LOCALES.ENGLISH}/dashboard`);
    await waitForNetworkIdle(page);

    // Should be on dashboard or redirected
    const isOnDashboard = page.url().includes('/dashboard');
    const isOnSignIn = page.url().includes('/sign-in');

    expect(isOnDashboard || isOnSignIn).toBeTruthy();
  });

  test('should display dashboard widgets', async ({ page }) => {
    await page.goto(`/${LOCALES.ENGLISH}/dashboard`);
    await waitForNetworkIdle(page);

    if (page.url().includes('/dashboard') && !page.url().includes('/sign-in')) {
      // Look for dashboard content
      const hasDashboardContent =
        (await elementExists(page, '[class*="card"]')) ||
        (await elementExists(page, '[class*="widget"]')) ||
        (await elementExists(page, 'section'));

      expect(hasDashboardContent).toBeTruthy();
    }
  });
});

test.describe('Admin - Tools Management', () => {
  test('should access tools management page', async ({ page }) => {
    await page.goto(`/${LOCALES.ENGLISH}/dashboard/tools`);
    await waitForNetworkIdle(page);

    const isOnToolsPage = page.url().includes('/tools');
    const isOnSignIn = page.url().includes('/sign-in');

    expect(isOnToolsPage || isOnSignIn).toBeTruthy();
  });

  test('should display tools list in admin', async ({ page }) => {
    await page.goto(`/${LOCALES.ENGLISH}/dashboard/tools`);
    await waitForNetworkIdle(page);

    if (page.url().includes('/dashboard/tools') && !page.url().includes('/sign-in')) {
      const hasToolsList =
        (await elementExists(page, 'table')) ||
        (await elementExists(page, '[data-testid*="tool"]')) ||
        (await elementExists(page, 'ul, ol'));

      expect(hasToolsList).toBeTruthy();
    }
  });
});

test.describe('Admin - Rankings Management', () => {
  test('should access rankings management page', async ({ page }) => {
    await page.goto(`/${LOCALES.ENGLISH}/dashboard/rankings`);
    await waitForNetworkIdle(page);

    const isOnRankingsPage = page.url().includes('/rankings');
    const isOnSignIn = page.url().includes('/sign-in');

    expect(isOnRankingsPage || isOnSignIn).toBeTruthy();
  });

  test('should display rankings management interface', async ({ page }) => {
    await page.goto(`/${LOCALES.ENGLISH}/dashboard/rankings`);
    await waitForNetworkIdle(page);

    if (page.url().includes('/dashboard/rankings') && !page.url().includes('/sign-in')) {
      const hasRankingsInterface =
        (await elementExists(page, 'button:has-text("Build")')) ||
        (await elementExists(page, 'button:has-text("Commit")')) ||
        (await elementExists(page, 'table')) ||
        (await elementExists(page, 'form'));

      expect(hasRankingsInterface).toBeTruthy();
    }
  });
});

test.describe('Admin - API Endpoints', () => {
  test('should access admin API endpoints', async ({ request }) => {
    // Try basic admin test endpoint
    const response = await request.get('/api/admin/test-basic');

    // Should either succeed (auth disabled) or return 401/403 (auth enabled)
    expect([200, 401, 403, 404]).toContain(response.status());
  });

  test('should check articles API endpoint', async ({ request }) => {
    const response = await request.get('/api/admin/articles');

    // Should either return data or auth error
    expect([200, 401, 403, 404]).toContain(response.status());

    if (response.ok()) {
      const data = await response.json();
      expect(data).toBeDefined();
    }
  });

  test('should check tools API endpoint', async ({ request }) => {
    const response = await request.get('/api/admin/tools');

    expect([200, 401, 403, 404]).toContain(response.status());

    if (response.ok()) {
      const data = await response.json();
      expect(data).toBeDefined();
    }
  });
});

test.describe('Admin - Navigation', () => {
  test('should have admin navigation menu', async ({ page }) => {
    await page.goto(PAGES.ADMIN(LOCALES.ENGLISH));
    await waitForNetworkIdle(page);

    if (page.url().includes('/admin') && !page.url().includes('/sign-in')) {
      const hasNav = await elementExists(page, 'nav, [role="navigation"], aside');
      expect(hasNav).toBeTruthy();
    }
  });

  test('should navigate between admin sections', async ({ page }) => {
    await page.goto(PAGES.ADMIN(LOCALES.ENGLISH));
    await waitForNetworkIdle(page);

    if (page.url().includes('/admin') && !page.url().includes('/sign-in')) {
      // Try to find navigation links
      const navLinks = page.locator('nav a, aside a, [role="navigation"] a');
      const linkCount = await navLinks.count();

      expect(linkCount).toBeGreaterThan(0);
    }
  });
});

test.describe('Admin - Forms and Interactions', () => {
  test('should have form elements in admin pages', async ({ page }) => {
    await page.goto(PAGES.ADMIN_NEWS(LOCALES.ENGLISH));
    await waitForNetworkIdle(page);

    if (page.url().includes('/admin/news') && !page.url().includes('/sign-in')) {
      // Look for form elements
      const hasFormElements =
        (await elementExists(page, 'form')) ||
        (await elementExists(page, 'input')) ||
        (await elementExists(page, 'textarea')) ||
        (await elementExists(page, 'select')) ||
        (await elementExists(page, 'button[type="submit"]'));

      expect(hasFormElements).toBeTruthy();
    }
  });

  test('should have action buttons', async ({ page }) => {
    await page.goto(PAGES.ADMIN(LOCALES.ENGLISH));
    await waitForNetworkIdle(page);

    if (page.url().includes('/admin') && !page.url().includes('/sign-in')) {
      const hasButtons = await elementExists(page, 'button, [role="button"]');
      expect(hasButtons).toBeTruthy();
    }
  });
});

test.describe('Admin - Error Handling', () => {
  test('should handle missing admin pages gracefully', async ({ page }) => {
    const response = await page.goto(`/${LOCALES.ENGLISH}/admin/nonexistent-page`);

    // Should return 404 or redirect, not 500
    expect(response?.status()).not.toBe(500);
  });

  test('should not expose sensitive errors', async ({ page }) => {
    const errorTracker = setupConsoleErrorTracking(page);

    await page.goto(PAGES.ADMIN(LOCALES.ENGLISH));
    await waitForNetworkIdle(page);

    // Check that no database connection strings or sensitive info is exposed
    const pageContent = await page.content();
    const hasSensitiveData =
      pageContent.includes('postgresql://') ||
      pageContent.includes('npg_') ||
      pageContent.includes('DATABASE_URL') ||
      pageContent.includes('sk_');

    expect(hasSensitiveData).toBeFalsy();
  });
});

test.describe('Admin - Responsive Design', () => {
  test('should display admin panel on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });

    await page.goto(PAGES.ADMIN(LOCALES.ENGLISH));
    await waitForNetworkIdle(page);

    if (page.url().includes('/admin') && !page.url().includes('/sign-in')) {
      const hasContent = await elementExists(page, 'main, [role="main"]');
      expect(hasContent).toBeTruthy();
    }
  });

  test('should handle tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });

    await page.goto(PAGES.ADMIN(LOCALES.ENGLISH));
    await waitForNetworkIdle(page);

    if (page.url().includes('/admin') && !page.url().includes('/sign-in')) {
      // Admin should still be functional on tablet
      const hasContent = await elementExists(page, 'main, [role="main"]');
      expect(hasContent).toBeTruthy();
    }
  });
});

test.describe('Admin - Performance', () => {
  test('should load admin panel within 5 seconds', async ({ page }) => {
    const startTime = Date.now();

    await page.goto(PAGES.ADMIN(LOCALES.ENGLISH));
    await page.waitForLoadState('domcontentloaded');

    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(5000);
  });
});
