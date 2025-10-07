import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for Staging Environment Verification
 *
 * This configuration is specifically for testing the deployed staging environment
 * without starting a local web server.
 */

const STAGING_URL = 'https://ai-power-ranking-e60cz4c4d-1-m.vercel.app';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/staging-modal-api-verification.spec.ts',

  timeout: 60000, // 60s per test
  expect: {
    timeout: 15000, // 15s for assertions
  },

  fullyParallel: false,
  forbidOnly: false,
  retries: 1,
  workers: 1,

  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results/staging-verification.json' }],
  ],

  use: {
    baseURL: STAGING_URL,
    viewport: { width: 1280, height: 720 },
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
    ignoreHTTPSErrors: true,
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // No web server - testing remote staging environment
  outputDir: 'test-results/staging-artifacts',
});
