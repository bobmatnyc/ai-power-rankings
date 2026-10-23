import { describe, expect, it } from "vitest";
import { diffSource } from "../../scripts/design-class-diff";
import { CLASS_MAPS } from "../../scripts/design-class-maps";
import { hslToHex } from "../../scripts/design-tokens";
import { dark, describeTableParity, light, oldHex } from "./design-parity-suite";

/**
 * Parity map for #190 PR E2b (auth components; E2b-2 adds the authenticated
 * pages to the same set).
 *
 * Why: the auth header renders on every public page, and the sign-in states
 * need a live auth provider, so the table in `scripts/design-class-maps.ts`
 * (set `190e2b`) is the claim the class-diff and pixel checks rest on.
 * What: `describeTableParity("190e2b")` (tests/unit/design-parity-suite.ts)
 * checks each entry's light and dark value against the `tailwindcss/colors`
 * palette, its role and its merge group. This file adds a light-only control
 * (a token that matches in light but not in dark must not count) and checks
 * that the class-diff check passes the E2b substitutions and fails a wrong
 * token, a dropped `hover:` variant and a half-mapped `hover:`/`dark:hover:`
 * pair, and (E2b-2) passes interleaved light/dark pairs while failing a light
 * class mapped alone or a dropped `dark:` class.
 * Map and evidence: docs/refresh/design-audit/migration-190e2b.md.
 * Test: `npx vitest run tests/unit/design-parity-190e2b.test.ts`. No network.
 */

const map = CLASS_MAPS["190e2b"];

describeTableParity("190e2b");

describe("#190 PR E2b parity control", () => {
  it("tells a light-only match from a match in both modes", () => {
    // --ds-surface-signal is gray-900 in light and gray-800 in dark, so it is not a target for bg-gray-900.
    expect(hslToHex(light.get("--ds-surface-signal") ?? "")).toBe(oldHex("bg-gray-900"));
    expect(hslToHex(dark.get("--ds-surface-signal") ?? "")).not.toBe(oldHex("bg-gray-900"));
    expect(map.classes["bg-gray-900"]).toBe("bg-ds-surface-footer");
  });
});

describe("#190 E2b class-diff check (scripts/design-class-diff.ts)", () => {
  const baseSource = [
    'const a = <button className="px-4 text-gray-700 bg-white border-gray-300 hover:bg-gray-50">In</button>;',
    'const b = <a className="px-3 hover:bg-gray-100 dark:hover:bg-gray-800">Account</a>;',
    'const c = <div className="bg-black/80 text-white">x</div>;',
  ].join("\n");
  const goodA =
    'const a = <button className="px-4 text-gray-700 bg-ds-surface-paper border-gray-300 hover:bg-ds-surface-paper-muted">In</button>;';
  const goodC = 'const c = <div className="bg-ds-surface-overlay/80 text-ds-text-on-fill">x</div>;';
  const source = (a: string, b?: string, c = goodC) =>
    baseSource
      .replace(/^const a = .*$/m, a)
      .replace(/^const b = .*$/m, (line) => b ?? line)
      .replace(/^const c = .*$/m, c);

  it("passes the table's substitutions with variants and opacity, leaving the unmapped pair whole", () => {
    const result = diffSource(baseSource, source(goodA), map);
    expect(result.failures).toEqual([]);
    expect(Object.values(result.substitutions).reduce((sum, n) => sum + n, 0)).toBe(4);
  });

  it.each([
    ["a wrong token", goodA.replace("bg-ds-surface-paper ", "bg-ds-surface-paper-muted ")],
    ["a dropped hover: variant", goodA.replace("hover:bg-ds-surface-paper-muted", "bg-ds-surface-paper-muted")],
  ])("fails on %s", (_, lineA) => {
    expect(diffSource(baseSource, source(lineA), map).failures).toHaveLength(1);
  });

  it("fails on a hover: class mapped without its dark:hover: partner", () => {
    const half = 'const b = <a className="px-3 hover:bg-ds-surface-paper-sunken dark:hover:bg-gray-800">Account</a>;';
    expect(diffSource(baseSource, source(goodA, half), map).failures).toHaveLength(1);
  });

  // E2b-2: the Alert success boxes write two light/dark pairs interleaved.
  const alert = '<Alert className="p-4 bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">';

  it("passes interleaved light/dark pairs, each mapped to its one token", () => {
    const after = '<Alert className="p-4 bg-ds-surface-callout-success border-ds-border-callout-success">';
    const result = diffSource(alert, after, map);
    expect(result.failures).toEqual([]);
    expect(Object.keys(result.substitutions)).toHaveLength(2);
    const onePair = '<Alert className="p-4 bg-ds-surface-callout-success border-green-200 dark:border-green-800">';
    expect(diffSource(alert, onePair, map).failures).toEqual([]);
  });

  it.each([
    ["a light class mapped alone", '<Alert className="p-4 bg-ds-success-fixed-subtle border-ds-border-callout-success dark:bg-green-950">'],
    ["a dropped dark: class", '<Alert className="p-4 bg-ds-surface-callout-success border-green-200">'],
  ])("fails on interleaved pairs with %s", (_, after) => {
    expect(diffSource(alert, after, map).failures).toHaveLength(1);
  });
});
