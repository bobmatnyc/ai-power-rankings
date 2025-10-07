import { test, expect } from '@playwright/test';

test.describe('Article Management UI - Author Default and Tool Count Fixes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3011/en/admin');
    await page.waitForLoadState('networkidle');
  });

  test('Article without author should default to "APR Team"', async ({ page }) => {
    // Click "Add News Article" tab
    await page.click('button:has-text("Add News Article")');

    // Wait for the form to be visible
    await page.waitForSelector('textarea[placeholder*="article text"]', { timeout: 5000 });

    // Enter article text mentioning tools (without author)
    const articleText = 'Cursor and GitHub Copilot lead the market. Claude Code and ChatGPT Canvas compete for developers.';
    await page.fill('textarea[placeholder*="article text"]', articleText);

    // Leave author field empty (verify it's empty)
    const authorInput = page.locator('input[placeholder*="author" i], input[name="author"]').first();
    await authorInput.fill(''); // Ensure it's empty

    // Click "Preview Impact"
    await page.click('button:has-text("Preview Impact")');

    // Wait for analysis to complete
    await page.waitForSelector('text=/predicted changes|impact analysis/i', { timeout: 15000 });

    // Click Save button
    await page.click('button:has-text("Save Article")');

    // Wait for success message
    await page.waitForSelector('text=/success|saved/i', { timeout: 10000 });

    // Go to "Edit / Delete Articles" tab
    await page.click('button:has-text("Edit / Delete Articles")');

    // Wait for articles list to load
    await page.waitForSelector('[data-testid="article-list"], .article-item, article', { timeout: 5000 });

    // Find the newly saved article and verify it shows "By APR Team" (not "By Unknown")
    const articleElement = page.locator('text=' + articleText.substring(0, 30)).first();
    await articleElement.scrollIntoViewIfNeeded();

    // Get the article container
    const articleContainer = articleElement.locator('xpath=ancestor::div[contains(@class, "article") or contains(@class, "card") or @data-testid]').first();

    // Check for "APR Team" author
    const authorText = await articleContainer.locator('text=/by .*/i').first().textContent();
    console.log('Author text found:', authorText);

    expect(authorText?.toLowerCase()).toContain('apr team');
    expect(authorText?.toLowerCase()).not.toContain('unknown');
  });

  test('Tool count should show actual number, not "0 tools"', async ({ page }) => {
    // Click "Edit / Delete Articles" tab to see existing articles
    await page.click('button:has-text("Edit / Delete Articles")');

    // Wait for articles list to load
    await page.waitForSelector('[data-testid="article-list"], .article-item, article', { timeout: 5000 });

    // Find any article with tool mentions
    const toolCountElements = page.locator('text=/\\d+ tools?/i');
    const count = await toolCountElements.count();

    console.log(`Found ${count} articles with tool count displayed`);

    if (count > 0) {
      // Get the first tool count text
      const toolCountText = await toolCountElements.first().textContent();
      console.log('Tool count text:', toolCountText);

      // Verify it's not "0 tools"
      expect(toolCountText).not.toMatch(/^0 tools?$/i);

      // Verify it shows a number
      expect(toolCountText).toMatch(/\d+ tools?/i);

      // Extract the number
      const match = toolCountText?.match(/(\d+) tools?/i);
      if (match) {
        const toolCount = parseInt(match[1]);
        console.log('Tool count number:', toolCount);
        expect(toolCount).toBeGreaterThan(0);
      }
    }
  });

  test('Article with author provided should show custom author', async ({ page }) => {
    // Click "Add News Article" tab
    await page.click('button:has-text("Add News Article")');

    // Wait for the form to be visible
    await page.waitForSelector('textarea[placeholder*="article text"]', { timeout: 5000 });

    // Enter article text mentioning tools
    const articleText = 'OpenAI releases new GPT model with improved capabilities for code generation.';
    await page.fill('textarea[placeholder*="article text"]', articleText);

    // Fill in custom author
    const authorInput = page.locator('input[placeholder*="author" i], input[name="author"]').first();
    await authorInput.fill('John Doe');

    // Click "Preview Impact"
    await page.click('button:has-text("Preview Impact")');

    // Wait for analysis to complete
    await page.waitForSelector('text=/predicted changes|impact analysis/i', { timeout: 15000 });

    // Click Save button
    await page.click('button:has-text("Save Article")');

    // Wait for success message
    await page.waitForSelector('text=/success|saved/i', { timeout: 10000 });

    // Go to "Edit / Delete Articles" tab
    await page.click('button:has-text("Edit / Delete Articles")');

    // Wait for articles list to load
    await page.waitForSelector('[data-testid="article-list"], .article-item, article', { timeout: 5000 });

    // Find the newly saved article and verify it shows "By John Doe"
    const articleElement = page.locator('text=' + articleText.substring(0, 30)).first();
    await articleElement.scrollIntoViewIfNeeded();

    // Get the article container
    const articleContainer = articleElement.locator('xpath=ancestor::div[contains(@class, "article") or contains(@class, "card") or @data-testid]').first();

    // Check for "John Doe" author
    const authorText = await articleContainer.locator('text=/by .*/i').first().textContent();
    console.log('Author text found:', authorText);

    expect(authorText?.toLowerCase()).toContain('john doe');
    expect(authorText?.toLowerCase()).not.toContain('apr team');
  });

  test('API endpoint returns proper toolMentions arrays', async ({ request }) => {
    // Test the API endpoint
    const response = await request.get('http://localhost:3011/api/admin/articles');

    expect(response.ok()).toBeTruthy();

    const articles = await response.json();
    console.log(`Found ${articles.length} articles from API`);

    // Check that articles have toolMentions arrays
    const articlesWithTools = articles.filter((article: any) =>
      article.toolMentions && Array.isArray(article.toolMentions) && article.toolMentions.length > 0
    );

    console.log(`Articles with tool mentions: ${articlesWithTools.length}`);

    if (articlesWithTools.length > 0) {
      const firstArticle = articlesWithTools[0];
      console.log('First article with tools:', {
        id: firstArticle.id,
        toolMentionsCount: firstArticle.toolMentions.length,
        toolIds: firstArticle.toolMentions.map((t: any) => t.toolId || t.id)
      });

      // Verify tool mentions have IDs
      expect(firstArticle.toolMentions[0]).toHaveProperty('toolId');
      expect(firstArticle.toolMentions[0].toolId).toBeTruthy();
    }
  });
});
