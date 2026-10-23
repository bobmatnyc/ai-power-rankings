import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { twMerge } from "tailwind-merge";
import { describe, expect, it } from "vitest";
import { diffSource } from "../../scripts/design-class-diff";
import { CLASS_MAPS } from "../../scripts/design-class-maps";
import { hslToHex, tokensFor } from "../../scripts/design-tokens";

/**
 * Parity map for #190 PR E2a (admin components and the SEO dashboard).
 *
 * Why: admin pages cannot be screenshotted (ruling D1), so the table in
 * `scripts/design-class-maps.ts` is the whole claim. A token whose value
 * drifts from the colour it replaced, a token of the wrong role, or a class
 * that `cn()` merges differently would pass the class-diff check unseen.
 * What: for each table entry, (1) the token's light and dark HSL equal the
 * old colour's sRGB channels to 0.05 of a step, not only after rounding;
 * (2) a text, background or border class maps to a text, surface or border
 * token, or to a role-neutral accent/status token; (3) `tailwind-merge`
 * drops the same conflicting classes for the token class as for the old one;
 * and (4) the class-diff check passes the table's substitutions and fails a
 * wrong token, a dropped variant, a half-mapped pair and a non-colour change.
 * Map and evidence: docs/refresh/design-audit/migration-190e2a.md.
 * Test: `npx vitest run tests/unit/design-parity-190e2a.test.ts`. No network.
 */

const root = join(__dirname, "..", "..");
const require = createRequire(import.meta.url);
const palette: Record<string, Record<string, string>> = require("tailwindcss/colors");
const globalsCss = readFileSync(join(root, "app", "globals.css"), "utf8");
const light = tokensFor(globalsCss, "light");
const dark = tokensFor(globalsCss, "dark");
const map = CLASS_MAPS["190e2a"];

/** `"bg-green-600"` → `"#16a34a"`; `"text-white"` → `"#ffffff"`; a hex stays. */
function oldHex(name: string): string {
  if (name.startsWith("#")) return name;
  const colour = name.replace(/^(?:[a-z]+:)*(?:text|bg|border)-/, "");
  if (colour === "white") return "#ffffff";
  if (colour === "black") return "#000000";
  const [hue, step] = colour.split("-");
  return palette[hue][step].toLowerCase();
}

/** `"bg-ds-surface-paper"` or `"hsl(var(--ds-surface-paper))"` → `"--ds-surface-paper"`. */
function tokenName(value: string): string {
  const fromVar = /var\((--ds-[\w-]+)\)/.exec(value);
  return fromVar ? fromVar[1] : `--${value.replace(/^(?:text|bg|border)-/, "")}`;
}

/** Unrounded sRGB channels (0-255) of an HSL token value. */
function channels(hsl: string): number[] {
  const [h, s, l] = hsl.split(/\s+/).map((part) => Number.parseFloat(part));
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    return (l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255;
  };
  return [channel(0), channel(8), channel(4)];
}

function expectExact(token: string, mode: "light" | "dark", hex: string): void {
  const value = (mode === "light" ? light : dark).get(token) ?? light.get(token) ?? "";
  expect(hslToHex(value), `${token} ${mode}`).toBe(hex);
  const want = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
  channels(value).forEach((got, k) => {
    expect(Math.abs(got - want[k]), `${token} ${mode} channel ${k}`).toBeLessThan(0.05);
  });
}

const classRows = Object.entries(map.classes);
const pairRows = Object.entries(map.pairs);
const inlineRows = Object.entries(map.inline);

describe("#190 PR E2a parity: each token renders the colour it replaced", () => {
  it.each(classRows)("%s → %s, light and dark", (oldClass, newClass) => {
    expectExact(tokenName(newClass), "light", oldHex(oldClass));
    expectExact(tokenName(newClass), "dark", oldHex(oldClass));
  });

  it.each(pairRows)("%s → %s", (oldPair, newClass) => {
    const [lightClass, darkClass] = oldPair.split(" ");
    expectExact(tokenName(newClass), "light", oldHex(lightClass));
    expectExact(tokenName(newClass), "dark", oldHex(darkClass));
  });

  it.each(inlineRows)("inline %s → %s, light and dark", (hex, value) => {
    expectExact(tokenName(value), "light", hex);
    expectExact(tokenName(value), "dark", hex);
  });

  it("fails on a one-step palette change", () => {
    // The check above must be able to fail: --ds-success-fixed is green-700, not green-600.
    expect(hslToHex(light.get("--ds-success-fixed") ?? "")).not.toBe(oldHex("text-green-600"));
  });
});

// Families any utility may use; the others belong to one role.
const ROLE_NEUTRAL = /^--ds-(?:accent|success|danger|warning|info)-/;
const ROLE: Record<string, RegExp> = { text: /^--ds-text-/, bg: /^--ds-surface-/, border: /^--ds-border-/ };

describe("#190 PR E2a: each token class keeps the old class's role and merge group", () => {
  it.each([...classRows, ...pairRows])("%s → %s uses a token of the same role", (_, newClass) => {
    const utility = newClass.split("-")[0];
    const token = tokenName(newClass);
    expect(ROLE_NEUTRAL.test(token) || ROLE[utility].test(token), `${newClass} is not a ${utility} token`).toBe(true);
  });

  const PROBES: Record<string, string[]> = {
    text: ["text-foreground", "text-accent-foreground", "text-sm"],
    bg: ["bg-background", "bg-card", "bg-cover"],
    border: ["border-input", "border", "border-2"],
  };
  it.each(classRows)("cn() merges %s and %s the same way", (oldClass, newClass) => {
    for (const prefix of ["", "hover:"]) {
      for (const probe of PROBES[oldClass.split("-")[0]]) {
        const keeps = (cls: string) => twMerge(`${prefix}${probe} ${prefix}${cls}`).split(" ").includes(`${prefix}${probe}`);
        expect(keeps(newClass), `${prefix}${probe} with ${prefix}${newClass}`).toBe(keeps(oldClass));
      }
    }
  });
});

describe("#190 D1 class-diff check (scripts/design-class-diff.ts)", () => {
  const baseSource = [
    "// header",
    'const a = <div className="p-4 text-gray-600 hover:bg-gray-100 bg-black/50">x</div>;',
    'const b = cn("text-sm", ok ? "text-red-600 dark:text-red-400" : "text-orange-600 dark:text-orange-400");',
    'const c = { borderBottom: "1px solid #e5e7eb" };',
  ].join("\n");
  const changed = (lineA: string, lineB?: string) =>
    baseSource
      .replace(/^const a = .*$/m, lineA)
      .replace(/^const b = .*$/m, (line) => lineB ?? line.replace("text-red-600 dark:text-red-400", "text-ds-text-callout-danger"))
      .replace("#e5e7eb", "hsl(var(--ds-border-paper))");
  const good =
    'const a = <div className="p-4 text-ds-text-paper-muted hover:bg-ds-surface-paper-sunken bg-ds-surface-overlay/50">x</div>;';

  it("passes the table's substitutions, with variants, opacity, a pair and an inline hex", () => {
    const result = diffSource(baseSource, `// #190: comment\n${changed(good)}`, map);
    expect(result.failures).toEqual([]);
    expect(Object.values(result.substitutions).reduce((sum, n) => sum + n, 0)).toBe(5);
  });

  it.each([
    ["a wrong token", good.replace("text-ds-text-paper-muted", "text-ds-text-paper-subtle")],
    ["a dropped hover: variant", good.replace("hover:bg-ds-surface-paper-sunken", "bg-ds-surface-paper-sunken")],
    ["a dropped opacity modifier", good.replace("bg-ds-surface-overlay/50", "bg-ds-surface-overlay")],
    ["a changed non-colour class", good.replace("p-4", "p-3")],
  ])("fails on %s", (_, lineA) => {
    expect(diffSource(baseSource, changed(lineA), map).failures).toHaveLength(1);
  });

  it("fails on a pair's dark: variant dropped, or a light class mapped without its dark: partner", () => {
    const dropped = 'const b = cn("text-sm", ok ? "text-ds-danger-fixed" : "text-orange-600 dark:text-orange-400");';
    const half =
      'const b = cn("text-sm", ok ? "text-ds-text-callout-danger" : "text-ds-accent-cat-orange-strong dark:text-orange-400");';
    expect(diffSource(baseSource, changed(good, dropped), map).failures).toHaveLength(1);
    expect(diffSource(baseSource, changed(good, half), map).failures).toHaveLength(1);
  });
});
