import { join } from "node:path";
import { defineConfig } from "@playwright/test";

/**
 * Visual tests for `/design` (#190, ruling D5: snapshot `/design` only).
 *
 * Why: live pages change with database content from run to run; `/design`
 * renders fixed samples, so a pixel difference there is a style change.
 * What: runs tests/visual/design.visual.spec.ts against a dev server it starts
 * (or `DESIGN_BASE_URL` when set), one worker, zero pixel tolerance. Baselines
 * live in tests/visual/__snapshots__/, one set per platform.
 * Set `PLAYWRIGHT_CHROMIUM_PATH` to use a Chromium other than the bundled one.
 * Test: `npm run test:visual` (`-- --update-snapshots` after an intended change).
 */

const PORT = Number(process.env.DESIGN_PORT ?? 3017);
const BASE_URL = process.env.DESIGN_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: ".",
  testMatch: "design.visual.spec.ts",
  snapshotPathTemplate: "{testDir}/__snapshots__/{arg}-{platform}{ext}",
  outputDir: "../../test-results/visual",
  workers: 1,
  retries: 0,
  timeout: 180_000,
  reporter: [["list"]],
  expect: {
    toHaveScreenshot: { threshold: 0, maxDiffPixels: 0, animations: "disabled", caret: "hide" },
  },
  use: {
    baseURL: BASE_URL,
    deviceScaleFactor: 1,
    colorScheme: "light",
    reducedMotion: "reduce",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {},
  },
  webServer: process.env.DESIGN_BASE_URL
    ? undefined
    : {
        command: `npx next dev --port ${PORT}`,
        cwd: join(__dirname, "..", ".."),
        url: `${BASE_URL}/design`,
        reuseExistingServer: true,
        timeout: 180_000,
        // Development only: the middleware refuses this flag in production.
        env: { NEXT_PUBLIC_DISABLE_AUTH: "true" },
      },
});
