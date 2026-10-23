import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import colors from "tailwindcss/colors";
import { describe, expect, it } from "vitest";
import {
  AGENT_ACCENT,
  agentContrast,
  GRAPHIC_MINIMUM,
  hslToRgb,
  ICON_SWATCHES,
  MODE_TOKENS,
  type Mode,
  PALETTE,
  type PaletteStep,
  TEXT_MINIMUM,
  TIER_SWATCHES,
  worstContrast,
} from "../../app/design/option-data";
import { getTierColor } from "../../lib/ranking-utils";
import { tokensFor } from "../../scripts/design-tokens";

/**
 * #190 C2: the shipped Option B fills and the Agents-card accent.
 *
 * Why: ToolIcon, TierLegend and getTierColor moved to tokens so a white glyph
 * or the band text meets its contrast minimum; the /design ratios must
 * describe what production draws, and every class must compile (a missing
 * Tailwind colour emits nothing, as `destructive` once did).
 * What: checks app/design/option-data.ts against the Tailwind palette, the
 * --ds-* tokens in app/globals.css and the three production components;
 * that every from-/to-/bg-/text-/border-ds class it names compiles; that
 * each shipped fill meets 3:1 (icon glyphs) or 4.5:1 (tier letters) in both
 * modes; and that the Agents-card accent meets AA for its link and badge
 * text and matches app/[lang]/page.tsx.
 * Test: `npx vitest run tests/unit/design-options-190.test.ts`. No network.
 */

const root = join(__dirname, "..", "..");
const require = createRequire(import.meta.url);
const tailwindConfig = require(join(root, "tailwind.config.js"));
const read = (...path: string[]) => readFileSync(join(root, ...path), "utf8");
const globalsCss = read("app", "globals.css");
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

describe("C2 data matches the palette, app/globals.css and the components (#190)", () => {
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

  it("declares each --ds-grad-* token at its palette value, to 1e-6 of a channel", () => {
    const grad = [...tokensFor(globalsCss, "light").entries()].filter(([name]) => name.startsWith("--ds-grad-"));
    expect(grad.map(([name]) => name.replace("--ds-grad-", "")).sort()).toEqual(
      ICON_SWATCHES.flatMap((s) => s.stops.map((c) => ("palette" in c ? c.palette : ""))).sort(),
    );
    for (const [name, value] of grad) {
      const step = name.replace("--ds-grad-", "") as PaletteStep;
      expect(hslToRgb(value), name).toEqual([...PALETTE[step]]);
      hslToFloat(value).forEach((channel, i) => expect(Math.abs(channel - PALETTE[step][i]), name).toBeLessThan(1e-6));
    }
  });

  it("uses the same classes as ToolIcon, TierLegend and getTierColor", () => {
    const toolIcon = read("components", "ui", "tool-icon.tsx");
    const legend = read("components", "ranking", "tier-legend.tsx");
    for (const { hue, className } of ICON_SWATCHES) expect(toolIcon, hue).toContain(`"${className}"`);
    for (const { tier, className } of TIER_SWATCHES) {
      expect(legend, tier).toContain(`"${className}"`);
      expect(getTierColor(tier)).toBe(`${className} border-0`);
    }
    // #190 C2: no palette gradient stops remain in the three components.
    for (const source of [toolIcon, legend, read("lib", "ranking-utils.ts")]) {
      expect(source).not.toMatch(/(?<![\w-])(?:from|to)-(?!ds-)[a-z]+-\d{3}\b/);
    }
  });

  it("names only classes Tailwind emits", async () => {
    const source = read("app", "design", "option-data.ts");
    const classes = [...new Set(source.match(/(?<![\w-])(?:hover:)?(?:from|to|bg|text|border)-ds-[a-z0-9-]+(?:\/\d+)?/g))];
    expect(classes.length).toBeGreaterThan(25);
    const css = (
      await postcss([tailwindcss({ ...tailwindConfig, content: [{ raw: classes.join(" ") }] })]).process(
        "@tailwind utilities;",
        { from: undefined },
      )
    ).css.replace(/\\/g, "");
    for (const cls of classes) expect(css, `${cls} compiles`).toContain(`.${cls}`);
    expect(css).toContain("--tw-gradient-from: hsl(var(--ds-grad-blue-500))");
    expect(css).toContain("--tw-gradient-to: hsl(var(--ds-grad-teal-800))");
  });
});

describe("C2 shipped fills meet their contrast minimum (#190)", () => {
  it.each(MODES)("%s mode", (mode) => {
    expect(ICON_SWATCHES.map((s) => s.hue)).toEqual(["blue", "purple", "green", "orange", "pink", "indigo", "teal", "red", "gray"]);
    for (const swatch of ICON_SWATCHES) {
      const ratio = worstContrast({ token: "ds-text-on-fill" }, swatch.stops, mode);
      expect(ratio, `${swatch.hue} icon = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(GRAPHIC_MINIMUM);
    }
    for (const swatch of TIER_SWATCHES) {
      const ratio = worstContrast(swatch.text, swatch.stops, mode);
      expect(ratio, `tier ${swatch.tier} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(TEXT_MINIMUM);
    }
  });
});

// #190 C2: the purple accent shipped; the card itself is checked in agent-card-accent-190.test.ts.
describe("C2 Autonomous Agents card accent (#190)", () => {
  it.each(MODES)("meets AA for link text and badge text, %s mode", (mode) => {
    const { text, badge } = agentContrast(AGENT_ACCENT, mode);
    expect(text, `text = ${text.toFixed(2)}`).toBeGreaterThanOrEqual(TEXT_MINIMUM);
    expect(badge, `badge = ${badge.toFixed(2)}`).toBeGreaterThanOrEqual(TEXT_MINIMUM);
  });

  it("uses the classes the home page card uses", () => {
    const page = read("app", "[lang]", "page.tsx");
    for (const cls of [AGENT_ACCENT.border, AGENT_ACCENT.badge, AGENT_ACCENT.text]) expect(page).toContain(cls);
  });
});
