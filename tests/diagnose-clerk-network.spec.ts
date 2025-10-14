import { test } from '@playwright/test';

test('Diagnose Clerk network requests', async ({ page }) => {
  const requests: Array<{ url: string; status?: number; failure?: string }> = [];
  const clerkRequests: Array<{ url: string; status?: number; failure?: string }> = [];

  // Capture all network requests
  page.on('request', request => {
    const url = request.url();
    requests.push({ url });

    // Track Clerk-related requests
    if (url.includes('clerk') || url.includes('.accounts.dev')) {
      console.log(`[REQUEST] Clerk request: ${url}`);
      clerkRequests.push({ url });
    }
  });

  // Capture responses
  page.on('response', response => {
    const url = response.url();
    const status = response.status();

    if (url.includes('clerk') || url.includes('.accounts.dev')) {
      console.log(`[RESPONSE] Clerk response: ${url} - Status: ${status}`);
      const existing = clerkRequests.find(r => r.url === url);
      if (existing) {
        existing.status = status;
      }
    }
  });

  // Capture request failures
  page.on('requestfailed', request => {
    const url = request.url();
    const failure = request.failure()?.errorText || 'Unknown error';

    if (url.includes('clerk') || url.includes('.accounts.dev')) {
      console.log(`[FAILED] Clerk request failed: ${url} - ${failure}`);
      const existing = clerkRequests.find(r => r.url === url);
      if (existing) {
        existing.failure = failure;
      }
    }
  });

  console.log('🌐 Clerk Network Diagnostics');
  console.log('==============================\n');

  console.log('Step 1: Navigating to sign-in page...');
  await page.goto('http://localhost:3000/en/sign-in');

  console.log('Step 2: Waiting 10 seconds for network activity...');
  await page.waitForTimeout(10000);

  console.log('\nStep 3: Network Summary');
  console.log(`Total requests: ${requests.length}`);
  console.log(`Clerk-related requests: ${clerkRequests.length}\n`);

  if (clerkRequests.length === 0) {
    console.log('❌ CRITICAL: No Clerk requests detected!');
    console.log('   This means Clerk SDK is not attempting to load.');
    console.log('   Possible causes:');
    console.log('   - Missing or invalid NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY');
    console.log('   - ClerkProvider not rendering properly');
    console.log('   - Clerk initialization blocked by configuration\n');
  } else {
    console.log('Clerk Requests:');
    clerkRequests.forEach((req, i) => {
      console.log(`  ${i + 1}. ${req.url}`);
      if (req.status) {
        console.log(`     Status: ${req.status} ${req.status === 200 ? '✅' : '❌'}`);
      }
      if (req.failure) {
        console.log(`     Failed: ${req.failure} ❌`);
      }
    });
    console.log('');
  }

  // Check environment variables from client side
  console.log('Step 4: Checking client-side environment...');
  const envCheck = await page.evaluate(() => {
    return {
      hasClerkKey: !!(process.env as any).NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
      clerkKeyPrefix: ((process.env as any).NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || '').substring(0, 15),
    };
  });

  console.log('  Client-side Clerk key available:', envCheck.hasClerkKey);
  console.log('  Key prefix:', envCheck.clerkKeyPrefix || '(empty)');
  console.log('');

  // Check for Clerk script tags
  console.log('Step 5: Checking for Clerk script tags...');
  const scripts = await page.evaluate(() => {
    const allScripts = Array.from(document.querySelectorAll('script'));
    return allScripts
      .filter(s => s.src.includes('clerk') || s.src.includes('.accounts.dev'))
      .map(s => ({
        src: s.src,
        async: s.async,
        defer: s.defer,
        loaded: s.readyState === 'complete'
      }));
  });

  if (scripts.length === 0) {
    console.log('  ❌ No Clerk script tags found in page');
  } else {
    console.log(`  ✅ Found ${scripts.length} Clerk script(s):`);
    scripts.forEach((script, i) => {
      console.log(`    ${i + 1}. ${script.src}`);
      console.log(`       Async: ${script.async}, Defer: ${script.defer}, Loaded: ${script.loaded}`);
    });
  }
  console.log('');

  // Final diagnosis
  console.log('🎯 DIAGNOSIS:');
  console.log('===============');

  if (clerkRequests.length === 0 && scripts.length === 0) {
    console.log('❌ Clerk SDK is NOT loading at all');
    console.log('   Root cause: Clerk initialization never starts');
    console.log('   → Check NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is set correctly');
    console.log('   → Verify ClerkProvider is receiving the key');
    console.log('   → Check for conditional rendering that might prevent ClerkProvider');
  } else if (clerkRequests.some(r => r.failure)) {
    console.log('❌ Clerk SDK request FAILED');
    console.log('   Root cause: Network error or blocked request');
    console.log('   → Check internet connection');
    console.log('   → Check firewall/proxy settings');
    console.log('   → Verify Clerk service status');
  } else if (clerkRequests.some(r => r.status && r.status >= 400)) {
    console.log('❌ Clerk SDK returned error status');
    console.log('   Root cause: Invalid configuration or authentication');
    console.log('   → Verify publishable key is correct');
    console.log('   → Check Clerk dashboard for API status');
  } else if (clerkRequests.length > 0 && clerkRequests.every(r => r.status === 200)) {
    console.log('⚠️  Clerk SDK loaded successfully, but UI not rendering');
    console.log('   Root cause: Component rendering issue');
    console.log('   → Check if Clerk components are properly imported');
    console.log('   → Verify no React rendering errors');
    console.log('   → Check browser console for Clerk-specific errors');
  }

  // Take final screenshot
  await page.screenshot({ path: 'test-results/clerk-network-diagnosis.png', fullPage: true });
  console.log('\n📸 Screenshot: test-results/clerk-network-diagnosis.png');
});
