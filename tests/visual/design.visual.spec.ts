import { expect, test } from "@playwright/test";

/**
 * Snapshots of the `/design` state sheet (#190) at 375, 768 and 1280 px, in
 * the light panel and the `.dark` panel.
 *
 * Why: a token or component change shows up here as a pixel difference.
 * What: loads `/design`, waits until `ForceStates` has applied the hover and
 * focus samples, and compares each mode panel with its baseline. Requests to
 * other origins are blocked and the footer's copyright year is masked.
 * Test: `npm run test:visual`; config in playwright.design.config.ts.
 */

const WIDTHS = [375, 768, 1280] as const;
const MODES = ["light", "dark"] as const;

for (const width of WIDTHS) {
  for (const mode of MODES) {
    test(`/design ${mode} at ${width}px`, async ({ page, baseURL }) => {
      await page.setViewportSize({ width, height: 900 });
      const origin = new URL(baseURL ?? "http://localhost").origin;
      await page.route("**/*", (route) =>
        route.request().url().startsWith(origin) || route.request().url().startsWith("data:")
          ? route.continue()
          : route.abort(),
      );
      await page.goto("/design", { waitUntil: "load" });
      await page.waitForFunction(() => document.documentElement.dataset.designStates === "ready");
      await page.evaluate(() => document.fonts.ready);
      // Next's dev-mode indicator is not part of the page.
      await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });

      const panel = page.locator(`[data-design-mode="${mode}"]`);
      await expect(panel).toHaveScreenshot(`design-${mode}-${width}.png`, {
        mask: [panel.locator("footer p").filter({ hasText: "©" })],
      });
    });
  }
}
