import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '../..',
  testMatch: 'verify-article-dates-ui.spec.ts',
  timeout: 60000,
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'on',
    trace: 'on',
  },
  reporter: 'list',
});
