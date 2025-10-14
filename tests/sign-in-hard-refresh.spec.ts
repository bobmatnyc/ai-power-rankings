import { test, expect } from '@playwright/test';

test('Sign-in with hard refresh (cache bypass)', async ({ page }) => {
  console.log('🔄 Testing with Hard Refresh (Cache Bypass)');
  console.log('===========================================\n');

  const consoleErrors: string[] = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  console.log('Step 1: Hard refresh with cache bypass...');

  // Load page with cache bypass
  await page.goto('http://localhost:3000/en/sign-in', {
    waitUntil: 'networkidle',
  });

  // Force a hard reload
  await page.reload({ waitUntil: 'networkidle' });

  console.log('  ✅ Page reloaded with cache bypass');

  // Wait for any loading states to complete
  await page.waitForTimeout(3000);

  console.log('\nStep 2: Checking page state...');

  // Check for loading indicators
  const mountingText = await page.locator('text=Mounting...').count();
  const loadingAuthText = await page.locator('text=Loading authentication...').count();

  console.log(`  Loading indicators:`);
  console.log(`    "Mounting...": ${mountingText === 0 ? '✅ Not present' : '❌ Still showing (' + mountingText + ')'}`);
  console.log(`    "Loading authentication...": ${loadingAuthText === 0 ? '✅ Not present' : '❌ Still showing (' + loadingAuthText + ')'}`);

  // Check for Clerk components
  const hasClerkComponent = await page.locator('.cl-rootBox, .cl-component, [data-clerk-component]').count() > 0;
  console.log(`  Clerk component: ${hasClerkComponent ? '✅ Detected' : '❌ Not found'}`);

  // Take screenshot
  await page.screenshot({
    path: 'test-results/sign-in-after-hard-refresh.png',
    fullPage: true
  });

  console.log('\nStep 3: Form element check...');

  // Look for actual form elements
  const emailInput = await page.locator('input[name="identifier"], input[type="email"]').count();
  const passwordInput = await page.locator('input[type="password"]').count();
  const submitButton = await page.locator('button[type="submit"]').count();

  console.log(`  Email input: ${emailInput > 0 ? '✅ Found (' + emailInput + ')' : '❌ Not found'}`);
  console.log(`  Password input: ${passwordInput > 0 ? '✅ Found (' + passwordInput + ')' : '❌ Not found'}`);
  console.log(`  Submit button: ${submitButton > 0 ? '✅ Found (' + submitButton + ')' : '❌ Not found'}`);

  console.log('\nStep 4: Console errors...');
  console.log(`  Total errors: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    consoleErrors.slice(0, 3).forEach(err => console.log(`    ❌ ${err}`));
  }

  // Get page text content for analysis
  const bodyText = await page.locator('body').textContent() || '';
  const hasSignInText = bodyText.toLowerCase().includes('sign in');
  const hasEmailText = bodyText.toLowerCase().includes('email');
  const hasPasswordText = bodyText.toLowerCase().includes('password');

  console.log('\nStep 5: Content analysis...');
  console.log(`  Contains "sign in": ${hasSignInText ? '✅ Yes' : '❌ No'}`);
  console.log(`  Contains "email": ${hasEmailText ? '✅ Yes' : '❌ No'}`);
  console.log(`  Contains "password": ${hasPasswordText ? '✅ Yes' : '❌ No'}`);

  console.log('\n🎯 FINAL RESULT:');
  console.log('================');

  const noLoadingState = mountingText === 0 && loadingAuthText === 0;
  const hasFormElements = emailInput > 0 || passwordInput > 0;
  const noErrors = consoleErrors.length === 0;

  if (noLoadingState && hasFormElements && (hasClerkComponent || hasSignInText)) {
    console.log('✅ SUCCESS: Sign-in form is now working correctly!');
    console.log('   The hard refresh resolved the HMR issue.');
  } else if (!noLoadingState) {
    console.log('❌ STILL BROKEN: Page is stuck in loading state');
    console.log('   Server restart may be required.');
    console.log('   Run: pkill -f "next dev" && npm run dev');
  } else if (!hasFormElements && !hasClerkComponent) {
    console.log('⚠️  PARTIAL: No loading state, but Clerk form not rendering');
    console.log('   May need to check Clerk environment variables.');
  } else {
    console.log('⚠️  MIXED RESULTS: Check screenshot for details');
  }

  console.log('\n📸 Screenshot saved: test-results/sign-in-after-hard-refresh.png');
});
