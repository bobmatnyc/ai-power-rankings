import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for AI Power Ranking UAT Suite
 *
 * This configuration is optimized for comprehensive end-to-end testing
 * including API tests, UI tests, and cross-browser compatibility.
 */

// Read from environment variables with fallbacks
const BASE_URL = process.env.BASE_URL || 'http://localhost:3011';
const CI = !!process.env.CI;

export default defineConfig({
  // Test directory
  testDir: './tests/e2e',

  // Test file pattern
  testMatch: '**/*.spec.ts',

  // Timeout settings
  timeout: 30000, // 30s per test
  expect: {
    timeout: 10000, // 10s for assertions
  },

  // Test execution settings
  fullyParallel: !CI, // Parallel in dev, sequential in CI
  forbidOnly: CI, // Fail if test.only in CI
  retries: CI ? 2 : 0, // Retry failed tests in CI
  workers: CI ? 1 : undefined, // Single worker in CI for stability

  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'test-results/html', open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['list'], // Console output
    CI ? ['github'] : ['line'], // GitHub annotations in CI
  ],

  // Global test setup
  use: {
    // Base URL for all tests
    baseURL: BASE_URL,

    // Browser context options
    viewport: { width: 1280, height: 720 },

    // Capture screenshots on failure
    screenshot: 'only-on-failure',

    // Capture video on failure
    video: 'retain-on-failure',

    // Capture trace on first retry
    trace: 'on-first-retry',

    // Accept downloads
    acceptDownloads: true,

    // Network settings
    ignoreHTTPSErrors: true,

    // Locale settings
    locale: 'en-US',
    timezoneId: 'America/New_York',

    // Action timeout
    actionTimeout: 10000,

    // Navigation timeout
    navigationTimeout: 30000,
  },

  // Projects for different browsers and test types
  projects: [
    // API Tests (no browser needed)
    {
      name: 'api-tests',
      testMatch: '**/api.spec.ts',
      use: {
        // API tests don't need a browser
        baseURL: BASE_URL,
      },
    },

    // Desktop Chrome
    {
      name: 'chromium',
      testIgnore: '**/api.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        // Enable Chrome DevTools Protocol
        launchOptions: {
          args: ['--disable-blink-features=AutomationControlled'],
        },
      },
    },

    // Desktop Firefox
    {
      name: 'firefox',
      testIgnore: '**/api.spec.ts',
      use: { ...devices['Desktop Firefox'] },
    },

    // Desktop Safari (macOS only)
    {
      name: 'webkit',
      testIgnore: '**/api.spec.ts',
      use: { ...devices['Desktop Safari'] },
    },

    // Mobile Chrome
    {
      name: 'mobile-chrome',
      testIgnore: ['**/api.spec.ts', '**/admin.spec.ts'], // Skip admin on mobile
      use: { ...devices['Pixel 5'] },
    },

    // Mobile Safari
    {
      name: 'mobile-safari',
      testIgnore: ['**/api.spec.ts', '**/admin.spec.ts'], // Skip admin on mobile
      use: { ...devices['iPhone 12'] },
    },
  ],

  // Web server configuration
  webServer: {
    command: 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: !CI, // Reuse server in dev
    timeout: 120000, // 2 minutes to start
    stdout: 'pipe',
    stderr: 'pipe',
  },

  // Output folder for test artifacts
  outputDir: 'test-results/artifacts',
});
