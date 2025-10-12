const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function diagnoseSignInButton() {
  console.log('🚀 Starting Sign In Button Diagnosis\n');

  const screenshotsDir = path.join(__dirname, '..', 'test-results', 'signin-diagnosis');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const consoleMessages = [];

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: { width: 1280, height: 720 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();

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
      waitUntil: 'networkidle2',
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

    // Step 5: Find button
    console.log('\n=== STEP 5: Looking for "Sign In For Updates" button ===\n');

    const buttonSelectors = [
      'button::-p-text(Sign In For Updates)',
      'button::-p-text(Sign In)',
      'button::-p-text(Updates)',
      'header button',
      'nav button',
    ];

    let signInButton = null;
    let usedSelector = '';

    for (const selector of buttonSelectors) {
      try {
        const elements = await page.$$(selector);
        if (elements.length > 0) {
          // Check if visible
          const isVisible = await elements[0].evaluate(el => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          });

          if (isVisible) {
            signInButton = elements[0];
            usedSelector = selector;
            console.log(`✅ Found button with selector: ${selector}`);
            break;
          }
        }
      } catch (e) {
        // Continue
      }
    }

    if (!signInButton) {
      console.log('⚠️  Could not find button with specific selectors, trying all buttons...');

      // Get all buttons
      const allButtons = await page.$$('button');
      console.log(`\nFound ${allButtons.length} buttons on page:`);

      for (let i = 0; i < allButtons.length; i++) {
        const text = await allButtons[i].evaluate(el => el.textContent);
        const isVisible = await allButtons[i].evaluate(el => {
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        });
        console.log(`  Button ${i + 1}: "${text?.trim()}" (visible: ${isVisible})`);

        // Look for button containing "Sign" or "Update"
        if (text && (text.includes('Sign') || text.includes('Update')) && isVisible) {
          signInButton = allButtons[i];
          usedSelector = `button containing "${text.trim()}"`;
          console.log(`  ✅ Using this button!`);
          break;
        }
      }

      await page.screenshot({
        path: path.join(screenshotsDir, '02-button-search.png'),
        fullPage: true
      });
    }

    if (!signInButton) {
      console.log('\n❌ Could not find Sign In button anywhere on page');
      throw new Error('Button not found');
    }

    // Get button details
    const buttonText = await signInButton.evaluate(el => el.textContent);
    const buttonHTML = await signInButton.evaluate(el => el.outerHTML);
    console.log(`\nButton text: "${buttonText?.trim()}"`);
    console.log(`Button HTML: ${buttonHTML}`);

    // Step 6: Click button
    console.log('\n=== STEP 6: Clicking the button ===\n');
    const clickTime = Date.now();
    await signInButton.click();

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
      try {
        const modal = await page.$(selector);
        if (modal) {
          const isVisible = await modal.evaluate(el => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          });

          if (isVisible) {
            console.log(`✅ Modal found with selector: ${selector}`);
            modalFound = true;
            await page.screenshot({
              path: path.join(screenshotsDir, '04-modal-found.png'),
              fullPage: true
            });
            break;
          }
        }
      } catch (e) {
        // Continue
      }
    }

    if (!modalFound) {
      console.log('❌ No Clerk modal found');
    }

    // Step 10: Post-click messages
    console.log('\n=== STEP 10: Console messages after click ===\n');
    const postClickMessages = consoleMessages.filter(msg =>
      new Date(msg.timestamp) > new Date(clickTime)
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

diagnoseSignInButton();
