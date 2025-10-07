import { test, expect } from '@playwright/test';

test.describe('Verify Author Default and Tool Count Fixes', () => {
  test('should display APR Team author and correct tool count', async ({ page }) => {
    // Navigate to admin page
    await page.goto('http://localhost:3011/en/admin');
    await page.waitForLoadState('networkidle');

    // Click on "Edit / Delete Articles" tab
    await page.click('button:has-text("Edit / Delete Articles")');

    // Wait for articles to load
    await page.waitForTimeout(2000);

    // Take screenshot for verification
    await page.screenshot({ path: '/tmp/admin-articles-list.png', fullPage: true });

    // Find the most recent article (should be our test article)
    const firstArticle = page.locator('div').filter({ hasText: /AI Coding Market Competition|Cursor and GitHub Copilot/ }).first();

    // Check if it exists
    const exists = await firstArticle.count() > 0;
    console.log('Article found:', exists);

    if (exists) {
      // Get the article card/container
      const articleCard = firstArticle.locator('xpath=ancestor::div[contains(@class, "Card") or @class][1]');

      // Check for "APR Team" author badge
      const authorBadge = articleCard.locator('text=/By APR Team/i');
      const authorExists = await authorBadge.count() > 0;
      console.log('APR Team author badge found:', authorExists);

      // Check for tool count badge
      const toolBadge = articleCard.locator('text=/4 tools?/i');
      const toolCountExists = await toolBadge.count() > 0;
      console.log('4 tools badge found:', toolCountExists);

      // Get all text content for debugging
      const articleText = await articleCard.textContent();
      console.log('Article card content:', articleText);

      expect(authorExists || articleText?.includes('APR Team')).toBeTruthy();
      expect(toolCountExists || articleText?.includes('4 tool')).toBeTruthy();
    }
  });
});
