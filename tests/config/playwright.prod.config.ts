import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for Production Build Testing
 * Uses existing production server, doesn't start a new one
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const CI = !!process.env.CI;

export default defineConfig({
  testDir: '../../tests/e2e',
  testMatch: '**/*.spec.ts',

  timeout: 30000,
  expect: {
    timeout: 10000,
  },

  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  workers: 4,

  reporter: [
    ['html', { outputFolder: '../../tests/test-results/html', open: 'never' }],
    ['json', { outputFile: '../../tests/test-results/results.json' }],
    ['list'],
    CI ? ['github'] : ['line'],
  ],

  use: {
    baseURL: BASE_URL,
    viewport: { width: 1280, height: 720 },
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
    acceptDownloads: true,
    ignoreHTTPSErrors: true,
    locale: 'en-US',
    timezoneId: 'America/New_York',
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },

  projects: [
    {
      name: 'api-tests',
      testMatch: '**/api.spec.ts',
      use: {
        baseURL: BASE_URL,
      },
    },
    {
      name: 'chromium',
      testIgnore: '**/api.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--disable-blink-features=AutomationControlled'],
        },
      },
    },
    {
      name: 'firefox',
      testIgnore: '**/api.spec.ts',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      testIgnore: '**/api.spec.ts',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-chrome',
      testIgnore: ['**/api.spec.ts', '**/admin.spec.ts'],
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      testIgnore: ['**/api.spec.ts', '**/admin.spec.ts'],
      use: { ...devices['iPhone 12'] },
    },
  ],

  // NO webServer - use existing production server
  outputDir: '../../tests/test-results/artifacts',
});
