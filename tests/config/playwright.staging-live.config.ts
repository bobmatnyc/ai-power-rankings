import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for Live Staging Testing
 * Tests against live staging.aipowerranking.com without starting local server
 */

const STAGING_URL = 'https://staging.aipowerranking.com';

export default defineConfig({
  testDir: '../../tests/e2e',
  testMatch: '**/staging-quick-check.spec.ts',

  timeout: 60000,
  expect: {
    timeout: 15000,
  },

  fullyParallel: false,
  forbidOnly: true,
  retries: 1,
  workers: 1,

  reporter: [
    ['list'],
    ['html', { outputFolder: '../../tests/test-results/staging-quick-check', open: 'never' }],
  ],

  use: {
    baseURL: STAGING_URL,
    viewport: { width: 1280, height: 720 },
    screenshot: 'on',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    ignoreHTTPSErrors: true,
    locale: 'en-US',
    actionTimeout: 15000,
    navigationTimeout: 60000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // NO webServer - testing live staging
  outputDir: '../../tests/test-results/staging-quick-check/artifacts',
});
