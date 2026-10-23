import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import { describe, expect, it } from "vitest";
import {
  AA_PAIRS,
  contrast,
  hslToHex,
  layerRules,
  tokenLayer,
  tokensFor,
  type Mode,
} from "../../scripts/design-tokens";

/**
 * Regression tests for #188 — the design-system token layer.
 *
 * Why: the token layer is the base the #189 migration and the #190 components
 * build on. The issue's rubric asks for every token category in light and dark,
 * a Tailwind mapping, and no hard-coded colours in the layer; it must also stay
 * additive, so the #178 tokens and every existing variable keep their values.
 * What: reads the `#188 design-system tokens` region of app/globals.css and
 * checks (1) each rubric category has tokens in both modes and colour tokens
 * match across modes, (2) colours are HSL components and the layer holds no hex
 * or `rgb(`, (3) Tailwind with the repo config emits a `ds` utility for every
 * token, (4) text/surface pairs meet WCAG AA in both modes, (5) the layer only
 * declares new `--ds-*` names and the #178 tokens are unchanged.
 * Test: `npx vitest run tests/unit/design-tokens-188.test.ts`. No network.
 */

const root = join(__dirname, "..", "..");
const require = createRequire(import.meta.url);
const tailwindConfig = require(join(root, "tailwind.config.js"));
const globalsCss = readFileSync(join(root, "app", "globals.css"), "utf8");

const MODES: Mode[] = ["light", "dark"];

/** The section 2(a) rubric categories, each as the token-name prefix that belongs to it. */
const RUBRIC: Record<string, RegExp> = {
  surface: /^--ds-surface/,
  text: /^--ds-text/,
  border: /^--ds-(border|focus-ring)/,
  accent: /^--ds-accent/,
  status: /^--ds-(success|warning|danger|info)/,
  "score bands": /^--ds-score-/,
  "type scale": /^--ds-(font-size|line-height|font-weight)-/,
  spacing: /^--ds-space-/,
  radius: /^--ds-radius-/,
  shadow: /^--ds-shadow-/,
  motion: /^--ds-(duration|ease)-/,
};

const COLOUR_CATEGORIES = ["surface", "text", "border", "accent", "status", "score bands"];
const HSL_COMPONENTS = /^\d+(\.\d+)? \d+(\.\d+)?% \d+(\.\d+)?%$/;

function isColour(name: string): boolean {
  return name === "--ds-shadow-color" || COLOUR_CATEGORIES.some((c) => RUBRIC[c].test(name));
}

/** The Tailwind class each token maps to, and the CSS it must compile to. */
function utilityFor(name: string): [string, string] {
  const rest = name.replace(/^--ds-/, "");
  const prefixed: Array<[RegExp, string]> = [
    [/^font-size-/, "text-ds-"],
    [/^line-height-/, "leading-ds-"],
    [/^font-weight-/, "font-ds-"],
    [/^space-/, "p-ds-"],
    [/^radius-/, "rounded-ds-"],
    [/^shadow-/, "shadow-ds-"],
    [/^duration-/, "duration-ds-"],
    [/^ease-/, "ease-ds-"],
  ];
  for (const [prefix, utility] of prefixed) {
    if (prefix.test(rest)) return [`${utility}${rest.replace(prefix, "")}`, `var(${name})`];
  }
  // #190: no closing paren, so a token mapped with `/ <alpha-value>` (the
  // overlay, used as `bg-ds-surface-overlay/80`) also matches.
  return [`bg-ds-${rest}`, `hsl(var(${name})`];
}

async function compile(classes: string[]): Promise<string> {
  const result = await postcss([
    tailwindcss({ ...tailwindConfig, content: [{ raw: classes.join(" ") }] }),
  ]).process("@tailwind utilities;", { from: undefined });
  return result.css;
}

describe("design-system token layer (#188)", () => {
  it.each(Object.keys(RUBRIC))("declares %s tokens in :root and .dark", (category) => {
    for (const mode of MODES) {
      const names = [...tokensFor(globalsCss, mode).keys()].filter((n) => RUBRIC[category].test(n));
      expect(names.length, `${category} tokens in ${mode}`).toBeGreaterThan(0);
    }
  });

  it("gives every colour token a dark value and declares nothing outside the rubric", () => {
    const light = tokensFor(globalsCss, "light");
    const dark = tokensFor(globalsCss, "dark");
    const lightColours = [...light.keys()].filter(isColour).sort();
    const darkColours = [...dark.keys()].filter(isColour).sort();
    expect(darkColours).toEqual(lightColours);
    for (const name of light.keys()) {
      expect(
        Object.values(RUBRIC).some((re) => re.test(name)),
        `${name} belongs to a rubric category`,
      ).toBe(true);
    }
  });

  it("writes colours as HSL components and holds no hex or rgb( values", () => {
    const declarations = tokenLayer(globalsCss).replace(/\/\*[\s\S]*?\*\//g, "");
    expect(declarations).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(declarations).not.toMatch(/\brgba?\(/i);
    for (const mode of MODES) {
      for (const [name, value] of tokensFor(globalsCss, mode)) {
        if (isColour(name)) expect(value, `${name} (${mode})`).toMatch(HSL_COMPONENTS);
      }
    }
  });

  it("maps every token to a Tailwind ds utility", async () => {
    const pairs = [...tokensFor(globalsCss, "light").keys()]
      .filter((name) => name !== "--ds-shadow-color")
      .map(utilityFor);
    const css = await compile(pairs.map(([cls]) => cls));
    for (const [cls, expected] of pairs) {
      expect(css, `${cls} emits ${expected}`).toContain(expected);
    }
    // Spot-check the exact declarations for one utility per category family.
    expect(css).toContain("background-color: hsl(var(--ds-surface))");
    expect(css).toContain("font-size: var(--ds-font-size-body)");
    expect(css).toContain("padding: var(--ds-space-md)");
    expect(css).toContain("border-radius: var(--ds-radius-card)");
    expect(css).toContain("transition-duration: var(--ds-duration-base)");
  });

  it.each(MODES)("meets WCAG AA (4.5:1) for every text/surface pair in %s mode", (mode) => {
    const tokens = tokensFor(globalsCss, mode);
    for (const [fg, bg] of AA_PAIRS) {
      const ratio = contrast(hslToHex(tokens.get(`--${fg}`) ?? ""), hslToHex(tokens.get(`--${bg}`) ?? ""));
      expect(ratio, `--${fg} on --${bg} (${mode}) = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("only adds --ds-* names and leaves the #178 tokens unchanged", () => {
    for (const { body } of layerRules(tokenLayer(globalsCss))) {
      for (const decl of body.matchAll(/(--[\w-]+)\s*:/g)) {
        expect(decl[1], "layer declares only --ds-* tokens").toMatch(/^--ds-/);
        expect(["--ds-rank-up", "--ds-rank-down", "--ds-rank-steady"]).not.toContain(decl[1]);
      }
    }
    for (const fixed of [
      "--ds-rank-up: 142.1 76.2% 36.3%;",
      "--ds-rank-down: 0 72.2% 50.6%;",
      "--ds-rank-steady: 220 8.9% 46.1%;",
      "--ds-space-inline: 0.25rem;",
      "--ds-radius-chip: 9999px;",
      "--ds-font-size-delta: var(--font-size-sm);",
      "--ds-rank-up: 141.9 69.2% 58%;",
      "--ds-rank-down: 0 90.6% 70.8%;",
      "--ds-rank-steady: 217.9 10.6% 64.9%;",
    ]) {
      expect(globalsCss, `#178 token ${fixed}`).toContain(fixed);
    }
  });
});
