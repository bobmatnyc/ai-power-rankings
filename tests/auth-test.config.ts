import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for Auth Flow Testing
 * Uses existing running server on localhost:3000
 */
export default defineConfig({
  testDir: '.',
  testMatch: '**/auth-flow-test.spec.ts',
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    viewport: { width: 1280, height: 720 },
    screenshot: 'on',
    video: 'on',
    trace: 'on',
    ignoreHTTPSErrors: true,
    locale: 'en-US',
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // No webServer config - we're using the already running server
});
