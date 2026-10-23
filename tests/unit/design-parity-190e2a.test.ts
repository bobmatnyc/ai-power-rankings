import { describe, expect, it } from "vitest";
import { diffSource } from "../../scripts/design-class-diff";
import { CLASS_MAPS } from "../../scripts/design-class-maps";
import { hslToHex } from "../../scripts/design-tokens";
import { describeTableParity, light, oldHex } from "./design-parity-suite";

/**
 * Parity map for #190 PR E2a (admin components and the SEO dashboard).
 *
 * Why: admin pages cannot be screenshotted (ruling D1), so the table in
 * `scripts/design-class-maps.ts` is the whole claim. A token whose value
 * drifts from the colour it replaced, a token of the wrong role, or a class
 * that `cn()` merges differently would pass the class-diff check unseen.
 * What: `describeTableParity("190e2a")` (tests/unit/design-parity-suite.ts)
 * checks each entry's light and dark value, role and merge group; this file
 * adds a one-step control and checks that the class-diff check passes the
 * table's substitutions and fails a wrong token, a dropped variant, a
 * half-mapped pair and a non-colour change.
 * Map and evidence: docs/refresh/design-audit/migration-190e2a.md.
 * Test: `npx vitest run tests/unit/design-parity-190e2a.test.ts`. No network.
 */

const map = CLASS_MAPS["190e2a"];

describeTableParity("190e2a");

describe("#190 PR E2a parity control", () => {
  it("fails on a one-step palette change", () => {
    // The value check must be able to fail: --ds-success-fixed is green-700, not green-600.
    expect(hslToHex(light.get("--ds-success-fixed") ?? "")).not.toBe(oldHex("text-green-600"));
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
