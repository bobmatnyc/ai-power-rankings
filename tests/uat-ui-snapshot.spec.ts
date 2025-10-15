import { test, expect } from '@playwright/test';

/**
 * UAT UI Snapshot Test
 * Takes screenshots and verifies basic UI functionality
 */

test.describe('UAT: UI Snapshot and Verification', () => {
  test('Homepage snapshot', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');

    await page.screenshot({
      path: '/Users/masa/Projects/aipowerranking/tests/screenshots/uat-homepage.png',
      fullPage: true
    });

    console.log('✓ Homepage screenshot captured');
  });

  test('Rankings page snapshot and verification', async ({ page }) => {
    await page.goto('http://localhost:3000/en/rankings');
    await page.waitForLoadState('networkidle');

    // Wait for rankings to load
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: '/Users/masa/Projects/aipowerranking/tests/screenshots/uat-rankings-full.png',
      fullPage: true
    });

    // Get page text content
    const textContent = await page.textContent('body');

    // Check for any of the expected tools
    const toolsToCheck = [
      'OpenAI Codex',
      'Greptile',
      'Google Gemini CLI',
      'Graphite',
      'Qwen Code',
      'GitLab Duo',
      'Anything Max'
    ];

    console.log('\nChecking for expected tools on rankings page:');
    for (const tool of toolsToCheck) {
      const found = textContent?.includes(tool) || false;
      console.log(`${found ? '✓' : '✗'} ${tool}: ${found ? 'FOUND' : 'NOT FOUND'}`);
    }

    // Check for tools that ARE present
    const currentTools = [
      'Claude Code',
      'GitHub Copilot',
      'Cursor',
      'ChatGPT Canvas',
      'v0'
    ];

    console.log('\nChecking for current tools on rankings page:');
    for (const tool of currentTools) {
      const found = textContent?.includes(tool) || false;
      console.log(`${found ? '✓' : '✗'} ${tool}: ${found ? 'FOUND' : 'NOT FOUND'}`);
    }

    // Count score displays (should not be "—")
    const dashCount = (textContent?.match(/—/g) || []).length;
    console.log(`\nFound ${dashCount} dash symbols ("—") on page`);

    console.log('✓ Rankings page screenshot captured');
  });

  test('Individual tool page check - Claude Code', async ({ page }) => {
    // Try to navigate to a tool detail page
    const urls = [
      'http://localhost:3000/en/tools/claude-code',
      'http://localhost:3000/en/rankings/claude-code',
      'http://localhost:3000/en/tools/2e335264-6f3f-4604-901b-f36e438ab9ae'
    ];

    let success = false;
    for (const url of urls) {
      try {
        const response = await page.goto(url);
        if (response && response.status() === 200) {
          await page.waitForLoadState('networkidle');

          await page.screenshot({
            path: '/Users/masa/Projects/aipowerranking/tests/screenshots/uat-tool-detail.png',
            fullPage: true
          });

          const content = await page.textContent('body');
          console.log(`✓ Successfully loaded tool page at: ${url}`);
          console.log(`Page contains "Claude Code": ${content?.includes('Claude Code')}`);

          success = true;
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (!success) {
      console.log('⚠ Could not find a working tool detail page URL');
    }
  });
});
