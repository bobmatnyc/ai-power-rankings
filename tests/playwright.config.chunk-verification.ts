import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for ChunkLoadError Verification
 *
 * Optimized for testing clean rebuild resolution of HMR cache corruption
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/chunk-load-error-verification.spec.ts',

  // Run tests in sequence for clearer output
  fullyParallel: false,
  workers: 1,

  // Extend timeout for chunk loading verification
  timeout: 60000,
  expect: {
    timeout: 10000,
  },

  // Reporter configuration
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report-chunk-verification', open: 'never' }]
  ],

  use: {
    baseURL: 'http://localhost:3007',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    // Extended navigation timeout for chunk loading
    navigationTimeout: 30000,
    actionTimeout: 10000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Dev server is already running on port 3007
  webServer: undefined,
});
