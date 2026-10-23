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

/**
 * #190 C2: Option A (exact-value tokens) must draw the same pixels as the
 * production classes, or its "no pixel change" label on /design is false.
 * What: clones each Current and Option A fill (9 tool icons, 5 tier rows) to
 * the same integer position, so layout offsets cannot differ, and requires
 * byte-identical screenshots in both modes.
 */
test("C2 Option A fills match Current pixel for pixel", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/design", { waitUntil: "load" });
  await page.waitForFunction(() => document.documentElement.dataset.designStates === "ready");
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
  const swatches = await page
    .locator('[data-design-mode="light"] [data-design-component="gradient-option"][data-design-state="current"] [data-swatch]')
    .evaluateAll((els) => els.map((el) => el.getAttribute("data-swatch") ?? ""));
  expect(swatches).toHaveLength(14);

  const differing: string[] = [];
  for (const mode of MODES) {
    for (const swatch of swatches) {
      const shots: Buffer[] = [];
      for (const option of ["current", "a"]) {
        await page.evaluate(
          ({ mode, swatch, option }) => {
            const source = document.querySelector(
              `[data-design-mode="${mode}"] [data-design-component="gradient-option"][data-design-state="${option}"] [data-swatch="${swatch}"] > :first-child`,
            );
            if (!source) throw new Error(`${mode} ${option} ${swatch} not found`);
            const host = document.createElement("div");
            host.id = "c2-parity";
            host.className = mode === "dark" ? "dark bg-background" : "bg-background";
            host.style.cssText = "position:fixed;left:0;top:0;z-index:2147483647;padding:8px;width:360px";
            host.appendChild(source.cloneNode(true));
            document.body.appendChild(host);
          },
          { mode, swatch, option },
        );
        shots.push(await page.screenshot({ clip: { x: 0, y: 0, width: 360, height: 64 } }));
        await page.evaluate(() => document.getElementById("c2-parity")?.remove());
      }
      if (!shots[0].equals(shots[1])) differing.push(`${mode} ${swatch}`);
    }
  }
  expect(differing).toEqual([]);
});
