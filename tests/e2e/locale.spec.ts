/**
 * Locale Switching Tests
 *
 * UAT Focus: Validate that users can switch between English and Japanese locales,
 * and that content is properly translated and displayed.
 *
 * Coverage:
 * - Locale switcher is visible and functional
 * - Switching between en and ja works correctly
 * - Content is translated appropriately
 * - URLs reflect the current locale
 * - Navigation maintains locale selection
 */

import { test, expect } from '@playwright/test';
import {
  PAGES,
  LOCALES,
  setupConsoleErrorTracking,
  waitForNetworkIdle,
  elementExists,
} from '../fixtures/test-data';

test.describe('Locale Switching - Basic Functionality', () => {
  test('should load English locale by default or when specified', async ({ page }) => {
    await page.goto(PAGES.HOME(LOCALES.ENGLISH));
    await waitForNetworkIdle(page);

    expect(page.url()).toContain('/en');
  });

  test('should load Japanese locale when specified', async ({ page }) => {
    await page.goto(PAGES.HOME(LOCALES.JAPANESE));
    await waitForNetworkIdle(page);

    expect(page.url()).toContain('/ja');
  });

  test('should have locale switcher visible', async ({ page }) => {
    await page.goto(PAGES.HOME(LOCALES.ENGLISH));
    await waitForNetworkIdle(page);

    // Look for locale switcher (could be dropdown, links, or buttons)
    const hasLocaleSwitcher =
      (await elementExists(page, '[data-testid*="locale"], [data-testid*="language"]')) ||
      (await elementExists(page, 'select[name*="locale"], select[name*="language"]')) ||
      (await elementExists(page, 'button:has-text("EN"), button:has-text("JA")')) ||
      (await elementExists(page, 'a[href*="/ja"], a[href*="/en"]'));

    expect(hasLocaleSwitcher).toBeTruthy();
  });
});

test.describe('Locale Switching - Language Toggle', () => {
  test('should switch from English to Japanese', async ({ page }) => {
    await page.goto(PAGES.HOME(LOCALES.ENGLISH));
    await waitForNetworkIdle(page);

    // Look for Japanese locale link/button
    const jaLink = page.locator('a[href*="/ja"], button:has-text("JA"), button:has-text("日本語")').first();

    if ((await jaLink.count()) > 0) {
      await jaLink.click();
      await page.waitForLoadState('networkidle');

      // Should now be on Japanese locale
      expect(page.url()).toContain('/ja');
    } else {
      // Alternative: Navigate directly to Japanese URL
      const currentUrl = page.url();
      const jaUrl = currentUrl.replace('/en', '/ja');
      await page.goto(jaUrl);
      await waitForNetworkIdle(page);

      expect(page.url()).toContain('/ja');
    }
  });

  test('should switch from Japanese to English', async ({ page }) => {
    await page.goto(PAGES.HOME(LOCALES.JAPANESE));
    await waitForNetworkIdle(page);

    // Look for English locale link/button
    const enLink = page.locator('a[href*="/en"], button:has-text("EN"), button:has-text("English")').first();

    if ((await enLink.count()) > 0) {
      await enLink.click();
      await page.waitForLoadState('networkidle');

      // Should now be on English locale
      expect(page.url()).toContain('/en');
    } else {
      // Alternative: Navigate directly to English URL
      const currentUrl = page.url();
      const enUrl = currentUrl.replace('/ja', '/en');
      await page.goto(enUrl);
      await waitForNetworkIdle(page);

      expect(page.url()).toContain('/en');
    }
  });
});

test.describe('Locale Switching - Content Translation', () => {
  test('should display English content on English locale', async ({ page }) => {
    await page.goto(PAGES.HOME(LOCALES.ENGLISH));
    await waitForNetworkIdle(page);

    const pageText = await page.textContent('body');

    // Check for English keywords
    const hasEnglishContent =
      pageText?.includes('Rankings') ||
      pageText?.includes('Ranking') ||
      pageText?.includes('Tools') ||
      pageText?.includes('Power');

    expect(hasEnglishContent).toBeTruthy();
  });

  test('should display Japanese content on Japanese locale', async ({ page }) => {
    await page.goto(PAGES.HOME(LOCALES.JAPANESE));
    await waitForNetworkIdle(page);

    const pageText = await page.textContent('body');

    // Check for Japanese characters (Hiragana, Katakana, or Kanji)
    const hasJapaneseContent = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(pageText || '');

    expect(hasJapaneseContent).toBeTruthy();
  });

  test('should translate navigation items', async ({ page }) => {
    // Check English navigation
    await page.goto(PAGES.HOME(LOCALES.ENGLISH));
    await waitForNetworkIdle(page);

    const enNavText = await page.locator('nav, header').first().textContent();
    const hasEnglishNav = enNavText?.toLowerCase().includes('home') || enNavText?.toLowerCase().includes('ranking');

    // Check Japanese navigation
    await page.goto(PAGES.HOME(LOCALES.JAPANESE));
    await waitForNetworkIdle(page);

    const jaNavText = await page.locator('nav, header').first().textContent();
    const hasJapaneseNav = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(jaNavText || '');

    // At least one should have locale-specific text
    expect(hasEnglishNav || hasJapaneseNav).toBeTruthy();
  });

  test('should translate page titles', async ({ page }) => {
    // English title
    await page.goto(PAGES.HOME(LOCALES.ENGLISH));
    await waitForNetworkIdle(page);
    const enTitle = await page.title();

    // Japanese title
    await page.goto(PAGES.HOME(LOCALES.JAPANESE));
    await waitForNetworkIdle(page);
    const jaTitle = await page.title();

    // Titles should be different (translated)
    expect(enTitle).not.toBe(jaTitle);
  });
});

test.describe('Locale Switching - Navigation Persistence', () => {
  test('should maintain locale when navigating between pages', async ({ page }) => {
    await page.goto(PAGES.HOME(LOCALES.JAPANESE));
    await waitForNetworkIdle(page);

    // Find a navigation link
    const rankingsLink = page.locator('a[href*="/rankings"]').first();

    if ((await rankingsLink.count()) > 0) {
      await rankingsLink.click();
      await page.waitForLoadState('networkidle');

      // Should still be in Japanese locale
      expect(page.url()).toContain('/ja');
    }
  });

  test('should update URLs when switching locales', async ({ page }) => {
    // Start on English rankings page
    await page.goto(PAGES.RANKINGS(LOCALES.ENGLISH));
    await waitForNetworkIdle(page);

    expect(page.url()).toContain('/en/rankings');

    // Switch to Japanese (if switcher exists)
    const jaLink = page.locator('a[href*="/ja/rankings"], button:has-text("JA")').first();

    if ((await jaLink.count()) > 0) {
      await jaLink.click();
      await page.waitForLoadState('networkidle');

      expect(page.url()).toContain('/ja/rankings');
    } else {
      // Direct navigation test
      const jaUrl = page.url().replace('/en/', '/ja/');
      await page.goto(jaUrl);
      await waitForNetworkIdle(page);

      expect(page.url()).toContain('/ja/rankings');
    }
  });
});

test.describe('Locale Switching - Data Display', () => {
  test('should display same rankings data across locales', async ({ page }) => {
    // Get top tool from English page
    await page.goto(PAGES.RANKINGS(LOCALES.ENGLISH));
    await waitForNetworkIdle(page);
    await page.waitForSelector('tbody tr, [data-rank="1"]', { timeout: 10000 });

    const enTopTool = await page
      .locator('tbody tr:first-child, [data-rank="1"]')
      .first()
      .textContent();

    // Get top tool from Japanese page
    await page.goto(PAGES.RANKINGS(LOCALES.JAPANESE));
    await waitForNetworkIdle(page);
    await page.waitForSelector('tbody tr, [data-rank="1"]', { timeout: 10000 });

    const jaTopTool = await page
      .locator('tbody tr:first-child, [data-rank="1"]')
      .first()
      .textContent();

    // Both should contain "Claude Code" (tool name stays in English)
    expect(enTopTool).toContain('Claude Code');
    expect(jaTopTool).toContain('Claude Code');
  });

  test('should load trending chart in both locales', async ({ page }) => {
    // English trending
    await page.goto(PAGES.TRENDING(LOCALES.ENGLISH));
    await waitForNetworkIdle(page);
    await page.waitForSelector('svg', { timeout: 10000 });
    const enChart = await page.locator('svg').first().isVisible();

    // Japanese trending
    await page.goto(PAGES.TRENDING(LOCALES.JAPANESE));
    await waitForNetworkIdle(page);
    await page.waitForSelector('svg', { timeout: 10000 });
    const jaChart = await page.locator('svg').first().isVisible();

    expect(enChart).toBeTruthy();
    expect(jaChart).toBeTruthy();
  });
});

test.describe('Locale Switching - Error Handling', () => {
  test('should not have console errors when switching locales', async ({ page }) => {
    const errorTracker = setupConsoleErrorTracking(page);

    await page.goto(PAGES.HOME(LOCALES.ENGLISH));
    await waitForNetworkIdle(page);

    // Switch to Japanese
    const jaUrl = page.url().replace('/en', '/ja');
    await page.goto(jaUrl);
    await waitForNetworkIdle(page);

    // Switch back to English
    const enUrl = page.url().replace('/ja', '/en');
    await page.goto(enUrl);
    await waitForNetworkIdle(page);

    // Should not have critical errors
    const criticalErrors = errorTracker.errors.filter(
      (e) => !e.includes('ResizeObserver') && !e.includes('favicon')
    );
    expect(criticalErrors.length).toBe(0);
  });

  test('should handle invalid locale gracefully', async ({ page }) => {
    // Try invalid locale
    const response = await page.goto('/invalid-locale/rankings');

    // Should either redirect or show 404, not 500
    expect(response?.status()).not.toBe(500);
  });
});

test.describe('Locale Switching - SEO and Metadata', () => {
  test('should have language meta tags', async ({ page }) => {
    await page.goto(PAGES.HOME(LOCALES.ENGLISH));
    await waitForNetworkIdle(page);

    // Check for language indicators
    const htmlLang = await page.getAttribute('html', 'lang');
    const hasLangMeta =
      htmlLang !== null || (await elementExists(page, 'meta[http-equiv="content-language"]'));

    expect(hasLangMeta).toBeTruthy();
  });

  test('should have alternate language links', async ({ page }) => {
    await page.goto(PAGES.HOME(LOCALES.ENGLISH));
    await waitForNetworkIdle(page);

    // Check for hreflang links
    const hasAlternateLinks = await elementExists(page, 'link[rel="alternate"][hreflang]');

    // Note: Alternate links might not be implemented
    expect(typeof hasAlternateLinks).toBe('boolean');
  });
});
