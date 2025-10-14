import { test, expect } from '@playwright/test';

test('Capture authentication flow screenshots', async ({ page }) => {
  console.log('Capturing authentication flow screenshots...\n');

  // Screenshot 1: Initial admin access attempt
  console.log('1. Attempting to access /en/admin...');
  await page.goto('http://localhost:3000/en/admin');
  await page.waitForTimeout(2000);
  await page.screenshot({
    path: 'test-results/screenshots/01-admin-redirect.png',
    fullPage: true
  });
  console.log('   Screenshot saved: test-results/screenshots/01-admin-redirect.png');
  console.log('   Current URL:', page.url());

  // Screenshot 2: Sign-in page
  console.log('\n2. Loading sign-in page...');
  await page.goto('http://localhost:3000/en/sign-in');
  await page.waitForTimeout(2000);
  await page.screenshot({
    path: 'test-results/screenshots/02-sign-in-page.png',
    fullPage: true
  });
  console.log('   Screenshot saved: test-results/screenshots/02-sign-in-page.png');

  // Screenshot 3: Sign-in page with DevTools showing cookies
  console.log('\n3. Capturing cookie state...');
  const cookies = await page.context().cookies();
  const clerkCookies = cookies.filter(c =>
    c.name.includes('clerk') || c.name.includes('session')
  );
  console.log('   Clerk cookies found:', clerkCookies.length);
  clerkCookies.forEach(cookie => {
    console.log('   -', cookie.name);
  });

  console.log('\n=== SCREENSHOTS CAPTURED ===');
  console.log('Location: test-results/screenshots/');
  console.log('Files:');
  console.log('  1. 01-admin-redirect.png - Initial redirect from admin to sign-in');
  console.log('  2. 02-sign-in-page.png - Sign-in form ready for credentials');
  console.log('\nNext: Sign in manually and we can capture post-auth screenshots');
});
