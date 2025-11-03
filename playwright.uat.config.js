const { defineConfig, devices } = require('@playwright/test');

/**
 * Standalone UAT Configuration
 * Assumes server is already running on port 3007
 */
module.exports = defineConfig({
  testDir: './tests',
  testMatch: '**/uat-sign-in-verification.spec.js',
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false,
  retries: 0,
  workers: 1,

  reporter: [
    ['list'],
    ['json', { outputFile: 'tests/uat-screenshots/test-results.json' }],
  ],

  use: {
    baseURL: 'http://localhost:3007',
    viewport: { width: 1280, height: 720 },
    screenshot: 'on',
    video: 'off',
    trace: 'off',
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
