import { test, expect, ConsoleMessage } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Sign In For Updates Button Diagnosis', () => {
  test('Capture all console logs and test button functionality', async ({ page }) => {
    const consoleMessages: Array<{
      type: string;
      text: string;
      timestamp: string;
    }> = [];

    // Capture ALL console messages
    page.on('console', (msg: ConsoleMessage) => {
      const timestamp = new Date().toISOString();
      const messageData = {
        type: msg.type(),
        text: msg.text(),
        timestamp,
      };
      consoleMessages.push(messageData);

      // Real-time logging for immediate visibility
      console.log(`[${timestamp}] [${msg.type().toUpperCase()}] ${msg.text()}`);
    });

    // Capture page errors
    page.on('pageerror', (error) => {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [PAGE ERROR] ${error.message}`);
      consoleMessages.push({
        type: 'pageerror',
        text: error.message,
        timestamp,
      });
    });

    // Step 1: Navigate to localhost:3000
    console.log('\n=== STEP 1: Navigating to http://localhost:3000 ===\n');
    await page.goto('http://localhost:3000', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Step 2: Wait for page to fully load and hydrate
    console.log('\n=== STEP 2: Waiting for page hydration ===\n');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForLoadState('networkidle');

    // Wait a bit more for React hydration
    await page.waitForTimeout(3000);

    // Step 3: Take screenshot before interaction
    console.log('\n=== STEP 3: Taking screenshot BEFORE clicking ===\n');
    const screenshotsDir = path.join(process.cwd(), 'test-results', 'signin-diagnosis');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
    await page.screenshot({
      path: path.join(screenshotsDir, '01-before-click.png'),
      fullPage: true
    });

    // Step 4: Check for ClerkProvider-specific console messages
    console.log('\n=== STEP 4: Analyzing ClerkProvider messages ===\n');
    const clerkMessages = consoleMessages.filter(msg =>
      msg.text.toLowerCase().includes('clerk') ||
      msg.text.toLowerCase().includes('provider') ||
      msg.text.toLowerCase().includes('auth')
    );

    console.log('ClerkProvider-related messages:');
    clerkMessages.forEach(msg => {
      console.log(`  [${msg.type}] ${msg.text}`);
    });

    // Step 5: Find the "Sign In For Updates" button
    console.log('\n=== STEP 5: Looking for "Sign In For Updates" button ===\n');

    // Try multiple selectors to find the button
    const possibleSelectors = [
      'button:has-text("Sign In For Updates")',
      'button:has-text("Sign In")',
      'button:has-text("Updates")',
      '[data-testid*="signin"]',
      '[data-testid*="update"]',
      'header button',
      'nav button',
    ];

    let signInButton = null;
    let usedSelector = '';

    for (const selector of possibleSelectors) {
      try {
        const button = page.locator(selector).first();
        const count = await button.count();
        if (count > 0) {
          const isVisible = await button.isVisible();
          if (isVisible) {
            signInButton = button;
            usedSelector = selector;
            console.log(`✅ Found button with selector: ${selector}`);
            break;
          }
        }
      } catch (e) {
        // Continue to next selector
      }
    }

    if (!signInButton) {
      console.log('❌ Could not find Sign In button with any selector');

      // Take screenshot of page
      await page.screenshot({
        path: path.join(screenshotsDir, '02-button-not-found.png'),
        fullPage: true
      });

      // Log all buttons on page
      const allButtons = await page.locator('button').all();
      console.log(`\nFound ${allButtons.length} buttons on page:`);
      for (let i = 0; i < allButtons.length; i++) {
        const text = await allButtons[i].textContent();
        const isVisible = await allButtons[i].isVisible();
        console.log(`  Button ${i + 1}: "${text}" (visible: ${isVisible})`);
      }
    } else {
      // Get button details
      const buttonText = await signInButton.textContent();
      const buttonHTML = await signInButton.innerHTML();
      console.log(`Button text: "${buttonText}"`);
      console.log(`Button HTML: ${buttonHTML}`);

      // Step 6: Click the button
      console.log('\n=== STEP 6: Clicking the button ===\n');

      // Clear previous messages from this point
      const clickTimestamp = new Date().toISOString();
      console.log(`Click timestamp: ${clickTimestamp}`);

      await signInButton.click();

      // Step 7: Wait for any modal or response
      console.log('\n=== STEP 7: Waiting for modal or response ===\n');
      await page.waitForTimeout(2000);

      // Step 8: Take screenshot after click
      console.log('\n=== STEP 8: Taking screenshot AFTER clicking ===\n');
      await page.screenshot({
        path: path.join(screenshotsDir, '03-after-click.png'),
        fullPage: true
      });

      // Step 9: Check for Clerk modal
      console.log('\n=== STEP 9: Checking for Clerk modal ===\n');
      const modalSelectors = [
        '[role="dialog"]',
        '.cl-modalContent',
        '.cl-card',
        '[data-clerk-modal]',
        'dialog',
        '[aria-modal="true"]',
      ];

      let modalFound = false;
      for (const selector of modalSelectors) {
        const modal = page.locator(selector);
        const count = await modal.count();
        if (count > 0) {
          const isVisible = await modal.isVisible();
          if (isVisible) {
            console.log(`✅ Modal found with selector: ${selector}`);
            modalFound = true;

            // Take screenshot of modal
            await page.screenshot({
              path: path.join(screenshotsDir, '04-modal-found.png'),
              fullPage: true
            });
            break;
          }
        }
      }

      if (!modalFound) {
        console.log('❌ No Clerk modal found');
      }
    }

    // Step 10: Analyze console messages after click
    console.log('\n=== STEP 10: Console messages after click ===\n');
    const postClickMessages = consoleMessages.filter(msg =>
      new Date(msg.timestamp) > new Date(Date.now() - 3000)
    );

    console.log(`Found ${postClickMessages.length} messages in last 3 seconds:`);
    postClickMessages.forEach(msg => {
      console.log(`  [${msg.type}] ${msg.text}`);
    });

    // Final analysis
    console.log('\n=== FINAL ANALYSIS ===\n');

    // Check for specific ClerkProvider messages
    const disabledAuthMsg = consoleMessages.find(msg =>
      msg.text.includes('Disabled via NEXT_PUBLIC_DISABLE_AUTH')
    );
    const disabledDomainMsg = consoleMessages.find(msg =>
      msg.text.includes('Disabled for non-allowed domain')
    );
    const noKeyMsg = consoleMessages.find(msg =>
      msg.text.includes('No publishable key found')
    );
    const providerAvailMsg = consoleMessages.find(msg =>
      msg.text.includes('Provider availability')
    );

    console.log('ClerkProvider Status:');
    console.log(`  - Disabled via NEXT_PUBLIC_DISABLE_AUTH: ${disabledAuthMsg ? '❌ YES' : '✅ NO'}`);
    console.log(`  - Disabled for non-allowed domain: ${disabledDomainMsg ? '❌ YES' : '✅ NO'}`);
    console.log(`  - No publishable key: ${noKeyMsg ? '❌ YES' : '✅ NO'}`);
    console.log(`  - Provider availability message: ${providerAvailMsg ? providerAvailMsg.text : 'Not found'}`);

    // Error messages
    const errorMessages = consoleMessages.filter(msg =>
      msg.type === 'error' || msg.type === 'pageerror'
    );
    console.log(`\nErrors found: ${errorMessages.length}`);
    errorMessages.forEach(msg => {
      console.log(`  [ERROR] ${msg.text}`);
    });

    // Save all console logs to file
    const logPath = path.join(screenshotsDir, 'console-logs.json');
    fs.writeFileSync(logPath, JSON.stringify(consoleMessages, null, 2));
    console.log(`\n📝 All console logs saved to: ${logPath}`);

    console.log(`\n📸 Screenshots saved to: ${screenshotsDir}`);
  });
});
