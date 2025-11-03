import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for ClerkProvider Context Fix QA
 *
 * Specialized configuration for testing:
 * - Public page navigation (no ClerkProvider)
 * - Authenticated page access (with ClerkProvider)
 * - Route transitions and browser navigation
 * - Console error monitoring (ClerkProvider errors)
 */

const BASE_URL = 'http://localhost:3007';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/clerk-context-*.spec.ts',

  timeout: 45000, // 45s per test (longer for navigation testing)
  expect: {
    timeout: 15000, // 15s for assertions
  },

  // Sequential execution for stable console monitoring
  fullyParallel: false,
  forbidOnly: true,
  retries: 0, // No retries for QA verification
  workers: 1, // Single worker for consistent results

  reporter: [
    ['list', { printSteps: true }],
    ['json', { outputFile: 'test-results/clerk-context-qa-results.json' }],
    ['html', { outputFolder: 'test-results/clerk-context-qa-html', open: 'never' }],
  ],

  use: {
    baseURL: BASE_URL,
    viewport: { width: 1280, height: 720 },

    // NO screenshots to avoid API errors
    screenshot: 'off',
    video: 'off',
    trace: 'off',

    // Capture console logs (critical for this QA)
    launchOptions: {
      args: ['--disable-blink-features=AutomationControlled'],
    },

    actionTimeout: 15000,
    navigationTimeout: 30000,
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Enable console capture
        contextOptions: {
          logger: {
            isEnabled: () => true,
            log: (name, severity, message) => {
              console.log(`[${severity}] ${name}: ${message}`);
            },
          },
        },
      },
    },
  ],

  // Expect existing dev server on port 3007
  // DO NOT start a new server
});
