import { defineConfig, devices } from '@playwright/test';

/**
 * Temporary Playwright Configuration for Diagnostic Testing
 * Uses existing server on port 3000
 */

export default defineConfig({
  testDir: '.',
  testMatch: '**/diagnose-*.spec.ts',
  timeout: 60000,

  expect: {
    timeout: 10000,
  },

  fullyParallel: false,
  retries: 0,
  workers: 1,

  reporter: [
    ['list'],
  ],

  use: {
    baseURL: 'http://localhost:3000',
    viewport: { width: 1280, height: 720 },
    screenshot: 'on',
    video: 'on',
    trace: 'on',
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Don't start a new server - use existing one
  webServer: undefined,
});
