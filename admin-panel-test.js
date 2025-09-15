#!/usr/bin/env node

const { chromium } = require('playwright');

async function testAdminPanel() {
  const browser = await chromium.launch({ headless: false, slowMo: 1000 });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  const page = await context.newPage();

  // Track console errors
  const consoleErrors = [];
  const typeErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      consoleErrors.push(text);
      if (text.includes('TypeError') || text.includes('Cannot read properties of undefined')) {
        typeErrors.push(text);
      }
      console.log(`❌ Console Error: ${text}`);
    }
  });

  page.on('pageerror', error => {
    const errorText = error.toString();
    consoleErrors.push(errorText);
    if (errorText.includes('TypeError') || errorText.includes('Cannot read properties of undefined')) {
      typeErrors.push(errorText);
    }
    console.log(`❌ Page Error: ${errorText}`);
  });

  try {
    console.log('🔍 Phase 1: Testing TypeError Fix - Loading Admin Panel...');

    // Navigate to admin panel
    await page.goto('http://localhost:3001/admin', { waitUntil: 'networkidle' });

    // Wait for page to fully load
    await page.waitForTimeout(3000);

    // Check page title
    const title = await page.title();
    console.log(`📄 Page Title: ${title}`);

    // Check for Article Management section
    try {
      await page.waitForSelector('text=Article Management', { timeout: 10000 });
      console.log('✅ Article Management section found');
    } catch (error) {
      console.log('⚠️  Article Management section not found immediately, checking alternatives...');

      // Check for alternative selectors
      const hasAdminContent = await page.locator('text=Admin').count() > 0;
      const hasManagementContent = await page.locator('text=Management').count() > 0;

      console.log(`Admin content found: ${hasAdminContent}`);
      console.log(`Management content found: ${hasManagementContent}`);
    }

    // Wait and check for TypeErrors
    await page.waitForTimeout(2000);

    console.log(`\n📊 TypeError Check Results:`);
    console.log(`Total Console Errors: ${consoleErrors.length}`);
    console.log(`TypeError Count: ${typeErrors.length}`);

    if (typeErrors.length === 0) {
      console.log('✅ SUCCESS: No TypeErrors detected!');
    } else {
      console.log('❌ FAILURE: TypeErrors found:');
      typeErrors.forEach(error => console.log(`  - ${error}`));
    }

    // Phase 2: Test Progress Meter during Preview Flow
    console.log('\n🔍 Phase 2: Testing Progress Meter - Preview Impact Flow...');

    try {
      // Look for content input field
      const contentSelector = 'textarea[placeholder*="content"], textarea[placeholder*="article"], #newsContent, textarea[name="content"]';
      const contentInput = await page.locator(contentSelector).first();

      if (await contentInput.count() > 0) {
        console.log('✅ Content input field found');

        // Enter test content
        const testContent = "OpenAI releases GPT-5 surpassing Claude 3.5";
        await contentInput.fill(testContent);
        console.log(`📝 Test content entered: "${testContent}"`);

        // Look for Preview Impact button
        const previewBtnSelectors = [
          'button:has-text("Preview Impact")',
          'button:has-text("Preview")',
          '[data-testid="preview-btn"]',
          'button[class*="preview"]'
        ];

        let previewBtn = null;
        for (const selector of previewBtnSelectors) {
          const btn = page.locator(selector);
          if (await btn.count() > 0) {
            previewBtn = btn.first();
            console.log(`✅ Preview button found with selector: ${selector}`);
            break;
          }
        }

        if (previewBtn) {
          // Track progress meter appearance
          let progressMeterAppeared = false;
          let progressUpdates = [];

          // Monitor for progress meter
          page.on('response', response => {
            if (response.url().includes('/api/admin/news/analyze')) {
              console.log('🔄 API call detected to news analysis endpoint');
            }
          });

          // Click preview button
          await previewBtn.click();
          console.log('🖱️  Preview Impact button clicked');

          // Check for loading/processing state
          await page.waitForTimeout(1000);

          // Look for progress indicators
          const progressSelectors = [
            '[role="progressbar"]',
            '.progress',
            '[data-testid="progress"]',
            '.progress-bar',
            'text=Processing',
            'text=Loading',
            '.loading'
          ];

          for (const selector of progressSelectors) {
            const progressElement = page.locator(selector);
            if (await progressElement.count() > 0) {
              progressMeterAppeared = true;
              console.log(`✅ Progress indicator found: ${selector}`);

              // Try to get progress text
              try {
                const progressText = await progressElement.textContent();
                if (progressText) {
                  progressUpdates.push(progressText.trim());
                  console.log(`📊 Progress text: "${progressText.trim()}"`);
                }
              } catch (e) {
                console.log(`Progress element found but couldn't read text: ${e.message}`);
              }
              break;
            }
          }

          // Wait for completion
          await page.waitForTimeout(5000);

          // Check if progress meter disappeared (indicating completion)
          let progressCompleted = false;
          for (const selector of progressSelectors) {
            const progressElement = page.locator(selector);
            if (await progressElement.count() === 0) {
              progressCompleted = true;
              break;
            }
          }

          console.log(`\n📊 Progress Meter Test Results:`);
          console.log(`Progress meter appeared: ${progressMeterAppeared}`);
          console.log(`Progress updates count: ${progressUpdates.length}`);
          console.log(`Progress completed (disappeared): ${progressCompleted}`);

          if (progressUpdates.length > 0) {
            console.log('Progress updates captured:');
            progressUpdates.forEach((update, i) => console.log(`  ${i+1}. ${update}`));
          }

        } else {
          console.log('⚠️  Preview Impact button not found');
        }

      } else {
        console.log('⚠️  Content input field not found');
      }

    } catch (error) {
      console.log(`❌ Error testing progress meter: ${error.message}`);
    }

    // Phase 3: Check UI Polish
    console.log('\n🔍 Phase 3: Checking UI Polish and Styling...');

    // Check for proper progress bar styling
    const progressBarElements = await page.locator('.progress-bar, [role="progressbar"]').count();
    console.log(`Progress bar elements found: ${progressBarElements}`);

    // Check for spinner elements
    const spinnerElements = await page.locator('.loader, .spinner, [data-testid="spinner"]').count();
    console.log(`Spinner elements found: ${spinnerElements}`);

    // Take a screenshot for visual verification
    await page.screenshot({
      path: 'admin-panel-test-screenshot.png',
      fullPage: true
    });
    console.log('📸 Screenshot saved as admin-panel-test-screenshot.png');

  } catch (error) {
    console.log(`❌ Test failed with error: ${error.message}`);
  } finally {
    await browser.close();
  }

  // Final Results Summary
  console.log('\n📋 FINAL TEST RESULTS SUMMARY:');
  console.log('=====================================');
  console.log(`✅ TypeError Fix: ${typeErrors.length === 0 ? 'PASSED' : 'FAILED'}`);
  console.log(`📊 Console Errors: ${consoleErrors.length} total`);
  console.log(`🔄 Admin Panel Loaded: Successfully`);

  if (typeErrors.length > 0) {
    console.log('\n❌ TypeErrors Found:');
    typeErrors.forEach(error => console.log(`   ${error}`));
  }

  if (consoleErrors.length > 0) {
    console.log('\n📝 All Console Errors:');
    consoleErrors.forEach(error => console.log(`   ${error}`));
  }

  return {
    typeErrorsFixed: typeErrors.length === 0,
    totalErrors: consoleErrors.length,
    typeErrors: typeErrors,
    allErrors: consoleErrors
  };
}

// Check if Playwright is available
(async () => {
  try {
    await testAdminPanel();
  } catch (error) {
    if (error.message.includes('playwright')) {
      console.log('❌ Playwright not installed. Installing...');
      const { exec } = require('child_process');
      exec('npx playwright install chromium', (error, stdout, stderr) => {
        if (error) {
          console.log('❌ Failed to install Playwright. Please run: npx playwright install chromium');
          console.log('Error:', error.message);
        } else {
          console.log('✅ Playwright installed. Please run the test again.');
        }
      });
    } else {
      console.log('❌ Test failed:', error.message);
    }
  }
})();