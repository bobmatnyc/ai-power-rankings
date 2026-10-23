import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import postcss from "postcss";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import tailwindcss from "tailwindcss";
import colors from "tailwindcss/colors";
import { describe, expect, it } from "vitest";
import { RankingChange } from "../../components/ui/ranking-change";
import { contrast, tokensFor } from "../../scripts/design-tokens";

/**
 * Regression tests for #178 — the sample design-agent token set.
 *
 * Why: the spike commits a small `--ds-*` token set (docs/refresh/design-agent-spike.md)
 * and moves one existing component onto it without a visible change.
 * What: (1) Tailwind, run with the repo config, emits each `--ds-*` utility as
 * the matching CSS variable; (2) `RankingChange` renders those utilities, not
 * the palette classes it used before; (3) each colour token in app/globals.css,
 * light and dark, converts to the hex of its palette class (light rank-up is
 * green-700 since #190); (4) each rank colour meets AA on the page and card
 * surfaces in both modes.
 * Test: `npx vitest run tests/unit/design-tokens-178.test.ts`. No network.
 */

const root = join(__dirname, "..", "..");
const require = createRequire(import.meta.url);
const tailwindConfig = require(join(root, "tailwind.config.js"));
const globalsCss = readFileSync(join(root, "app", "globals.css"), "utf8");

async function compile(classes: string[]): Promise<string> {
  const result = await postcss([
    tailwindcss({ ...tailwindConfig, content: [{ raw: classes.join(" ") }] }),
  ]).process("@tailwind utilities;", { from: undefined });
  return result.css;
}

function hslToHex(hsl: string): string {
  const [h, s, l] = hsl
    .trim()
    .split(/\s+/)
    .map((part) => Number.parseFloat(part));
  const sat = s / 100;
  const light = l / 100;
  const a = sat * Math.min(light, 1 - light);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    const value = light - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(value * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

function tokenIn(block: "root" | "dark", name: string): string {
  const selector = block === "root" ? ":root" : ".dark";
  const start = globalsCss.indexOf(`${selector} {`);
  expect(start, `${selector} block in app/globals.css`).toBeGreaterThanOrEqual(0);
  const body = globalsCss.slice(start, globalsCss.indexOf("\n  }", start));
  const match = new RegExp(`--${name}:\\s*([^;]+);`).exec(body);
  expect(match, `--${name} in ${selector}`).not.toBeNull();
  return (match as RegExpExecArray)[1];
}

describe("design-agent sample tokens (#178)", () => {
  it("maps each --ds-* token to a Tailwind utility", async () => {
    const css = await compile([
      "text-ds-rank-up",
      "text-ds-rank-down",
      "text-ds-rank-steady",
      "gap-ds-inline",
      "rounded-ds-chip",
      "text-ds-delta",
    ]);
    expect(css).toContain("color: hsl(var(--ds-rank-up))");
    expect(css).toContain("color: hsl(var(--ds-rank-down))");
    expect(css).toContain("color: hsl(var(--ds-rank-steady))");
    expect(css).toContain("gap: var(--ds-space-inline)");
    expect(css).toContain("border-radius: var(--ds-radius-chip)");
    expect(css).toContain("font-size: var(--ds-font-size-delta)");
  });

  it.each([
    ["moved up", { previousRank: 5, currentRank: 2 }, "text-ds-rank-up"],
    ["moved down", { previousRank: 2, currentRank: 5 }, "text-ds-rank-down"],
    ["unchanged", { previousRank: 3, currentRank: 3 }, "text-ds-rank-steady"],
    ["new entry", { currentRank: 1 }, "text-ds-rank-up"],
  ])("RankingChange renders from the tokens when %s", (_label, props, expected) => {
    const html = renderToStaticMarkup(createElement(RankingChange, props));
    expect(html).toContain(expected);
    expect(html).toContain("gap-ds-inline");
    expect(html).not.toMatch(/text-(green|red|gray)-\d{3}/);
  });

  it.each([
    // #190: light rank-up moved from green-600 to green-700 to meet AA.
    ["ds-rank-up", colors.green[700], colors.green[400]],
    ["ds-rank-down", colors.red[600], colors.red[400]],
    ["ds-rank-steady", colors.gray[500], colors.gray[400]],
  ])("--%s equals its palette colour, light and dark", (name, light, dark) => {
    expect(hslToHex(tokenIn("root", name))).toBe(light);
    expect(hslToHex(tokenIn("dark", name))).toBe(dark);
  });

  // #190: the rank colours are text on cards (--ds-surface-raised) and on the
  // page (--ds-surface), so each must meet AA (4.5:1) there in both modes.
  it.each(
    (["light", "dark"] as const).flatMap((mode) =>
      ["ds-rank-up", "ds-rank-down", "ds-rank-steady"].flatMap((fg) =>
        ["ds-surface", "ds-surface-raised"].map((bg) => [mode, fg, bg] as const),
      ),
    ),
  )("%s --%s on --%s meets AA", (mode, fg, bg) => {
    const surface = tokensFor(globalsCss, mode).get(`--${bg}`) ?? "";
    const ratio = contrast(hslToHex(tokenIn(mode === "light" ? "root" : "dark", fg)), hslToHex(surface));
    expect(ratio, `${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
  });
});
