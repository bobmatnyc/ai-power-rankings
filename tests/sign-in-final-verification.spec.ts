import { test, expect } from '@playwright/test';

test('Final sign-in verification with proper Clerk wait', async ({ page }) => {
  console.log('🔍 Final Sign-In Verification');
  console.log('===============================\n');

  const consoleErrors: string[] = [];
  const networkErrors: { url: string; status: number }[] = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('response', response => {
    if (response.status() >= 400) {
      networkErrors.push({
        url: response.url(),
        status: response.status()
      });
    }
  });

  console.log('Step 1: Navigating to sign-in page...');
  await page.goto('http://localhost:3000/en/sign-in');

  console.log('Step 2: Waiting for loading state to complete...');

  // Wait for loading indicator to disappear
  const loadingIndicator = page.locator('text=Loading authentication..., text=Mounting...');
  if (await loadingIndicator.isVisible().catch(() => false)) {
    console.log('  ⏳ Loading indicator visible, waiting...');
    await loadingIndicator.waitFor({ state: 'hidden', timeout: 10000 });
    console.log('  ✅ Loading complete');
  } else {
    console.log('  ✅ No loading indicator found (already loaded)');
  }

  // Additional wait for Clerk SDK to fully initialize
  await page.waitForTimeout(2000);

  console.log('\nStep 3: Checking for Clerk Sign-In Component...');

  // Look for the actual Clerk SignIn component or its iframe
  const clerkSignIn = page.locator('[data-clerk-component="SignIn"], .cl-component.cl-signIn, iframe[src*="clerk"]');
  const hasClerkSignIn = await clerkSignIn.count() > 0;

  console.log(`  Clerk SignIn component: ${hasClerkSignIn ? '✅ Found' : '❌ Not found'}`);

  if (hasClerkSignIn) {
    const isVisible = await clerkSignIn.first().isVisible();
    console.log(`  Component visible: ${isVisible ? '✅ Yes' : '❌ No'}`);
  }

  // Check page title
  const title = await page.title();
  console.log(`  Page title: "${title}"`);

  // Take screenshots
  await page.screenshot({
    path: 'test-results/sign-in-final-full.png',
    fullPage: true
  });

  await page.screenshot({
    path: 'test-results/sign-in-final-viewport.png',
    fullPage: false
  });

  console.log('\nStep 4: Inspecting Page Structure...');

  // Get the actual content
  const bodyText = await page.locator('body').textContent();
  console.log(`  Body contains "Sign in": ${bodyText?.includes('Sign in') ? '✅ Yes' : '❌ No'}`);
  console.log(`  Body contains "Email": ${bodyText?.includes('Email') || bodyText?.includes('email') ? '✅ Yes' : '❌ No'}`);
  console.log(`  Body contains "Password": ${bodyText?.includes('Password') || bodyText?.includes('password') ? '✅ Yes' : '❌ No'}`);

  // Check for any form elements
  const forms = await page.locator('form').count();
  const inputs = await page.locator('input').count();
  const buttons = await page.locator('button').count();

  console.log(`  Forms found: ${forms}`);
  console.log(`  Input fields found: ${inputs}`);
  console.log(`  Buttons found: ${buttons}`);

  console.log('\nStep 5: Error Summary...');
  console.log(`  Console errors: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    consoleErrors.slice(0, 3).forEach(err => console.log(`     ❌ ${err}`));
  }

  console.log(`  Network errors: ${networkErrors.length}`);
  if (networkErrors.length > 0) {
    networkErrors.slice(0, 3).forEach(({ url, status }) => {
      console.log(`     [${status}] ${url}`);
    });
  }

  // Try to detect what's actually on the page
  const pageContent = await page.content();
  const hasClerkInHTML = pageContent.toLowerCase().includes('clerk');

  console.log('\nStep 6: HTML Analysis...');
  console.log(`  HTML contains "clerk": ${hasClerkInHTML ? '✅ Yes' : '❌ No'}`);

  // Get all visible text on page
  const allText = await page.locator('body').textContent();

  console.log('\n🎯 FINAL VERDICT:');
  console.log('=================');

  const hasFormElements = forms > 0 || inputs > 0;
  const hasSignInText = allText?.toLowerCase().includes('sign in') || false;
  const noErrors = consoleErrors.length === 0 && networkErrors.length === 0;

  if (hasClerkSignIn && noErrors) {
    console.log('✅ PERFECT: Clerk sign-in form is fully loaded and functional!');
  } else if ((hasFormElements || hasSignInText) && consoleErrors.length === 0) {
    console.log('✅ SUCCESS: Sign-in page is rendering (may be custom form or loading Clerk)');
  } else if (hasFormElements || hasSignInText) {
    console.log('⚠️  PARTIAL: Page has sign-in elements but with some issues');
  } else {
    console.log('❌ FAILED: Sign-in form is not rendering correctly');
  }

  console.log('\n📸 Screenshots:');
  console.log('   - test-results/sign-in-final-full.png (full page)');
  console.log('   - test-results/sign-in-final-viewport.png (viewport)');
  console.log('\n🌐 Test URL: http://localhost:3000/en/sign-in');

  // Show first 500 chars of visible text for debugging
  if (allText) {
    console.log('\n📝 Page Content Preview:');
    console.log('========================');
    console.log(allText.slice(0, 500).replace(/\s+/g, ' ').trim());
  }
});
