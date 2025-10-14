import { test, expect } from '@playwright/test';

test('Debug sign-in loading spinner', async ({ page }) => {
  console.log('🔍 Debugging Sign-In Loading Spinner');
  console.log('======================================\n');

  const errors: string[] = [];
  const warnings: string[] = [];
  const clerkLogs: string[] = [];
  const networkRequests: Array<{ url: string; status: number | null; method: string }> = [];

  // Monitor console messages
  page.on('console', msg => {
    const text = msg.text();
    if (msg.type() === 'error') errors.push(text);
    if (msg.type() === 'warning') warnings.push(text);
    if (text.toLowerCase().includes('clerk')) clerkLogs.push(text);
  });

  // Monitor network requests
  page.on('response', response => {
    const url = response.url();
    if (url.includes('clerk') || url.includes('api')) {
      networkRequests.push({
        url: url,
        status: response.status(),
        method: response.request().method()
      });
    }
  });

  // Monitor failed requests
  page.on('requestfailed', request => {
    console.log(`❌ Failed request: ${request.url()}`);
  });

  console.log('Step 1: Navigate to sign-in page...');
  await page.goto('http://localhost:3000/en/sign-in?redirect_url=%2Fen%2Fadmin', {
    waitUntil: 'networkidle',
    timeout: 30000
  });

  console.log('Step 2: Waiting 10 seconds to observe behavior...');
  await page.waitForTimeout(10000);

  // Take screenshot
  await page.screenshot({ path: 'test-results/signin-stuck-loading.png', fullPage: true });

  // Check what's visible
  const loadingVisible = await page.locator('text=Loading authentication').isVisible().catch(() => false);
  const clerkFormVisible = await page.locator('.cl-rootBox, .cl-signIn-root, [data-clerk-id]').isVisible().catch(() => false);

  console.log('\nStep 3: Page State:');
  console.log('  Loading spinner visible:', loadingVisible ? '❌ YES (stuck)' : '✅ NO');
  console.log('  Clerk form visible:', clerkFormVisible ? '✅ YES' : '❌ NO');

  // Get page HTML structure for debugging
  const pageContent = await page.content();
  const hasClerkElement = pageContent.includes('cl-') || pageContent.includes('clerk');
  console.log('  Clerk elements in DOM:', hasClerkElement ? 'YES' : 'NO');

  // Check Clerk state
  const clerkState = await page.evaluate(() => {
    return {
      clerkExists: typeof (window as any).Clerk !== 'undefined',
      clerkLoaded: (window as any).Clerk?.loaded || false,
      clerkIsReady: (window as any).Clerk?.isReady || false,
      clerkError: (window as any).Clerk?.error || null,
      clerkSessionId: (window as any).Clerk?.session?.id || null,
      clerkUserId: (window as any).Clerk?.user?.id || null,
      reactVersion: (window as any).React?.version || 'unknown',
    };
  });

  console.log('\nStep 4: Clerk SDK State:');
  console.log('  window.Clerk exists:', clerkState.clerkExists);
  console.log('  Clerk.loaded:', clerkState.clerkLoaded);
  console.log('  Clerk.isReady:', clerkState.clerkIsReady);
  console.log('  Clerk session ID:', clerkState.clerkSessionId || 'none');
  console.log('  Clerk user ID:', clerkState.clerkUserId || 'none');
  if (clerkState.clerkError) {
    console.log('  ❌ Clerk error:', clerkState.clerkError);
  }

  // Check environment variables (client-side accessible)
  const envState = await page.evaluate(() => {
    return {
      hasPublishableKey: !!(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || (window as any).ENV?.CLERK_PUBLISHABLE_KEY),
      nodeEnv: process.env.NODE_ENV || 'unknown',
    };
  });

  console.log('\nStep 5: Environment:');
  console.log('  Has Clerk publishable key:', envState.hasPublishableKey ? '✅ YES' : '❌ NO');
  console.log('  NODE_ENV:', envState.nodeEnv);

  // Check network requests
  console.log('\nStep 6: Clerk Network Requests:');
  if (networkRequests.length === 0) {
    console.log('  ⚠️  No Clerk-related network requests detected');
  } else {
    console.log(`  Found ${networkRequests.length} Clerk-related requests:`);
    networkRequests.slice(0, 10).forEach(req => {
      const statusEmoji = req.status && req.status < 400 ? '✅' : '❌';
      console.log(`    ${statusEmoji} ${req.method} ${req.url.substring(0, 80)} - ${req.status}`);
    });
  }

  // Check errors
  console.log('\nStep 7: JavaScript Errors:');
  if (errors.length === 0) {
    console.log('  ✅ No JavaScript errors');
  } else {
    console.log(`  ❌ ${errors.length} errors found:`);
    errors.slice(0, 5).forEach(err => console.log(`     - ${err}`));
  }

  // Check warnings
  if (warnings.length > 0) {
    console.log('\nStep 8: Warnings:');
    warnings.slice(0, 5).forEach(warn => console.log(`  ⚠️  ${warn}`));
  }

  // Check Clerk logs
  if (clerkLogs.length > 0) {
    console.log('\nStep 9: Clerk Console Logs:');
    clerkLogs.forEach(log => console.log(`  📝 ${log}`));
  }

  // Diagnosis
  console.log('\n🎯 DIAGNOSIS:');
  console.log('==============');

  if (loadingVisible && !clerkState.clerkExists) {
    console.log('❌ ISSUE: Clerk SDK is not loading at all');
    console.log('');
    console.log('Possible causes:');
    console.log('1. Clerk script failed to load (check network tab)');
    console.log('2. Content Security Policy blocking Clerk');
    console.log('3. Script tag missing or incorrect');
  } else if (loadingVisible && clerkState.clerkExists && !clerkState.clerkLoaded) {
    console.log('❌ ISSUE: Clerk SDK loaded but not initialized');
    console.log('');
    console.log('Possible causes:');
    console.log('1. Invalid or missing Clerk publishable key');
    console.log('2. Network connectivity to Clerk API');
    console.log('3. Browser blocking third-party cookies/storage');
    console.log('4. Clerk initialization error (check errors above)');
  } else if (loadingVisible && clerkState.clerkLoaded) {
    console.log('⚠️  ISSUE: Clerk SDK loaded but React component not updating');
    console.log('');
    console.log('Possible causes:');
    console.log('1. useClerk() hook not re-rendering when loaded=true');
    console.log('2. React hydration mismatch');
    console.log('3. Conditional rendering logic bug in sign-in page');
  } else if (clerkFormVisible) {
    console.log('✅ SUCCESS: Sign-in form is visible');
  } else {
    console.log('⚠️  UNKNOWN: Neither loading spinner nor form is visible');
  }

  console.log('\n📋 NEXT STEPS:');
  console.log('===============');
  if (!clerkState.clerkExists) {
    console.log('1. Check if Clerk Provider is properly configured in layout');
    console.log('2. Verify NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY in .env');
    console.log('3. Check network tab for failed Clerk SDK requests');
  } else if (!envState.hasPublishableKey) {
    console.log('1. Add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY to .env.local');
    console.log('2. Restart the dev server');
  } else if (errors.length > 0) {
    console.log('1. Fix JavaScript errors listed above');
    console.log('2. Check browser console for full error details');
  } else {
    console.log('1. Check components/auth/clerk-provider-client.tsx');
    console.log('2. Review app/[lang]/sign-in/[[...sign-in]]/page.tsx');
    console.log('3. Add console.log() to useClerk() hook to trace loaded state');
  }
});
