import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for Production Security Testing
 * NO webServer - tests against live production URLs
 */

export default defineConfig({
  testDir: '../../tests/security',
  testMatch: '**/*.spec.ts',

  timeout: 60000,
  expect: {
    timeout: 15000,
  },

  fullyParallel: false,
  retries: 0,
  workers: 1,

  reporter: [
    ['html', { outputFolder: '../../tests/test-results/security-html', open: 'never' }],
    ['json', { outputFile: '../../tests/test-results/security-results.json' }],
    ['list'],
  ],

  use: {
    viewport: { width: 1280, height: 720 },
    screenshot: 'on',
    video: 'retain-on-failure',
    trace: 'on',
    acceptDownloads: false,
    ignoreHTTPSErrors: true,
    locale: 'en-US',
    timezoneId: 'America/New_York',
    actionTimeout: 15000,
    navigationTimeout: 60000,
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--disable-blink-features=AutomationControlled'],
        },
      },
    },
  ],

  // NO webServer - testing production URLs directly
  outputDir: '../../tests/test-results/security-artifacts',
});
