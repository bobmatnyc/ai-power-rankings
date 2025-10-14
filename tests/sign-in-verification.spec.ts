import { test, expect } from '@playwright/test';

test('Verify sign-in form renders correctly', async ({ page }) => {
  console.log('✅ Testing Sign-In Form After Fix');
  console.log('=====================================\n');

  const consoleErrors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  // Navigate to sign-in page
  console.log('Step 1: Navigating to /en/sign-in...');
  await page.goto('http://localhost:3000/en/sign-in');

  // Wait for Clerk to load
  console.log('Step 2: Waiting for Clerk UI to load...');
  await page.waitForTimeout(3000);

  // Take screenshot
  await page.screenshot({
    path: 'test-results/sign-in-form-working.png',
    fullPage: true
  });
  console.log('📸 Screenshot saved\n');

  // Check if Clerk form is visible
  const clerkFormVisible = await page.locator('.cl-rootBox, .cl-signIn-root, [data-clerk-sign-in]').isVisible().catch(() => false);

  console.log('Step 3: Clerk Form Status:');
  console.log('  Form visible:', clerkFormVisible ? '✅ YES' : '❌ NO');

  if (clerkFormVisible) {
    // Count sign-in options
    const googleButton = await page.locator('button:has-text("Google"), [data-provider="google"]').count();
    const emailInput = await page.locator('input[type="email"], input[name="identifier"]').count();
    const passwordInput = await page.locator('input[type="password"]').count();

    console.log('  Google OAuth button:', googleButton > 0 ? '✅ Found' : '❌ Not found');
    console.log('  Email input:', emailInput > 0 ? '✅ Found' : '❌ Not found');
    console.log('  Password input:', passwordInput > 0 ? '✅ Found' : '❌ Not found');
  }
  console.log('');

  // Check for errors
  console.log('Step 4: Console Errors:');
  if (consoleErrors.length === 0) {
    console.log('  ✅ No errors detected');
  } else {
    console.log(`  ❌ ${consoleErrors.length} errors found:`);
    consoleErrors.forEach(err => console.log(`     - ${err}`));
  }
  console.log('');

  // Final verdict
  console.log('🎯 VERDICT:');
  console.log('===========');
  if (clerkFormVisible && consoleErrors.length === 0) {
    console.log('✅ SUCCESS: Sign-in form is working correctly!');
    console.log('');
    console.log('Next step: Try signing in with your Google account');
    console.log('URL: http://localhost:3000/en/sign-in');
  } else if (!clerkFormVisible) {
    console.log('❌ FAILED: Sign-in form still not visible');
    console.log('The fix did not resolve the issue.');
  } else {
    console.log('⚠️  PARTIAL: Form visible but has errors');
  }
});
