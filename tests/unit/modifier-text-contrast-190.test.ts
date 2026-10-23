import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contrast, hslToHex, tokensFor, type Mode } from "../../scripts/design-tokens";

/**
 * Success and warning modifier text meets AA in both modes (#190 PR C1).
 *
 * Why: the rankings table and the comparison table show success/warning text
 * on a card that is white in light mode and near-black in dark mode. A fixed
 * (one-value) token tuned for white fell to 3.99:1 on the dark card.
 * What: reads the `text-ds-success*` and `text-ds-warning*` classes in each
 * listed file and requires the token each names to reach 4.5:1 on
 * `--ds-surface`, `--ds-surface-raised` and `--ds-surface-muted` (the card,
 * and the row hover) in light and dark mode.
 * Test: `npx vitest run tests/unit/modifier-text-contrast-190.test.ts`. No network.
 */

const root = join(__dirname, "..", "..");
const globalsCss = readFileSync(join(root, "app", "globals.css"), "utf8");
const MODES: Mode[] = ["light", "dark"];
const SURFACES = ["ds-surface", "ds-surface-raised", "ds-surface-muted"];
const SITES = ["components/ranking/rankings-content.tsx", "components/seo/comparison-table.tsx"];
const CLASS = /(?<![\w-])text-(ds-(?:success|warning)(?:-[a-z]+)*)(?![\w-])/g;

const CASES = SITES.flatMap((file) => {
  const tokens = [...new Set([...readFileSync(join(root, file), "utf8").matchAll(CLASS)].map((m) => m[1]))];
  return tokens.flatMap((token) =>
    MODES.flatMap((mode) => SURFACES.map((bg) => [`${file}: ${mode} --${token} on --${bg}`, mode, token, bg] as const)),
  );
});

describe("success/warning modifier text, AA in both modes (#190)", () => {
  it("finds the modifier classes in every listed file", () => {
    for (const file of SITES) expect(CASES.some(([name]) => name.startsWith(file)), file).toBe(true);
  });

  it.each(CASES)("%s", (_name, mode, token, bg) => {
    const tokens = tokensFor(globalsCss, mode);
    const ratio = contrast(hslToHex(tokens.get(`--${token}`) ?? ""), hslToHex(tokens.get(`--${bg}`) ?? ""));
    expect(ratio, `${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
  });
});
