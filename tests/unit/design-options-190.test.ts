import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import colors from "tailwindcss/colors";
import { describe, expect, it } from "vitest";
import {
  AGENT_ACCENTS,
  agentContrast,
  FAILING_ICON_HUES,
  FAILING_TIERS,
  GRADIENT_OPTIONS,
  GRAPHIC_MINIMUM,
  hslToRgb,
  MODE_TOKENS,
  type Mode,
  PALETTE,
  type PaletteStep,
  TEXT_MINIMUM,
  worstContrast,
} from "../../app/design/option-data";
import { tokensFor } from "../../scripts/design-tokens";

/**
 * The #190 C2 option comparison on `/design`.
 *
 * Why: the owner picks a gradient treatment and an Agents-card accent from
 * the rendered comparison and its contrast ratios; a value that drifted from
 * app/globals.css, or a class Tailwind does not emit, would show a wrong
 * sample or a wrong ratio.
 * What: checks that app/design/option-data.ts matches the Tailwind palette and
 * the --ds-* tokens in app/globals.css (the exact tokens to the channel, the
 * HSL ones to 1e-6), that every from-/to-/bg-/text-/border-ds class it names
 * compiles, that each option has all 9 icon hues and 5 tiers, and the
 * contrast claims: Option A equals Current, Option B passes everywhere, C's
 * B-treated fills pass, and the Agents-card accents pass AA except the
 * labelled amber light-mode badge.
 * Test: `npx vitest run tests/unit/design-options-190.test.ts`. No network.
 */

const root = join(__dirname, "..", "..");
const require = createRequire(import.meta.url);
const tailwindConfig = require(join(root, "tailwind.config.js"));
const globalsCss = readFileSync(join(root, "app", "globals.css"), "utf8");
const optionSource = readFileSync(join(root, "app", "design", "option-data.ts"), "utf8");
const MODES: Mode[] = ["light", "dark"];

const channels = (hex: string) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));

/** Unrounded sRGB channels (0-255) of HSL components. */
function hslToFloat(hsl: string): number[] {
  const [h, s, l] = hsl.split(/\s+/).map((part) => Number.parseFloat(part));
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  return [0, 8, 4].map((n) => {
    const k = (n + h / 30) % 12;
    return (l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255;
  });
}

describe("C2 option data matches the palette and app/globals.css (#190)", () => {
  it("holds Tailwind's palette channels", () => {
    for (const [step, rgb] of Object.entries(PALETTE)) {
      const [hue, shade] = step.split("-");
      const hex = (colors as unknown as Record<string, Record<string, string>>)[hue][shade];
      expect([...rgb], step).toEqual(channels(hex));
    }
  });

  it.each(MODES)("holds the %s-mode token values", (mode) => {
    const tokens = tokensFor(globalsCss, mode);
    for (const [name, value] of Object.entries(MODE_TOKENS[mode])) {
      expect(tokens.get(`--${name}`), `--${name} (${mode})`).toBe(value);
    }
  });

  it("declares each gradient token at its palette value", () => {
    const tokens = tokensFor(globalsCss, "light");
    const exact = [...tokens.entries()].filter(([name]) => name.startsWith("--ds-grad-exact-"));
    const hsl = [...tokens.entries()].filter(([name]) => /^--ds-grad-(?!exact-)/.test(name));
    expect(exact.length).toBe(22);
    expect(hsl.length).toBe(18);
    for (const [name, value] of exact) {
      const step = name.replace("--ds-grad-exact-", "") as PaletteStep;
      expect(value, name).toBe(PALETTE[step].join(" "));
    }
    for (const [name, value] of hsl) {
      const step = name.replace("--ds-grad-", "") as PaletteStep;
      expect(hslToRgb(value), name).toEqual([...PALETTE[step]]);
      hslToFloat(value).forEach((channel, i) => expect(Math.abs(channel - PALETTE[step][i]), name).toBeLessThan(1e-6));
    }
  });

  it("names only classes Tailwind emits", async () => {
    const classes = [...new Set(optionSource.match(/(?<![\w-])(?:hover:)?(?:from|to|bg|text|border)-ds-[a-z0-9-]+(?:\/\d+)?/g))];
    expect(classes.length).toBeGreaterThan(40);
    const css = (
      await postcss([tailwindcss({ ...tailwindConfig, content: [{ raw: classes.join(" ") }] })]).process(
        "@tailwind utilities;",
        { from: undefined },
      )
    ).css.replace(/\\/g, "");
    for (const cls of classes) expect(css, `${cls} compiles`).toContain(`.${cls}`);
    expect(css).toContain("--tw-gradient-from: rgb(var(--ds-grad-exact-blue-500))");
    expect(css).toContain("--tw-gradient-to: hsl(var(--ds-grad-teal-800))");
  });
});

describe("C2 gradient options (#190)", () => {
  it("renders all 9 icon hues and 5 tiers in every option", () => {
    expect(GRADIENT_OPTIONS.map((o) => o.id)).toEqual(["current", "a", "b", "c"]);
    for (const option of GRADIENT_OPTIONS) {
      expect(option.icons.map((i) => i.hue), option.id).toEqual([
        "blue", "purple", "green", "orange", "pink", "indigo", "teal", "red", "gray",
      ]);
      expect(option.tiers.map((t) => t.tier), option.id).toEqual(["S", "A", "B", "C", "D"]);
    }
  });

  it("lists exactly the fills a white glyph or letter puts below 3:1", () => {
    const current = GRADIENT_OPTIONS[0];
    const white = { token: "ds-text-on-fill" } as const;
    expect(current.icons.filter((i) => worstContrast(white, i.stops, "light") < GRAPHIC_MINIMUM).map((i) => i.hue)).toEqual([
      ...FAILING_ICON_HUES,
    ]);
    // Tier A (blue-500, 3.68) also fails 4.5 but is not in the brief's failing list, so C keeps it on A.
    expect(current.tiers.filter((t) => worstContrast(white, t.stops, "light") < GRAPHIC_MINIMUM).map((t) => t.tier)).toEqual([
      ...FAILING_TIERS,
    ]);
  });

  it.each(MODES)("A matches Current; B passes everywhere; C's darkened fills pass (%s)", (mode) => {
    const [current, a, b, c] = GRADIENT_OPTIONS;
    const ratios = (o: (typeof GRADIENT_OPTIONS)[number]) => ({
      icons: o.icons.map((i) => worstContrast({ token: "ds-text-on-fill" }, i.stops, mode)),
      tiers: o.tiers.map((t) => worstContrast(t.text, t.stops, mode)),
    });
    expect(ratios(a)).toEqual(ratios(current));
    for (const r of ratios(b).icons) expect(r).toBeGreaterThanOrEqual(GRAPHIC_MINIMUM);
    for (const r of ratios(b).tiers) expect(r).toBeGreaterThanOrEqual(TEXT_MINIMUM);
    const cr = ratios(c);
    c.icons.forEach((i, n) => FAILING_ICON_HUES.includes(i.hue as never) && expect(cr.icons[n], i.hue).toBeGreaterThanOrEqual(GRAPHIC_MINIMUM));
    c.tiers.forEach((t, n) => FAILING_TIERS.includes(t.tier) && expect(cr.tiers[n], t.tier).toBeGreaterThanOrEqual(TEXT_MINIMUM));
  });
});

describe("C2 Autonomous Agents card accents (#190)", () => {
  /** Below AA by design and labelled on /design; must stay below, so the label stays true. */
  const KNOWN_EXCEPTIONS = new Set(["amber light badge"]);

  it.each(MODES)("meets AA for link text and badge text, %s mode", (mode) => {
    for (const accent of AGENT_ACCENTS.filter((a) => a.id !== "current")) {
      const { text, badge } = agentContrast(accent, mode);
      for (const [kind, value] of [["text", text], ["badge", badge]] as const) {
        const name = `${accent.id} ${mode} ${kind}`;
        if (KNOWN_EXCEPTIONS.has(name)) expect(value, `${name} now passes; drop the exception`).toBeLessThan(TEXT_MINIMUM);
        else expect(value, `${name} = ${value.toFixed(2)}`).toBeGreaterThanOrEqual(TEXT_MINIMUM);
      }
    }
  });

  it("keeps the reference card on the destructive classes and the candidates off them", () => {
    const [current, ...candidates] = AGENT_ACCENTS;
    expect(current.badge).toBe("bg-destructive/10 text-destructive");
    for (const accent of candidates) expect(`${accent.border} ${accent.badge} ${accent.text}`).not.toMatch(/destructive/);
  });
});
