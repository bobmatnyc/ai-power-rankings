import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for Staging UAT Testing
 * Tests against staging.aipowerranking.com with production database
 */

// Updated staging URLs from Vercel deployment
const STAGING_URL = process.env.STAGING_URL || 'https://ai-power-ranking-g0629alr1-1-m.vercel.app';

export default defineConfig({
  testDir: '../../tests/e2e',
  testMatch: '**/staging-uat.spec.ts',

  // Extended timeout for staging environment
  timeout: 60000, // 60s per test for staging latency
  expect: {
    timeout: 15000, // 15s for assertions
  },

  // Sequential execution for staging to avoid rate limits
  fullyParallel: false,
  forbidOnly: true,
  retries: 2, // Retry on staging flakiness
  workers: 1, // Single worker to avoid overloading staging

  reporter: [
    ['html', { outputFolder: '../../tests/test-results/uat-staging/html', open: 'never' }],
    ['json', { outputFile: '../../tests/test-results/uat-staging/results.json' }],
    ['list'],
    ['junit', { outputFile: '../../tests/test-results/uat-staging/junit.xml' }],
  ],

  use: {
    baseURL: STAGING_URL,

    // Viewport settings for desktop testing
    viewport: { width: 1920, height: 1080 },

    // Capture everything for UAT evidence
    screenshot: 'on', // Capture all screenshots for UAT report
    video: 'on', // Record all sessions for UAT evidence
    trace: 'on', // Full trace for debugging

    // Network settings
    ignoreHTTPSErrors: true,

    // Locale settings
    locale: 'en-US',
    timezoneId: 'America/New_York',

    // Generous timeouts for staging
    actionTimeout: 15000,
    navigationTimeout: 60000,
  },

  // Browser projects for UAT
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
        launchOptions: {
          args: ['--disable-blink-features=AutomationControlled'],
        },
      },
    },
  ],

  // No webServer - testing live staging environment
  outputDir: '../../tests/test-results/uat-staging/artifacts',
});
