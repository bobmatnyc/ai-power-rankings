import { describe, expect, it } from "vitest";
import { hasPositiveNumeric, parseNumeric, parseNumericOr } from "./parse-numeric";

describe("parseNumeric", () => {
  describe("live-data string forms (the bug this fixes)", () => {
    it.each([
      // The two live Devin values that silently scored 0 before this fix.
      ["$10.2B (September 2025)", 10_200_000_000],
      ["$575M+ total raised", 575_000_000],
      ["1.2k", 1_200],
      ["$100M", 100_000_000],
      ["3,500", 3_500],
    ])("parses %j -> %d", (input, expected) => {
      expect(parseNumeric(input)).toBe(expected);
    });
  });

  describe("magnitude suffixes", () => {
    it.each([
      ["5K", 5_000],
      ["5 thousand", 5_000],
      ["2.5M", 2_500_000],
      ["2.5 million", 2_500_000],
      ["7mm", 7_000_000],
      ["1B", 1_000_000_000],
      ["1bn", 1_000_000_000],
      ["1 billion", 1_000_000_000],
      ["1.5T", 1_500_000_000_000],
      ["1.5 trillion", 1_500_000_000_000],
    ])("parses %j -> %d", (input, expected) => {
      expect(parseNumeric(input)).toBe(expected);
    });

    it("is case-insensitive on suffixes", () => {
      expect(parseNumeric("$10.2b")).toBe(10_200_000_000);
      expect(parseNumeric("$10.2B")).toBe(10_200_000_000);
    });
  });

  describe("prose must not be mistaken for a suffix", () => {
    // Regression: without a word boundary on the suffix, the `t` of "total"
    // reads as a trillions multiplier and turns 575 into 5.75e14.
    it("does not read the 't' of 'total' as trillions", () => {
      expect(parseNumeric("575 total raised")).toBe(575);
    });

    it("does not read the 'b' of 'backed' as billions", () => {
      expect(parseNumeric("42 backed rounds")).toBe(42);
    });

    it("still parses a real suffix immediately followed by punctuation", () => {
      expect(parseNumeric("$575M+ total raised")).toBe(575_000_000);
      expect(parseNumeric("$10.2B, per Reuters")).toBe(10_200_000_000);
    });
  });

  describe("decorations: currency, separators, qualifiers, parentheticals", () => {
    it.each([
      ["$1,234,567", 1_234_567],
      ["€250M", 250_000_000],
      ["£1.5B", 1_500_000_000],
      ["~$50M", 50_000_000],
      [">$100M", 100_000_000],
      ["$100M+", 100_000_000],
      ["72%", 72],
      ["49.2", 49.2],
      ["  $2B  ", 2_000_000_000],
      ["$1.2B (Series C, 2024)", 1_200_000_000],
    ])("parses %j -> %d", (input, expected) => {
      expect(parseNumeric(input)).toBe(expected);
    });
  });

  describe("plain numbers pass through", () => {
    it.each([
      [0, 0],
      [3_500, 3_500],
      [10_200_000_000, 10_200_000_000],
      [49.2, 49.2],
      [-5, -5],
    ])("passes %d through unchanged", (input, expected) => {
      expect(parseNumeric(input)).toBe(expected);
    });

    it("rejects non-finite numbers", () => {
      expect(parseNumeric(Number.NaN)).toBeNull();
      expect(parseNumeric(Number.POSITIVE_INFINITY)).toBeNull();
      expect(parseNumeric(Number.NEGATIVE_INFINITY)).toBeNull();
    });
  });

  describe("non-values return null", () => {
    it.each([
      [null],
      [undefined],
      [""],
      ["   "],
      ["N/A"],
      ["unknown"],
      ["Series B"],
      ["undisclosed"],
      [true],
      [{}],
      [[]],
    ])("returns null for %j", (input) => {
      expect(parseNumeric(input)).toBeNull();
    });
  });

  it("never returns NaN for any input (the original failure mode)", () => {
    const inputs = [
      "$10.2B (September 2025)", "$575M+ total raised", "N/A", "", null,
      undefined, "Series B", 0, Number.NaN, "3,500", true, {},
    ];
    for (const input of inputs) {
      const result = parseNumeric(input);
      expect(result === null || Number.isFinite(result)).toBe(true);
    }
  });
});

describe("parseNumericOr", () => {
  it("defaults to 0 when nothing is recoverable", () => {
    expect(parseNumericOr(null)).toBe(0);
    expect(parseNumericOr("N/A")).toBe(0);
  });

  it("honours an explicit fallback", () => {
    expect(parseNumericOr(undefined, -1)).toBe(-1);
  });

  it("returns a genuine 0 rather than the fallback", () => {
    // Load-bearing for market traction: `monthly_arr === 0` gates the
    // pricing-model fallback path, so a real 0 must survive.
    expect(parseNumericOr(0, 99)).toBe(0);
    expect(parseNumericOr("$0", 99)).toBe(0);
  });

  it("parses string values", () => {
    expect(parseNumericOr("$575M+ total raised")).toBe(575_000_000);
  });
});

describe("hasPositiveNumeric", () => {
  it("recognises string-stored metrics as present", () => {
    // The whole point: these were all `false` under the old `value > 0` check,
    // which depressed data completeness and the confidence multiplier.
    expect(hasPositiveNumeric("$10.2B (September 2025)")).toBe(true);
    expect(hasPositiveNumeric("$575M+ total raised")).toBe(true);
    expect(hasPositiveNumeric("1.2k")).toBe(true);
  });

  it("recognises positive plain numbers", () => {
    expect(hasPositiveNumeric(1)).toBe(true);
    expect(hasPositiveNumeric(10_200_000_000)).toBe(true);
  });

  it("rejects zero, negatives, and non-values", () => {
    expect(hasPositiveNumeric(0)).toBe(false);
    expect(hasPositiveNumeric("$0")).toBe(false);
    expect(hasPositiveNumeric(-5)).toBe(false);
    expect(hasPositiveNumeric(null)).toBe(false);
    expect(hasPositiveNumeric(undefined)).toBe(false);
    expect(hasPositiveNumeric("N/A")).toBe(false);
  });
});
