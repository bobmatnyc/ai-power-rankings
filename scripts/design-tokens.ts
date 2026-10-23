/**
 * Read the #188 design-system token layer out of app/globals.css.
 *
 * Why: the token test (tests/unit/design-tokens-188.test.ts) and the swatch
 * generator (scripts/build-design-swatches.ts) must read the same tokens the
 * same way, or the swatch page could show a token set the test never checked.
 * What: finds the region between the `#188 design-system tokens BEGIN/END`
 * markers, splits it into its rule blocks, and returns each token per mode
 * (`light` gets `:root` rules, `dark` gets `.dark` rules; a `:root, .dark`
 * rule feeds both). Also converts HSL components to hex and computes the WCAG
 * 2.x contrast ratio, so contrast can be checked without a browser.
 * Test: `npx vitest run tests/unit/design-tokens-188.test.ts`.
 */

export const LAYER_BEGIN = "/* #188 design-system tokens BEGIN";
export const LAYER_END = "/* #188 design-system tokens END";

export type Mode = "light" | "dark";
export type TokenMap = Map<string, string>;

/** The `--ds-*` region of globals.css, markers included. Throws when a marker is missing. */
export function tokenLayer(css: string): string {
  const start = css.indexOf(LAYER_BEGIN);
  const end = css.indexOf(LAYER_END);
  if (start < 0 || end < 0 || end < start) {
    throw new Error("app/globals.css has no #188 design-system token layer markers");
  }
  return css.slice(start, css.indexOf("*/", end) + 2);
}

/** Every rule in the layer as `{ selectors, body }`, comments stripped. */
export function layerRules(layer: string): Array<{ selectors: string[]; body: string }> {
  const text = layer.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules: Array<{ selectors: string[]; body: string }> = [];
  const rule = /([^{}]+)\{([^{}]*)\}/g;
  for (const match of text.matchAll(rule)) {
    const selectors = match[1].split(",").map((s) => s.trim()).filter(Boolean);
    rules.push({ selectors, body: match[2] });
  }
  return rules;
}

/** Tokens declared for one mode. A media-query override is ignored here. */
export function tokensFor(css: string, mode: Mode): TokenMap {
  const wanted = mode === "light" ? ":root" : ".dark";
  const layer = tokenLayer(css);
  // Rules inside @media blocks are conditional overrides, not the base value.
  const base = layer.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, "");
  const tokens: TokenMap = new Map();
  for (const { selectors, body } of layerRules(base)) {
    if (!selectors.includes(wanted)) continue;
    for (const decl of body.matchAll(/(--ds-[\w-]+)\s*:\s*([^;]+);/g)) {
      tokens.set(decl[1], decl[2].trim().replace(/\s+/g, " "));
    }
  }
  return tokens;
}

/** `"217 91% 59%"` → `"#3b82f6"`. */
export function hslToHex(hsl: string): string {
  const [h, s, l] = hsl.trim().split(/\s+/).map((part) => Number.parseFloat(part));
  if ([h, s, l].some((n) => Number.isNaN(n))) throw new Error(`not HSL components: "${hsl}"`);
  const sat = s / 100;
  const light = l / 100;
  const a = sat * Math.min(light, 1 - light);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    const value = light - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(value * 255).toString(16).padStart(2, "0");
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio of two hex colours, 1 to 21. */
export function contrast(hexA: string, hexB: string): number {
  const [hi, lo] = [luminance(hexA), luminance(hexB)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Text-on-surface pairs that must meet WCAG AA for normal text (4.5:1) in both
 * modes. `[foreground, background]`, token names without the `--` prefix.
 */
export const AA_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["ds-text", "ds-surface"],
  ["ds-text", "ds-surface-raised"],
  ["ds-text", "ds-surface-muted"],
  ["ds-text-muted", "ds-surface"],
  ["ds-text-muted", "ds-surface-raised"],
  ["ds-text-muted", "ds-surface-muted"],
  ["ds-text-inverse", "ds-surface-inverse"],
  ["ds-accent", "ds-surface"],
  ["ds-accent-fg", "ds-accent"],
  ["ds-accent-fg", "ds-accent-hover"],
  ["ds-text", "ds-accent-subtle"],
  ["ds-success", "ds-surface"],
  ["ds-success", "ds-success-subtle"],
  ["ds-warning", "ds-surface"],
  ["ds-warning", "ds-warning-subtle"],
  ["ds-danger", "ds-surface"],
  ["ds-danger", "ds-danger-subtle"],
  ["ds-info", "ds-surface"],
  ["ds-info", "ds-info-subtle"],
  ["ds-score-fg", "ds-score-s"],
  ["ds-score-fg", "ds-score-a"],
  ["ds-score-fg", "ds-score-b"],
  ["ds-score-fg", "ds-score-c"],
  ["ds-score-fg", "ds-score-d"],
  // #190 PR B: the footer's fixed colours.
  ["ds-text-footer", "ds-surface-footer"],
  ["ds-text-on-fill", "ds-surface-footer"],
  // #190 PR C1: the fixed success/warning text, on white. No component uses
  // them now; the tables use the mode-dependent tokens.
  ["ds-success-fixed", "ds-surface-paper"],
  ["ds-warning-fixed", "ds-surface-paper"],
  // #190 PR C1: `text-destructive-foreground` on a `bg-destructive` fill.
  ["ds-surface", "ds-danger"],
  // #190 C2: the Autonomous Agents card's link text on the card.
  ["ds-accent-agent", "ds-surface"],
];

/**
 * #190: non-text pairs that WCAG 1.4.11 holds to 3:1 — the focus ring and the
 * two border tokens against each surface they are drawn on.
 * `[foreground, background]`, token names without the `--` prefix.
 */
export const NON_TEXT_PAIRS: ReadonlyArray<readonly [string, string]> = ["ds-focus-ring", "ds-border", "ds-border-strong"]
  .flatMap((fg) => ["ds-surface", "ds-surface-raised", "ds-surface-muted"].map((bg) => [fg, bg] as const));
