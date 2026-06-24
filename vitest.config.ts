import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

/**
 * Vitest configuration for unit tests.
 *
 * Why: The repo had `*.test.ts` files importing from "vitest" but no runner was
 * installed and no config existed, so they never executed. This wires up a
 * Node-environment unit runner and deliberately excludes the Playwright e2e
 * suite (tests/e2e/**, *.spec.ts) so the two test systems stay independent.
 * What: Discovers unit tests under lib/** and i18n/** (where the vitest specs
 * live), resolves the tsconfig `@/*` path alias via vite-tsconfig-paths, and
 * runs them in a Node environment.
 * Test: `npm run test:unit` should discover and execute the lib/i18n vitest
 * suites (e.g. lib/services/automated-ingestion.fallback.test.ts) and report
 * green; Playwright .spec.ts files under tests/ must NOT be picked up.
 */
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    globals: false,
    // Only the directories that actually contain vitest unit tests. The
    // top-level tests/ dir holds Playwright .spec.ts files plus standalone
    // tsx scripts, so it is intentionally NOT globbed here.
    include: ["lib/**/*.test.ts", "i18n/**/*.test.ts"],
    exclude: [
      "**/node_modules/**",
      "**/.next/**",
      "tests/e2e/**",
      "**/*.spec.ts",
    ],
  },
});
