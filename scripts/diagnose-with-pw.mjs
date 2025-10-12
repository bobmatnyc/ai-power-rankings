import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function diagnoseSignInButton() {
  console.log('\n🚀 Starting Sign In Button Diagnosis with Playwright\n');

  const screenshotsDir = path.join(__dirname, '..', 'test-results', 'signin-diagnosis');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const consoleMessages = [];

  console.log('Launching browser...');
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled']
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 }
    });

    const page = await context.newPage();

    // Capture console messages
    page.on('console', msg => {
      const timestamp = new Date().toISOString();
      const data = {
        type: msg.type(),
        text: msg.text(),
        timestamp
      };
      consoleMessages.push(data);
      console.log(`[${timestamp}] [${msg.type().toUpperCase()}] ${msg.text()}`);
    });

    // Capture page errors
    page.on('pageerror', error => {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [PAGE ERROR] ${error.message}`);
      consoleMessages.push({
        type: 'pageerror',
        text: error.message,
        timestamp
      });
    });

    // Step 1: Navigate
    console.log('\n=== STEP 1: Navigating to http://localhost:3000 ===\n');
    await page.goto('http://localhost:3000', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Step 2: Wait for hydration
    console.log('\n=== STEP 2: Waiting for page hydration ===\n');
    await page.waitForTimeout(3000);

    // Step 3: Screenshot before
    console.log('\n=== STEP 3: Taking screenshot BEFORE clicking ===\n');
    await page.screenshot({
      path: path.join(screenshotsDir, '01-before-click.png'),
      fullPage: true
    });

    // Step 4: Analyze ClerkProvider messages
    console.log('\n=== STEP 4: Analyzing ClerkProvider messages ===\n');
    const clerkMessages = consoleMessages.filter(msg =>
      msg.text.toLowerCase().includes('clerk') ||
      msg.text.toLowerCase().includes('provider') ||
      msg.text.toLowerCase().includes('auth')
    );

    console.log('ClerkProvider-related messages:');
    if (clerkMessages.length === 0) {
      console.log('  ⚠️  No ClerkProvider messages found');
    } else {
      clerkMessages.forEach(msg => {
        console.log(`  [${msg.type}] ${msg.text}`);
      });
    }

    // Check window.__clerkProviderAvailable
    const clerkProviderAvailable = await page.evaluate(() => {
      return {
        __clerkProviderAvailable: window.__clerkProviderAvailable,
        hasClerk: !!window.Clerk,
        clerkUser: window.Clerk?.user,
        hostname: window.location.hostname
      };
    });

    console.log('\nWindow state:');
    console.log(`  __clerkProviderAvailable: ${clerkProviderAvailable.__clerkProviderAvailable}`);
    console.log(`  Clerk instance exists: ${clerkProviderAvailable.hasClerk}`);
    console.log(`  Clerk user: ${clerkProviderAvailable.clerkUser ? 'Signed in' : 'Not signed in'}`);
    console.log(`  Hostname: ${clerkProviderAvailable.hostname}`);

    // Step 5: Find button
    console.log('\n=== STEP 5: Looking for "Sign In For Updates" button ===\n');

    // Get all buttons first
    const allButtons = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.map((btn, idx) => ({
        index: idx,
        text: btn.textContent?.trim() || '',
        visible: btn.offsetParent !== null,
        html: btn.outerHTML
      }));
    });

    console.log(`Found ${allButtons.length} buttons on page:`);
    allButtons.forEach(btn => {
      console.log(`  Button ${btn.index + 1}: "${btn.text}" (visible: ${btn.visible})`);
    });

    // Find the Sign In button
    const signInButtonIndex = allButtons.findIndex(btn =>
      btn.text.toLowerCase().includes('sign') &&
      btn.text.toLowerCase().includes('update')
    );

    if (signInButtonIndex === -1) {
      console.log('\n❌ Could not find "Sign In For Updates" button');
      await page.screenshot({
        path: path.join(screenshotsDir, '02-button-not-found.png'),
        fullPage: true
      });

      // Save logs and exit
      const logPath = path.join(screenshotsDir, 'console-logs.json');
      fs.writeFileSync(logPath, JSON.stringify(consoleMessages, null, 2));
      console.log(`\n📝 Console logs saved to: ${logPath}`);

      await page.waitForTimeout(5000);
      return;
    }

    const buttonInfo = allButtons[signInButtonIndex];
    console.log(`\n✅ Found button: "${buttonInfo.text}"`);
    console.log(`Button HTML: ${buttonInfo.html}`);

    // Step 6: Click button
    console.log('\n=== STEP 6: Clicking the button ===\n');
    const clickTime = Date.now();

    // Click using the button selector
    await page.locator('button').nth(signInButtonIndex).click();

    // Step 7: Wait for modal
    console.log('\n=== STEP 7: Waiting for modal or response ===\n');
    await page.waitForTimeout(2000);

    // Step 8: Screenshot after
    console.log('\n=== STEP 8: Taking screenshot AFTER clicking ===\n');
    await page.screenshot({
      path: path.join(screenshotsDir, '03-after-click.png'),
      fullPage: true
    });

    // Step 9: Check for modal
    console.log('\n=== STEP 9: Checking for Clerk modal ===\n');

    const modalInfo = await page.evaluate(() => {
      const selectors = [
        '[role="dialog"]',
        '.cl-modalContent',
        '.cl-card',
        '[data-clerk-modal]',
        'dialog',
        '[aria-modal="true"]'
      ];

      for (const selector of selectors) {
        const modal = document.querySelector(selector);
        if (modal && modal.offsetParent !== null) {
          return {
            found: true,
            selector,
            html: modal.outerHTML.substring(0, 500)
          };
        }
      }

      return { found: false };
    });

    if (modalInfo.found) {
      console.log(`✅ Modal found with selector: ${modalInfo.selector}`);
      console.log(`Modal HTML preview: ${modalInfo.html}...`);
      await page.screenshot({
        path: path.join(screenshotsDir, '04-modal-found.png'),
        fullPage: true
      });
    } else {
      console.log('❌ No Clerk modal found');

      // Get current Clerk state
      const clerkState = await page.evaluate(() => {
        const clerk = window.Clerk;
        return {
          exists: !!clerk,
          user: clerk?.user,
          session: clerk?.session,
          loaded: clerk?.loaded
        };
      });

      console.log('Clerk state:', JSON.stringify(clerkState, null, 2));
    }

    // Step 10: Post-click messages
    console.log('\n=== STEP 10: Console messages after click ===\n');
    const postClickMessages = consoleMessages.filter(msg =>
      new Date(msg.timestamp).getTime() > clickTime
    );

    console.log(`Found ${postClickMessages.length} messages after click:`);
    postClickMessages.forEach(msg => {
      console.log(`  [${msg.type}] ${msg.text}`);
    });

    // Final analysis
    console.log('\n=== FINAL ANALYSIS ===\n');

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
    console.log(`  - Provider availability: ${providerAvailMsg ? providerAvailMsg.text : 'Not found'}`);

    // Error messages
    const errorMessages = consoleMessages.filter(msg =>
      msg.type === 'error' || msg.type === 'pageerror'
    );
    console.log(`\nErrors found: ${errorMessages.length}`);
    errorMessages.forEach(msg => {
      console.log(`  [ERROR] ${msg.text}`);
    });

    // Save logs
    const logPath = path.join(screenshotsDir, 'console-logs.json');
    fs.writeFileSync(logPath, JSON.stringify(consoleMessages, null, 2));
    console.log(`\n📝 All console logs saved to: ${logPath}`);
    console.log(`📸 Screenshots saved to: ${screenshotsDir}`);

    console.log('\n✅ Diagnosis complete! Keeping browser open for 10 seconds...');
    await page.waitForTimeout(10000);

  } catch (error) {
    console.error('\n❌ Error during diagnosis:', error);
  } finally {
    await browser.close();
  }
}

diagnoseSignInButton().catch(console.error);
