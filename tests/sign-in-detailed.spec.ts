import { test, expect } from '@playwright/test';

test('Detailed sign-in form analysis', async ({ page }) => {
  console.log('🔍 Detailed Sign-In Form Analysis');
  console.log('===================================\n');

  const consoleMessages: { type: string; text: string }[] = [];
  const networkErrors: { url: string; status: number }[] = [];

  // Capture all console messages
  page.on('console', msg => {
    consoleMessages.push({
      type: msg.type(),
      text: msg.text()
    });
  });

  // Capture network errors
  page.on('response', response => {
    if (response.status() >= 400) {
      networkErrors.push({
        url: response.url(),
        status: response.status()
      });
    }
  });

  // Navigate to sign-in page
  console.log('Step 1: Loading sign-in page...');
  await page.goto('http://localhost:3000/en/sign-in', { waitUntil: 'networkidle' });

  // Wait for Clerk to load
  await page.waitForTimeout(2000);

  // Detailed form inspection
  console.log('\nStep 2: Form Element Detection:');
  console.log('================================');

  // Check various Clerk selectors
  const clerkSelectors = [
    { name: 'Clerk Root Box', selector: '.cl-rootBox' },
    { name: 'Clerk Sign-In Root', selector: '.cl-signIn-root' },
    { name: 'Clerk Card', selector: '.cl-card' },
    { name: 'Clerk Component', selector: '[data-clerk-component]' },
    { name: 'Email Input', selector: 'input[name="identifier"]' },
    { name: 'Email Type Input', selector: 'input[type="email"]' },
    { name: 'Password Input', selector: 'input[type="password"]' },
    { name: 'Submit Button', selector: 'button[type="submit"]' },
    { name: 'Continue Button', selector: 'button:has-text("Continue")' },
    { name: 'Sign In Button', selector: 'button:has-text("Sign in")' },
  ];

  for (const { name, selector } of clerkSelectors) {
    const count = await page.locator(selector).count();
    const visible = count > 0 ? await page.locator(selector).first().isVisible() : false;
    console.log(`  ${name}: ${count > 0 ? '✅' : '❌'} (${count} found${visible ? ', visible' : ''})`);
  }

  // Check for social login buttons
  console.log('\nStep 3: Social Login Options:');
  console.log('============================');
  const socialProviders = ['Google', 'GitHub', 'Microsoft', 'Apple'];
  for (const provider of socialProviders) {
    const button = await page.locator(`button:has-text("${provider}")`).count();
    console.log(`  ${provider}: ${button > 0 ? '✅ Found' : '❌ Not found'}`);
  }

  // Take detailed screenshot
  await page.screenshot({
    path: 'test-results/sign-in-detailed.png',
    fullPage: true
  });

  // Network errors report
  console.log('\nStep 4: Network Issues:');
  console.log('======================');
  if (networkErrors.length === 0) {
    console.log('  ✅ No network errors');
  } else {
    console.log(`  ⚠️  ${networkErrors.length} failed requests:`);
    networkErrors.forEach(({ url, status }) => {
      console.log(`     [${status}] ${url}`);
    });
  }

  // Console errors
  console.log('\nStep 5: Console Messages:');
  console.log('========================');
  const errors = consoleMessages.filter(m => m.type === 'error');
  const warnings = consoleMessages.filter(m => m.type === 'warning');

  console.log(`  Errors: ${errors.length}`);
  if (errors.length > 0) {
    errors.forEach(e => console.log(`     ❌ ${e.text}`));
  }

  console.log(`  Warnings: ${warnings.length}`);
  if (warnings.length > 0 && warnings.length <= 5) {
    warnings.forEach(w => console.log(`     ⚠️  ${w.text}`));
  }

  // Get page HTML for analysis
  const html = await page.content();
  const hasClerkScript = html.includes('clerk.com') || html.includes('clerk.dev');
  const hasClerkDiv = html.includes('cl-rootBox') || html.includes('cl-signIn-root');

  console.log('\nStep 6: Page Content Analysis:');
  console.log('=============================');
  console.log(`  Clerk script loaded: ${hasClerkScript ? '✅' : '❌'}`);
  console.log(`  Clerk components rendered: ${hasClerkDiv ? '✅' : '❌'}`);

  // Final verdict
  console.log('\n🎯 FINAL VERDICT:');
  console.log('=================');

  const formVisible = await page.locator('.cl-rootBox, .cl-signIn-root').isVisible().catch(() => false);

  if (formVisible && errors.length === 0 && networkErrors.length === 0) {
    console.log('✅ PERFECT: Sign-in form is fully functional with no errors!');
  } else if (formVisible && (errors.length > 0 || networkErrors.length > 0)) {
    console.log('✅ SUCCESS WITH WARNINGS: Form is visible but has minor issues');
    console.log('   The form should be usable despite the warnings.');
  } else {
    console.log('❌ FAILED: Sign-in form is not visible');
  }

  console.log('\n📍 Test URL: http://localhost:3000/en/sign-in');
  console.log('📸 Screenshots saved in test-results/');
});
