import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { twMerge } from "tailwind-merge";
import { describe, expect, it } from "vitest";
import { CLASS_MAPS } from "../../scripts/design-class-maps";
import { hslToHex, tokensFor } from "../../scripts/design-tokens";

/**
 * Shared parity checks for a `scripts/design-class-maps.ts` set (#190 D1).
 *
 * Why: E2a and E2b each prove their table the same way; one suite keeps the
 * two proofs from drifting apart.
 * What: `describeTableParity(set)` registers, for every table entry, (1) the
 * token's light and dark HSL equal the old colour's sRGB channels to 0.05 of
 * a step, with the old side read from the independent `tailwindcss/colors`
 * palette and the new side from app/globals.css; (2) the token has the role
 * of the class it replaces; (3) `tailwind-merge` drops the same conflicting
 * classes for the token class as for the old one.
 * Test: `tests/unit/design-parity-190e2a.test.ts`,
 * `tests/unit/design-parity-190e2b.test.ts`.
 */

const root = join(__dirname, "..", "..");
const require = createRequire(import.meta.url);
const palette: Record<string, Record<string, string>> = require("tailwindcss/colors");
const globalsCss = readFileSync(join(root, "app", "globals.css"), "utf8");
export const light = tokensFor(globalsCss, "light");
export const dark = tokensFor(globalsCss, "dark");

/** `"bg-green-600"` → `"#16a34a"`; `"text-white"` → `"#ffffff"`; a hex stays. */
export function oldHex(name: string): string {
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

// Families any utility may use; the others belong to one role.
const ROLE_NEUTRAL = /^--ds-(?:accent|success|danger|warning|info)-/;
const ROLE: Record<string, RegExp> = { text: /^--ds-text-/, bg: /^--ds-surface-/, border: /^--ds-border-/ };
const PROBES: Record<string, string[]> = {
  text: ["text-foreground", "text-accent-foreground", "text-sm"],
  bg: ["bg-background", "bg-card", "bg-cover"],
  border: ["border-input", "border", "border-2"],
};

/** Registers the value, role and merge-group checks for one table set. */
export function describeTableParity(setName: string): void {
  const map = CLASS_MAPS[setName];
  const classRows = Object.entries(map.classes);
  const pairRows = Object.entries(map.pairs);
  const inlineRows = Object.entries(map.inline);
  const label = `#190 ${setName}`;

  describe(`${label} parity: each token renders the colour it replaced`, () => {
    it("has at least one table entry", () => {
      expect(classRows.length + pairRows.length + inlineRows.length).toBeGreaterThan(0);
    });

    it.each(classRows)("%s → %s, light and dark", (oldClass, newClass) => {
      expectExact(tokenName(newClass), "light", oldHex(oldClass));
      expectExact(tokenName(newClass), "dark", oldHex(oldClass));
    });

    if (pairRows.length > 0) {
      it.each(pairRows)("%s → %s", (oldPair, newClass) => {
        const [lightClass, darkClass] = oldPair.split(" ");
        expectExact(tokenName(newClass), "light", oldHex(lightClass));
        expectExact(tokenName(newClass), "dark", oldHex(darkClass));
      });
    }

    if (inlineRows.length > 0) {
      it.each(inlineRows)("inline %s → %s, light and dark", (hex, value) => {
        expectExact(tokenName(value), "light", hex);
        expectExact(tokenName(value), "dark", hex);
      });
    }
  });

  describe(`${label}: each token class keeps the old class's role and merge group`, () => {
    it.each([...classRows, ...pairRows])("%s → %s uses a token of the same role", (_, newClass) => {
      const utility = newClass.split("-")[0];
      const token = tokenName(newClass);
      expect(ROLE_NEUTRAL.test(token) || ROLE[utility].test(token), `${newClass} is not a ${utility} token`).toBe(true);
    });

    it.each(classRows)("cn() merges %s and %s the same way", (oldClass, newClass) => {
      for (const prefix of ["", "hover:"]) {
        for (const probe of PROBES[oldClass.split("-")[0]]) {
          const keeps = (cls: string) =>
            twMerge(`${prefix}${probe} ${prefix}${cls}`).split(" ").includes(`${prefix}${probe}`);
          expect(keeps(newClass), `${prefix}${probe} with ${prefix}${newClass}`).toBe(keeps(oldClass));
        }
      }
    });
  });
}
