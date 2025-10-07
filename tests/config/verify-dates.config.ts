import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '../..',
  testMatch: 'verify-article-dates.spec.ts',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'on',
    video: 'retain-on-failure',
  },
  reporter: 'list',
  // Don't start a web server, use existing one
});
