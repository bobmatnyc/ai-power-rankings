import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { hslToHex, tokensFor } from "../../scripts/design-tokens";

/**
 * Parity map for #190 PR D (news, what's-new, SEO and best-* pages).
 *
 * Why: PR D swaps palette classes for `--ds-*` tokens and must not change a
 * pixel. A token whose HSL value drifts from the palette colour it replaced
 * would pass every other check.
 * What: for each token PR D introduced or reused, resolves the token in light
 * and dark mode and compares it with the Tailwind palette colour the old class
 * rendered in that mode (the `dark:` class where there was one). It also pins
 * the what's-new tag surfaces' alpha: opaque in light, 30 % in dark, as
 * `dark:bg-<hue>-900/30` was. Map and pixel evidence:
 * docs/refresh/design-audit/migration-190d.md.
 * Test: `npx vitest run tests/unit/design-parity-190d.test.ts`. No network.
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

/** Token (no `--`) → palette colour of the old class, light then dark. */
const PARITY: ReadonlyArray<readonly [string, string, string]> = [
  // best-* pages: icons, category dots, CTA text.
  ["ds-text-on-fill", "white", "white"],
  ["ds-accent-cat-yellow", "yellow-500", "yellow-500"],
  ["ds-accent-cat-orange", "orange-500", "orange-500"],
  ["ds-accent-cat-blue", "blue-500", "blue-500"],
  ["ds-accent-cat-green", "green-500", "green-500"],
  ["ds-accent-cat-purple", "purple-500", "purple-500"],
  // Category icons on what's-new and news.
  ["ds-accent-fixed", "blue-600", "blue-600"],
  ["ds-accent-cat-purple-strong", "purple-600", "purple-600"],
  ["ds-accent-cat-green-strong", "green-600", "green-600"],
  ["ds-accent-cat-orange-strong", "orange-600", "orange-600"],
  ["ds-accent-cat-yellow-strong", "yellow-600", "yellow-600"],
  ["ds-accent-cat-emerald-strong", "emerald-600", "emerald-600"],
  ["ds-accent-cat-indigo-strong", "indigo-600", "indigo-600"],
  ["ds-accent-cat-slate-strong", "slate-600", "slate-600"],
  // News gain/loss text and impact panels.
  ["ds-success-solid", "green-500", "green-500"],
  ["ds-danger-solid", "red-500", "red-500"],
  ["ds-success-fixed-mid", "green-600", "green-600"],
  ["ds-success-fixed-soft", "green-400", "green-400"],
  ["ds-success-fixed-subtle", "green-50", "green-50"],
  ["ds-success-fixed-border", "green-200", "green-200"],
  ["ds-danger-fixed", "red-600", "red-600"],
  ["ds-danger-fixed-soft", "red-400", "red-400"],
  ["ds-danger-fixed-subtle", "red-50", "red-50"],
  ["ds-danger-fixed-border", "red-200", "red-200"],
  ["ds-text-paper-muted", "gray-600", "gray-600"],
  ["ds-text-paper-subtle", "gray-500", "gray-500"],
  ["ds-text-paper-faint", "gray-400", "gray-400"],
  ["ds-surface-paper-muted", "gray-50", "gray-50"],
  ["ds-border-paper", "gray-200", "gray-200"],
  // What's-new kind badges and card edges.
  ...(["purple", "blue", "green", "orange"] as const).flatMap(
    (hue) =>
      [
        [`ds-surface-tag-${hue}`, `${hue}-100`, `${hue}-900`],
        [`ds-text-tag-${hue}`, `${hue}-800`, `${hue}-300`],
        [`ds-border-tag-${hue}`, `${hue}-200`, `${hue}-200`],
      ] as const,
  ),
  ["ds-border-neutral", "gray-200", "gray-700"],
  ["ds-border-neutral-hover", "gray-300", "gray-600"],
  // SEO callouts (QuickAnswerBox, ToolOverview).
  ["ds-surface-callout-success", "green-50", "green-950"],
  ["ds-border-callout-success", "green-200", "green-800"],
  ["ds-text-callout-success", "green-600", "green-400"],
  ["ds-text-callout-success-title", "green-700", "green-300"],
  ["ds-surface-callout-danger", "red-50", "red-950"],
  ["ds-border-callout-danger", "red-200", "red-800"],
  ["ds-text-callout-danger", "red-600", "red-400"],
  ["ds-text-callout-danger-title", "red-700", "red-300"],
  ["ds-surface-callout-info", "blue-50", "blue-950"],
  ["ds-border-callout-info", "blue-200", "blue-800"],
];

describe("#190 PR D parity: each token renders the palette colour it replaced", () => {
  it.each(PARITY)("--%s is %s in light and %s in dark", (token, lightName, darkName) => {
    expect(hslToHex(light.get(`--${token}`) ?? ""), `--${token} light`).toBe(paletteHex(lightName));
    expect(hslToHex(dark.get(`--${token}`) ?? ""), `--${token} dark`).toBe(paletteHex(darkName));
  });

  it("keeps the tag surfaces opaque in light and at 30 % in dark", () => {
    expect(light.get("--ds-opacity-tag-surface")).toBe("1");
    expect(dark.get("--ds-opacity-tag-surface")).toBe("0.3");
  });

  it("fails on a one-step palette change", () => {
    // The check above must be able to fail: green-700 is not green-600.
    expect(hslToHex(light.get("--ds-success-fixed") ?? "")).not.toBe(paletteHex("green-600"));
  });
});
