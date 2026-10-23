import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NON_TEXT_PAIRS, contrast, hslToHex, tokensFor, type Mode } from "../../scripts/design-tokens";

/**
 * Non-text contrast for the focus ring and borders (#190, carried from #188).
 *
 * Why: WCAG 1.4.11 asks 3:1 for a focus indicator and for a border that is
 * the only edge of a control. The #188 test covers text pairs only.
 * What: for each `NON_TEXT_PAIRS` entry in light and dark, requires 3:1 unless
 * the pair is a named known exception. A known exception must still be below
 * 3:1, so the list shrinks when a token is fixed.
 * Test: `npx vitest run tests/unit/design-contrast-190.test.ts`. No network.
 */

const globalsCss = readFileSync(join(__dirname, "..", "..", "app", "globals.css"), "utf8");
const MODES: Mode[] = ["light", "dark"];
const NON_TEXT_MINIMUM = 3;

/**
 * Pairs below 3:1, as `<mode> <fg> on <bg>`.
 * #190 PR C1: `--ds-border` is a documented decorative exception. It draws
 * dividers and card edges, never the only edge of a control: cards also carry
 * a shadow, and form controls use `--ds-border-strong`, which now meets 3:1
 * and so is no longer listed.
 */
const KNOWN_EXCEPTIONS = new Set<string>([
  "light ds-border on ds-surface", // 1.23, decorative
  "light ds-border on ds-surface-raised", // 1.23, decorative
  "light ds-border on ds-surface-muted", // 1.13, decorative
  "dark ds-border on ds-surface", // 1.37, decorative
  "dark ds-border on ds-surface-raised", // 1.22, decorative
  "dark ds-border on ds-surface-muted", // 1.00, decorative, same value
]);

function ratio(mode: Mode, fg: string, bg: string): number {
  const tokens = tokensFor(globalsCss, mode);
  return contrast(hslToHex(tokens.get(`--${fg}`) ?? ""), hslToHex(tokens.get(`--${bg}`) ?? ""));
}

const CASES = MODES.flatMap((mode) => NON_TEXT_PAIRS.map(([fg, bg]) => [`${mode} ${fg} on ${bg}`, mode, fg, bg] as const));

describe("non-text contrast, 3:1 (#190)", () => {
  it.each(CASES)("%s", (name, mode, fg, bg) => {
    const value = ratio(mode, fg, bg);
    if (KNOWN_EXCEPTIONS.has(name)) {
      expect(value, `${name} = ${value.toFixed(2)} now meets 3:1; remove it from KNOWN_EXCEPTIONS`).toBeLessThan(
        NON_TEXT_MINIMUM,
      );
    } else {
      expect(value, `${name} = ${value.toFixed(2)}`).toBeGreaterThanOrEqual(NON_TEXT_MINIMUM);
    }
  });

  it("names only pairs that exist", () => {
    const names = new Set(CASES.map(([name]) => name));
    for (const name of KNOWN_EXCEPTIONS) expect(names.has(name), name).toBe(true);
  });
});
