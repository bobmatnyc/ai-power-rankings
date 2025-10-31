import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/debug-signin-loading.spec.ts',
  timeout: 60000,

  use: {
    baseURL: 'http://localhost:3007',
    screenshot: 'on',
    trace: 'on',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // No webServer - expect server to already be running
});
