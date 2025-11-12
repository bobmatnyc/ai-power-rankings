import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for Production Verification
 *
 * Tests against live production deployment without starting a local server.
 */

export default defineConfig({
  // Test directory - use root for production tests
  testDir: '.',

  // Test file pattern - only production test files
  testMatch: '**/test-production-*.spec.ts',

  // Timeout settings
  timeout: 60000, // 60s per test (production may be slower)
  expect: {
    timeout: 15000, // 15s for assertions
  },

  // Test execution settings
  fullyParallel: false, // Sequential for production testing
  forbidOnly: true,
  retries: 1, // Retry once on network issues
  workers: 1, // Single worker for stability

  // Reporter configuration
  reporter: [
    ['list'], // Detailed console output
    ['html', { outputFolder: 'test-results/production-html', open: 'never' }],
  ],

  // Global test setup
  use: {
    // Production URL - no local server
    baseURL: 'https://aipowerranking.com',

    // Browser context options
    viewport: { width: 1280, height: 720 },

    // Capture screenshots on failure
    screenshot: 'only-on-failure',

    // Capture video on failure
    video: 'retain-on-failure',

    // Capture trace on failure
    trace: 'on-first-retry',

    // Network settings
    ignoreHTTPSErrors: false, // Strict SSL checking for production

    // Locale settings
    locale: 'en-US',
    timezoneId: 'America/New_York',

    // Action timeout
    actionTimeout: 15000,

    // Navigation timeout
    navigationTimeout: 60000, // Longer for production
  },

  // Test against Chromium only for quick verification
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Enable Chrome DevTools Protocol for console monitoring
        launchOptions: {
          args: [
            '--disable-blink-features=AutomationControlled',
            '--enable-logging',
            '--v=1'
          ],
        },
      },
    },
  ],

  // NO webServer config - testing live production

  // Output folder for test artifacts
  outputDir: 'test-results/production-artifacts',
});
