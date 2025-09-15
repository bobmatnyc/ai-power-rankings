#!/usr/bin/env node

const { chromium } = require('playwright');

async function testProgressMeter() {
  const browser = await chromium.launch({ headless: false, slowMo: 1500 });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  const page = await context.newPage();

  // Track console messages
  const consoleMessages = [];
  page.on('console', msg => {
    consoleMessages.push(`${msg.type()}: ${msg.text()}`);
    console.log(`🟦 Console ${msg.type()}: ${msg.text()}`);
  });

  try {
    console.log('🚀 Starting Progress Meter Test...');

    // Navigate to admin panel
    await page.goto('http://localhost:3001/admin', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    console.log('📄 Page loaded, looking for input elements...');

    // Select the "Enter - Type or Paste Content" radio button
    const enterRadio = page.locator('input[type="radio"][value="text"], input[type="radio"]:near(:text("Enter"))').first();
    if (await enterRadio.count() > 0) {
      await enterRadio.click();
      console.log('✅ Selected "Enter - Type or Paste Content" option');
      await page.waitForTimeout(1000);
    }

    // Look for the article content input field
    const contentInput = await page.locator('input[placeholder*="example.com"], textarea, input[name="content"]').first();

    if (await contentInput.count() > 0) {
      console.log('✅ Found article content input field');

      // Clear and enter test content
      await contentInput.clear();
      const testContent = "OpenAI releases GPT-5 surpassing Claude 3.5 in performance metrics";
      await contentInput.fill(testContent);
      console.log(`📝 Entered test content: "${testContent}"`);

      await page.waitForTimeout(1000);

      // Find and click the Preview Impact button
      const previewBtn = page.locator('button:has-text("Preview Impact")').first();

      if (await previewBtn.count() > 0) {
        console.log('✅ Found Preview Impact button');

        // Set up progress monitoring
        let progressSteps = [];
        let buttonStates = [];

        // Monitor button text changes
        const monitorButton = async () => {
          try {
            const btnText = await previewBtn.textContent();
            const isDisabled = await previewBtn.isDisabled();
            buttonStates.push({ text: btnText, disabled: isDisabled, time: Date.now() });
            console.log(`🔘 Button state: "${btnText}" (disabled: ${isDisabled})`);
          } catch (e) {
            // Button might be changing, ignore errors
          }
        };

        // Monitor for progress indicators
        const monitorProgress = async () => {
          try {
            // Look for progress bars
            const progressBars = await page.locator('[role="progressbar"], .progress-bar, .progress').count();

            // Look for progress text
            const progressTexts = await page.locator('text=/\\d+%/, text=/Processing/, text=/Analyzing/, text=/Saving/, text=/Complete/').allTextContents();

            // Look for spinners
            const spinners = await page.locator('.spinner, .loading, [data-testid="spinner"]').count();

            if (progressBars > 0 || progressTexts.length > 0 || spinners > 0) {
              progressSteps.push({
                time: Date.now(),
                progressBars,
                progressTexts,
                spinners
              });
              console.log(`📊 Progress detected: bars=${progressBars}, texts=[${progressTexts.join(', ')}], spinners=${spinners}`);
            }
          } catch (e) {
            // Ignore monitoring errors
          }
        };

        // Start monitoring
        console.log('🔄 Starting progress monitoring...');
        const monitoringInterval = setInterval(() => {
          monitorButton();
          monitorProgress();
        }, 250);

        // Click the Preview Impact button
        console.log('🖱️  Clicking Preview Impact button...');
        await previewBtn.click();

        // Wait for the operation to complete
        await page.waitForTimeout(8000);

        // Stop monitoring
        clearInterval(monitoringInterval);

        // Final state check
        await monitorButton();
        await monitorProgress();

        console.log('\n📊 PROGRESS METER TEST RESULTS:');
        console.log('=====================================');
        console.log(`Button state changes: ${buttonStates.length}`);
        console.log(`Progress steps detected: ${progressSteps.length}`);

        if (buttonStates.length > 1) {
          console.log('\n🔘 Button State Changes:');
          buttonStates.forEach((state, i) => {
            console.log(`  ${i+1}. "${state.text}" (disabled: ${state.disabled})`);
          });
        }

        if (progressSteps.length > 0) {
          console.log('\n📈 Progress Steps Detected:');
          progressSteps.forEach((step, i) => {
            console.log(`  ${i+1}. Bars: ${step.progressBars}, Texts: [${step.progressTexts.join(', ')}], Spinners: ${step.spinners}`);
          });
        } else {
          console.log('\n⚠️  No progress indicators detected');
        }

        // Check for error messages
        const errorMessages = await page.locator('text=/error/i, text=/failed/i, .error, .alert-error').allTextContents();
        if (errorMessages.length > 0) {
          console.log('\n❌ Error messages found:');
          errorMessages.forEach(msg => console.log(`  - ${msg}`));
        }

        // Take a screenshot of the final state
        await page.screenshot({
          path: 'progress-meter-test-final.png',
          fullPage: true
        });
        console.log('📸 Final state screenshot saved');

        // Test Save Article flow if available
        console.log('\n🔍 Testing Save Article Flow...');

        const saveBtn = page.locator('button:has-text("Save Article"), button:has-text("Save")').first();
        if (await saveBtn.count() > 0) {
          console.log('✅ Found Save Article button');

          // Reset monitoring
          buttonStates = [];
          progressSteps = [];

          const saveMonitoringInterval = setInterval(() => {
            monitorButton = async () => {
              try {
                const btnText = await saveBtn.textContent();
                const isDisabled = await saveBtn.isDisabled();
                buttonStates.push({ text: btnText, disabled: isDisabled, time: Date.now() });
                console.log(`💾 Save button: "${btnText}" (disabled: ${isDisabled})`);
              } catch (e) {}
            };
            monitorButton();
            monitorProgress();
          }, 250);

          await saveBtn.click();
          console.log('🖱️  Clicked Save Article button');

          await page.waitForTimeout(5000);
          clearInterval(saveMonitoringInterval);

          console.log('\n💾 SAVE ARTICLE FLOW RESULTS:');
          console.log(`Button state changes: ${buttonStates.length}`);
          console.log(`Progress steps during save: ${progressSteps.length}`);
        } else {
          console.log('⚠️  Save Article button not found');
        }

      } else {
        console.log('❌ Preview Impact button not found');
      }

    } else {
      console.log('❌ Article content input field not found');
    }

  } catch (error) {
    console.log(`❌ Test failed: ${error.message}`);
  } finally {
    await browser.close();
  }
}

testProgressMeter().catch(console.error);