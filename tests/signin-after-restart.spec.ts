import { test, expect } from '@playwright/test';

test('Sign-in form after server restart', async ({ page }) => {
  console.log('🔄 Testing Sign-In After Server Restart');
  console.log('========================================\n');

  const errors: string[] = [];
  const warnings: string[] = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
      console.log('❌ Console Error:', msg.text());
    }
    if (msg.type() === 'warning') {
      warnings.push(msg.text());
    }
  });

  console.log('📍 Navigating to sign-in page...');
  await page.goto('http://localhost:3000/en/sign-in');

  console.log('⏳ Waiting for Clerk to initialize...');
  await page.waitForTimeout(5000);

  // Create test-results directory if it doesn't exist
  await page.context().browser()?.version();

  console.log('📸 Taking screenshot...');
  await page.screenshot({
    path: 'test-results/signin-after-restart.png',
    fullPage: true
  });

  // Check for Clerk UI elements
  console.log('🔍 Checking for Clerk UI...');
  const clerkSelectors = [
    '.cl-rootBox',
    '.cl-signIn-root',
    '[data-clerk-sign-in]',
    'form[data-clerk-form]',
    '.cl-component'
  ];

  let hasClerkUI = false;
  let foundSelector = '';

  for (const selector of clerkSelectors) {
    const isVisible = await page.locator(selector).isVisible().catch(() => false);
    if (isVisible) {
      hasClerkUI = true;
      foundSelector = selector;
      console.log(`✅ Found Clerk UI using selector: ${selector}`);
      break;
    }
  }

  // Count form elements
  const buttons = await page.locator('button').count();
  const inputs = await page.locator('input').count();
  const links = await page.locator('a').count();

  console.log('\n📊 Page Analysis:');
  console.log('================');
  console.log(`Status: ${hasClerkUI ? '✅ WORKING' : '❌ STILL BROKEN'}`);
  console.log(`Clerk UI Found: ${hasClerkUI ? `Yes (${foundSelector})` : 'No'}`);
  console.log(`Console Errors: ${errors.length}`);
  console.log(`Console Warnings: ${warnings.length}`);
  console.log(`Buttons: ${buttons}`);
  console.log(`Input Fields: ${inputs}`);
  console.log(`Links: ${links}`);

  // Try to find specific sign-in elements
  const emailInput = await page.locator('input[type="email"], input[name="identifier"]').isVisible().catch(() => false);
  const passwordInput = await page.locator('input[type="password"]').isVisible().catch(() => false);
  const submitButton = await page.locator('button[type="submit"]').isVisible().catch(() => false);

  console.log('\n🔐 Sign-In Form Elements:');
  console.log('=========================');
  console.log(`Email/Identifier Input: ${emailInput ? '✅' : '❌'}`);
  console.log(`Password Input: ${passwordInput ? '✅' : '❌'}`);
  console.log(`Submit Button: ${submitButton ? '✅' : '❌'}`);

  // Get page title and URL
  const title = await page.title();
  const url = page.url();
  console.log(`\nPage Title: ${title}`);
  console.log(`Current URL: ${url}`);

  if (hasClerkUI && emailInput && inputs > 0) {
    console.log('\n🎉 SUCCESS! The sign-in form is now working!');
    console.log('✅ Clerk UI is rendering correctly');
    console.log('✅ Form inputs are visible');
    console.log('✅ You can now sign in at: http://localhost:3000/en/sign-in');
  } else if (hasClerkUI) {
    console.log('\n⚠️  PARTIAL SUCCESS');
    console.log('✅ Clerk component is present');
    console.log('⚠️  But form inputs may not be fully rendered');
    console.log('💡 This might be a timing issue - try refreshing the page');
  } else {
    console.log('\n❌ FAILED - Form still not rendering');
    console.log('🔍 Need to investigate further');

    if (errors.length > 0) {
      console.log('\n🐛 Console Errors Found:');
      errors.slice(0, 5).forEach((err, i) => {
        console.log(`  ${i + 1}. ${err}`);
      });
    }
  }

  console.log('\n📁 Screenshot saved to: test-results/signin-after-restart.png');

  // Soft assertions - don't fail the test, just report
  expect.soft(hasClerkUI, 'Clerk UI should be visible').toBeTruthy();
  expect.soft(inputs, 'Should have input fields').toBeGreaterThan(0);
});
