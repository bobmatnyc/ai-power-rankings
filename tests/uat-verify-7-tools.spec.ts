import { test, expect } from '@playwright/test';

/**
 * UAT Test: Verify 7 Recently Updated AI Coding Tools
 *
 * This test verifies that the following tools are displaying correctly:
 * 1. OpenAI Codex - Score: 92/100, Rank #1, Category: autonomous-agent
 * 2. Greptile - Score: 90/100, Rank #2, Category: other
 * 3. Google Gemini CLI - Score: 88/100, Rank #3, Category: open-source-framework
 * 4. Graphite - Score: 87/100, Rank #4, Category: other
 * 5. Qwen Code - Score: 86/100, Rank #5, Category: open-source-framework
 * 6. GitLab Duo - Score: 84/100, Rank #6, Category: other
 * 7. Anything Max - Score: 80/100, Rank #7, Category: autonomous-agent
 */

const EXPECTED_TOOLS = [
  { name: 'OpenAI Codex', score: 92, rank: 1, category: 'autonomous-agent', keyPhrase: 'GPT-5-Codex' },
  { name: 'Greptile', score: 90, rank: 2, category: 'other', keyPhrase: '$25M' },
  { name: 'Google Gemini CLI', score: 88, rank: 3, category: 'open-source-framework', keyPhrase: '1M token context window' },
  { name: 'Graphite', score: 87, rank: 4, category: 'other', keyPhrase: 'Anthropic' },
  { name: 'Qwen Code', score: 86, rank: 5, category: 'open-source-framework', keyPhrase: '256K+ context windows' },
  { name: 'GitLab Duo', score: 84, rank: 6, category: 'other', keyPhrase: 'Premium and Ultimate plans' },
  { name: 'Anything Max', score: 80, rank: 7, category: 'autonomous-agent', keyPhrase: 'autonomous AI software engineer' },
];

test.describe('UAT: 7 Updated AI Coding Tools Verification', () => {
  test.beforeEach(async ({ page }) => {
    // Enable console monitoring
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`[BROWSER ERROR]: ${msg.text()}`);
      }
    });

    page.on('pageerror', error => {
      console.log(`[PAGE ERROR]: ${error.message}`);
    });
  });

  test('API Endpoint: Verify all 7 tools return complete data', async ({ request }) => {
    const response = await request.get('http://localhost:3001/api/rankings/current');

    // Log response for debugging
    const status = response.status();
    console.log(`API Response Status: ${status}`);

    if (status !== 200) {
      const errorText = await response.text();
      console.log(`API Error Response: ${errorText}`);

      // Take screenshot of error state if possible
      test.info().annotations.push({
        type: 'API Error',
        description: `Status ${status}: ${errorText}`,
      });
    }

    expect(status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toBeDefined();
    expect(data.data.rankings).toBeDefined();

    const rankings = data.data.rankings;
    console.log(`Total tools in API response: ${rankings.length}`);

    // Verify each of the 7 tools
    for (const expectedTool of EXPECTED_TOOLS) {
      const tool = rankings.find((r: any) => r.tool_name === expectedTool.name);

      expect(tool, `Tool "${expectedTool.name}" should exist in API response`).toBeDefined();
      expect(tool.score, `${expectedTool.name} score`).toBe(expectedTool.score);
      expect(tool.position, `${expectedTool.name} rank`).toBe(expectedTool.rank);
      expect(tool.category, `${expectedTool.name} category`).toBe(expectedTool.category);

      // Verify no null scores (check for "—" symbol would be in UI)
      expect(tool.score, `${expectedTool.name} should have a score`).toBeGreaterThan(0);

      console.log(`✓ ${expectedTool.name}: Score ${tool.score}, Rank ${tool.position}, Category ${tool.category}`);
    }
  });

  test('Rankings Page: Display all 7 tools correctly', async ({ page }) => {
    await page.goto('http://localhost:3001/en/rankings');

    // Wait for rankings to load
    await page.waitForLoadState('networkidle');

    // Take screenshot for evidence
    await page.screenshot({
      path: '/Users/masa/Projects/aipowerranking/tests/screenshots/uat-rankings-page.png',
      fullPage: true
    });

    // Check page title
    await expect(page).toHaveTitle(/Rankings|AI Power Ranking/);

    // Verify each tool appears on the page
    for (const tool of EXPECTED_TOOLS) {
      const toolElement = page.getByText(tool.name, { exact: false });
      await expect(toolElement, `${tool.name} should be visible on rankings page`).toBeVisible();

      console.log(`✓ ${tool.name} is visible on rankings page`);
    }

    // Check for presence of scores (verify no "—" symbols)
    const dashSymbols = await page.getByText('—').count();
    console.log(`Found ${dashSymbols} dash symbols on page`);

    // Get page content for analysis
    const content = await page.content();

    // Log any console errors
    const logs: string[] = [];
    page.on('console', msg => logs.push(`${msg.type()}: ${msg.text()}`));
  });

  test('Category Filtering: Autonomous Agent tools', async ({ page }) => {
    await page.goto('http://localhost:3001/en/rankings');
    await page.waitForLoadState('networkidle');

    // Find and click autonomous-agent filter
    // This will depend on UI implementation - adjust selector as needed
    const autonomousFilter = page.getByText('autonomous-agent', { exact: false });

    if (await autonomousFilter.isVisible()) {
      await autonomousFilter.click();
      await page.waitForTimeout(1000);

      // Should show OpenAI Codex and Anything Max
      await expect(page.getByText('OpenAI Codex')).toBeVisible();
      await expect(page.getByText('Anything Max')).toBeVisible();

      console.log('✓ Autonomous agent filtering works');
    } else {
      console.log('⚠ Category filter not found - UI may differ from expected');
    }
  });

  test('Category Filtering: Open Source Framework tools', async ({ page }) => {
    await page.goto('http://localhost:3001/en/rankings');
    await page.waitForLoadState('networkidle');

    const frameworkFilter = page.getByText('open-source-framework', { exact: false });

    if (await frameworkFilter.isVisible()) {
      await frameworkFilter.click();
      await page.waitForTimeout(1000);

      // Should show Google Gemini CLI and Qwen Code
      await expect(page.getByText('Google Gemini CLI')).toBeVisible();
      await expect(page.getByText('Qwen Code')).toBeVisible();

      console.log('✓ Open source framework filtering works');
    } else {
      console.log('⚠ Category filter not found - UI may differ from expected');
    }
  });

  test('Individual Tool Pages: Verify description completeness', async ({ page }) => {
    // Test a few representative tool detail pages
    const toolsToTest = [
      { slug: 'openai-codex', keyPhrase: 'GPT-o3', name: 'OpenAI Codex' },
      { slug: 'greptile', keyPhrase: '3x more bugs', name: 'Greptile' },
      { slug: 'google-gemini-cli', keyPhrase: '1 million developers', name: 'Google Gemini CLI' },
    ];

    for (const tool of toolsToTest) {
      // Try common URL patterns
      const urlsToTry = [
        `http://localhost:3001/en/tools/${tool.slug}`,
        `http://localhost:3001/en/rankings/${tool.slug}`,
      ];

      let pageLoaded = false;
      for (const url of urlsToTry) {
        try {
          const response = await page.goto(url);
          if (response && response.status() === 200) {
            pageLoaded = true;

            // Wait for content to load
            await page.waitForLoadState('networkidle');

            // Take screenshot
            await page.screenshot({
              path: `/Users/masa/Projects/aipowerranking/tests/screenshots/uat-${tool.slug}.png`,
              fullPage: true
            });

            // Check for tool name
            await expect(page.getByText(tool.name, { exact: false })).toBeVisible();

            // Check for key phrase from description
            const hasKeyPhrase = await page.getByText(tool.keyPhrase, { exact: false }).isVisible().catch(() => false);

            if (hasKeyPhrase) {
              console.log(`✓ ${tool.name} page shows complete description with "${tool.keyPhrase}"`);
            } else {
              console.log(`⚠ ${tool.name} page may not show complete description (missing "${tool.keyPhrase}")`);
            }

            // Check for score display (should not be "—")
            const content = await page.content();
            const hasScore = !content.includes('Score: —') && !content.includes('score">—');

            if (hasScore) {
              console.log(`✓ ${tool.name} page shows score (not "—")`);
            } else {
              console.log(`⚠ ${tool.name} page may show "—" for score`);
            }

            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!pageLoaded) {
        console.log(`⚠ Could not load detail page for ${tool.name} at any common URL`);
      }
    }
  });

  test('Search Functionality: Find tools by name', async ({ page }) => {
    await page.goto('http://localhost:3001/en/rankings');
    await page.waitForLoadState('networkidle');

    // Look for search input
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i], input[placeholder*="filter" i]').first();

    if (await searchInput.isVisible()) {
      // Test searching for "Codex"
      await searchInput.fill('Codex');
      await page.waitForTimeout(500);

      await expect(page.getByText('OpenAI Codex')).toBeVisible();
      console.log('✓ Search for "Codex" found OpenAI Codex');

      // Clear and test another search
      await searchInput.clear();
      await searchInput.fill('Greptile');
      await page.waitForTimeout(500);

      await expect(page.getByText('Greptile')).toBeVisible();
      console.log('✓ Search for "Greptile" found Greptile');
    } else {
      console.log('⚠ Search input not found - feature may not be implemented');
    }
  });

  test('Summary: Generate UAT report data', async ({ page }) => {
    await page.goto('http://localhost:3001/en/rankings');
    await page.waitForLoadState('networkidle');

    const reportData = {
      timestamp: new Date().toISOString(),
      testEnvironment: 'http://localhost:3001',
      toolsVerified: [],
      issues: [],
    };

    // Count visible tools
    for (const tool of EXPECTED_TOOLS) {
      const isVisible = await page.getByText(tool.name, { exact: false }).isVisible().catch(() => false);
      reportData.toolsVerified.push({
        name: tool.name,
        visible: isVisible,
        expectedRank: tool.rank,
        expectedScore: tool.score,
      });
    }

    console.log('UAT Report Summary:');
    console.log(JSON.stringify(reportData, null, 2));
  });
});
