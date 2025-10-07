import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '../../tests',
  testMatch: '**/verify-date-picker.spec.ts',
  timeout: 60000,

  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'on',
    video: 'off',
    trace: 'off',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Don't start a web server - use existing one
  webServer: undefined,
});
