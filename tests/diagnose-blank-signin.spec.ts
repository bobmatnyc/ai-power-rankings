import { test } from '@playwright/test';

test('Diagnose blank sign-in page', async ({ page }) => {
  const consoleMessages: Array<{ type: string; text: string; location: any }> = [];
  const errors: string[] = [];

  page.on('console', msg => {
    consoleMessages.push({
      type: msg.type(),
      text: msg.text(),
      location: msg.location()
    });
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  page.on('pageerror', error => {
    errors.push(`Uncaught exception: ${error.message}`);
  });

  console.log('🔍 Diagnosing Blank Sign-In Page');
  console.log('===================================\n');

  // Navigate to sign-in
  console.log('Step 1: Navigating to sign-in page...');
  await page.goto('http://localhost:3000/en/sign-in');
  await page.waitForTimeout(5000); // Wait for everything to load

  // Take screenshot
  await page.screenshot({ path: 'test-results/blank-sign-in-page.png', fullPage: true });
  console.log('📸 Screenshot saved: test-results/blank-sign-in-page.png\n');

  // Check what's in the DOM
  console.log('Step 2: Checking DOM structure...');
  const bodyHTML = await page.evaluate(() => document.body.innerHTML);
  const hasClerkRoot = bodyHTML.includes('cl-rootBox') || bodyHTML.includes('cl-signIn');
  const hasLoadingSpinner = bodyHTML.includes('Loading sign-in') || bodyHTML.includes('animate-spin');

  console.log('  Has Clerk root box:', hasClerkRoot);
  console.log('  Has loading spinner:', hasLoadingSpinner);
  console.log('');

  // Check for specific Clerk elements
  const clerkElements = await page.evaluate(() => {
    const selectors = [
      '.cl-rootBox',
      '.cl-signIn-root',
      '[data-clerk-sign-in]',
      'div[class*="clerk"]',
      'form[class*="clerk"]'
    ];

    const found: Record<string, number> = {};
    selectors.forEach(sel => {
      const elements = document.querySelectorAll(sel);
      found[sel] = elements.length;
    });

    return found;
  });

  console.log('Step 3: Clerk elements found:');
  Object.entries(clerkElements).forEach(([selector, count]) => {
    console.log(`  ${selector}: ${count} elements`);
  });
  console.log('');

  // Check Clerk global object
  const clerkGlobal = await page.evaluate(() => {
    const clerk = (window as any).Clerk;
    if (typeof clerk === 'undefined' || clerk === null) {
      return { exists: false };
    }
    return {
      exists: true,
      loaded: clerk.loaded || false,
      isReady: typeof clerk.session !== 'undefined',
      hasSession: clerk.session !== null,
    };
  });

  console.log('Step 4: Clerk global object:');
  console.log('  window.Clerk exists:', clerkGlobal.exists);
  if (clerkGlobal.exists) {
    console.log('  Clerk loaded:', clerkGlobal.loaded);
    console.log('  Clerk ready:', clerkGlobal.isReady);
    console.log('  Has session:', clerkGlobal.hasSession);
  }
  console.log('');

  // Check for errors
  console.log('Step 5: Errors detected:');
  if (errors.length === 0) {
    console.log('  ✅ No JavaScript errors found');
  } else {
    console.log(`  ❌ ${errors.length} errors found:`);
    errors.forEach((err, i) => {
      console.log(`  ${i + 1}. ${err}`);
    });
  }
  console.log('');

  // Show all console messages
  console.log('Step 6: All Console Messages:');
  console.log(`  Total messages: ${consoleMessages.length}`);
  console.log('');
  consoleMessages.forEach((msg, i) => {
    if (msg.type === 'error' || msg.type === 'warning' || msg.text.toLowerCase().includes('clerk')) {
      console.log(`  [${msg.type.toUpperCase()}] ${msg.text}`);
    }
  });
  console.log('');

  // Get actual rendered HTML structure
  console.log('Step 7: HTML structure analysis...');
  const htmlStructure = await page.evaluate(() => {
    const body = document.body;
    const mainContent = body.querySelector('main');

    return {
      bodyClasses: body.className,
      bodyChildCount: body.children.length,
      mainExists: !!mainContent,
      mainHTML: mainContent ? mainContent.innerHTML.substring(0, 500) : 'No main element',
      bodyFirstChild: body.children[0] ? body.children[0].tagName : 'No children',
    };
  });

  console.log('  Body classes:', htmlStructure.bodyClasses);
  console.log('  Body children count:', htmlStructure.bodyChildCount);
  console.log('  Main element exists:', htmlStructure.mainExists);
  console.log('  First child tag:', htmlStructure.bodyFirstChild);
  console.log('  Main content preview:');
  console.log('  ', htmlStructure.mainHTML.substring(0, 200));
  console.log('');

  // Check network requests to Clerk
  console.log('Step 8: Waiting for network activity...');
  await page.waitForTimeout(2000);
  console.log('');

  // Final diagnosis
  console.log('🎯 DIAGNOSIS:');
  console.log('================');
  if (!hasClerkRoot && errors.length > 0) {
    console.log('❌ Clerk UI failed to render due to JavaScript errors');
  } else if (!hasClerkRoot && errors.length === 0) {
    console.log('⚠️  Clerk UI not rendered, but no errors detected');
    console.log('   Possible causes:');
    console.log('   - Clerk component mounting issue');
    console.log('   - ClerkProvider not wrapping the component');
    console.log('   - Mount detection logic issue');
  } else if (hasLoadingSpinner) {
    console.log('⏳ Page stuck on loading spinner');
    console.log('   Component never finished mounting');
  } else {
    console.log('✅ Clerk UI is present in DOM');
  }
});
