import { defineConfig, devices } from '@playwright/test';

/**
 * Phase 2 FCP Optimization Test Configuration
 *
 * Uses the production server already running on port 3001
 */
export default defineConfig({
  testDir: './tests',
  testMatch: '**/phase2-fcp-verification.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // No webServer - use existing production server on port 3001
});
