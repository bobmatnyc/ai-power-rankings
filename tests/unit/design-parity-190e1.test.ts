import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { hslToHex, tokensFor } from "../../scripts/design-tokens";

/**
 * Parity map for #190 PR E1 (public modals, contact form, error and
 * not-found pages, chart skeleton, crown icon, image placeholder).
 *
 * Why: E1 swaps palette classes and inline hex colours for existing `--ds-*`
 * tokens and must not change a pixel. A token whose value drifts from the
 * colour it replaced would pass every other check.
 * What: for each token E1 uses, resolves it in light and dark mode and
 * compares it with the colour the old class or inline style rendered in that
 * mode (the `dark:` class where there was one). An old inline hex is written
 * as the palette step it equals, and the test pins that equality too. Map and
 * pixel evidence: docs/refresh/design-audit/migration-190e1.md.
 * Test: `npx vitest run tests/unit/design-parity-190e1.test.ts`. No network.
 */

const root = join(__dirname, "..", "..");
const require = createRequire(import.meta.url);
const palette: Record<string, Record<string, string>> = require("tailwindcss/colors");
const globalsCss = readFileSync(join(root, "app", "globals.css"), "utf8");
const light = tokensFor(globalsCss, "light");
const dark = tokensFor(globalsCss, "dark");

/** `"green-600"` → `"#16a34a"`; `"white"` → `"#ffffff"`. */
function paletteHex(name: string): string {
  if (name === "white") return "#ffffff";
  const [hue, step] = name.split("-");
  return palette[hue][step].toLowerCase();
}

/** Token (no `--`) → palette colour of the old class or inline style, light then dark. */
const PARITY: ReadonlyArray<readonly [string, string, string]> = [
  // whats-new-modal icons, badge borders and skeletons.
  ["ds-accent-cat-purple-strong", "purple-600", "purple-600"],
  ["ds-accent-fixed", "blue-600", "blue-600"],
  ["ds-accent-cat-green-strong", "green-600", "green-600"],
  ["ds-accent-cat-orange-strong", "orange-600", "orange-600"],
  ...(["purple", "blue", "green", "orange"] as const).map(
    (hue) => [`ds-border-tag-${hue}`, `${hue}-200`, `${hue}-200`] as const,
  ),
  ["ds-surface-skeleton", "gray-200", "gray-200"],
  // changelog-modal.
  ["ds-success-fixed-mid", "green-600", "green-600"],
  ["ds-success-fixed", "green-700", "green-700"],
  // signup-for-updates-modal and contact-form.
  ["ds-surface-tag-blue", "blue-100", "blue-900"],
  ["ds-surface-tag-green", "green-100", "green-900"],
  ["ds-text-callout-success", "green-600", "green-400"],
  ["ds-success-fixed-border", "green-200", "green-200"],
  ["ds-danger-fixed-border", "red-200", "red-200"],
  ["ds-text-callout-danger", "red-600", "red-400"],
  ["ds-success-solid", "green-500", "green-500"],
  ["ds-accent-cat-blue", "blue-500", "blue-500"],
  // DynamicCharts skeleton and label, crown icon.
  ["ds-surface-paper-sunken", "gray-100", "gray-100"],
  ["ds-text-paper-subtle", "gray-500", "gray-500"],
  ["ds-accent-cat-yellow", "yellow-500", "yellow-500"],
  // error.tsx and not-found.tsx inline colours.
  ["ds-surface-paper-muted", "gray-50", "gray-50"],
  ["ds-surface-paper", "white", "white"],
  ["ds-text-on-fill", "white", "white"],
  ["ds-border-paper", "gray-200", "gray-200"],
];

/** The error and not-found pages' inline hex values, and the palette step each equals. */
const INLINE_HEX: ReadonlyArray<readonly [string, string]> = [
  ["#f9fafb", "gray-50"],
  ["#f3f4f6", "gray-100"],
  ["#e5e7eb", "gray-200"],
  ["#6b7280", "gray-500"],
  ["#3b82f6", "blue-500"],
];

describe("#190 PR E1 parity: each token renders the colour it replaced", () => {
  it.each(PARITY)("--%s is %s in light and %s in dark", (token, lightName, darkName) => {
    expect(hslToHex(light.get(`--${token}`) ?? ""), `--${token} light`).toBe(paletteHex(lightName));
    expect(hslToHex(dark.get(`--${token}`) ?? ""), `--${token} dark`).toBe(paletteHex(darkName));
  });

  it.each(INLINE_HEX)("inline %s is %s", (hex, name) => {
    expect(paletteHex(name)).toBe(hex);
  });

  it("keeps the tag surfaces opaque in light and at 30 % in dark, as dark:bg-<hue>-900/30 was", () => {
    expect(light.get("--ds-opacity-tag-surface")).toBe("1");
    expect(dark.get("--ds-opacity-tag-surface")).toBe("0.3");
  });

  it("fails on a one-step palette change", () => {
    // The check above must be able to fail: --ds-success-fixed is green-700, not green-600.
    expect(hslToHex(light.get("--ds-success-fixed") ?? "")).not.toBe(paletteHex("green-600"));
  });
});
