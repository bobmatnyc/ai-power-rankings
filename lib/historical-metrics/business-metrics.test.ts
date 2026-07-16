/**
 * Coverage for the sourced business-metric leaf extraction.
 *
 * The rules under test are provenance rules, not formatting rules: fidelity is
 * never upgraded, and unsubstantiated data must emit NOTHING rather than a
 * fabricated or held-flat guess (a null leaf written into an override would
 * overwrite a live production value with a lie).
 */

import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BUSINESS_METRIC_PATHS,
  businessLeavesForPeriod,
  indexRecoveryByLiveSlug,
  loadRecoveryDataset,
  resolveDatasetSlug,
} from "./business-metrics";

const RECOVERY_PATH = join(
  process.cwd(),
  "data",
  "historical-metrics",
  "sources",
  "business-metrics-recovery.json"
);

/** A record shaped like the real dataset: flat "swe_bench.verified" key included. */
const toolRecord = {
  tier: 1,
  users: {
    monthly: {
      "2026-01": { value: 1000, fidelity: "real", source: "https://x", note: "n", as_of: "2026-01-05" },
      "2026-02": { value: 1200, fidelity: "interpolated", source: null, note: "guessed" },
      "2026-03": null, // month research could not resolve
    },
  },
  monthly_arr: {
    monthly: {
      "2026-01": { value: 5_000_000, fidelity: "held_flat", source: "https://y", note: "held" },
    },
  },
  "swe_bench.verified": {
    monthly: {
      "2026-01": { value: 74.5, fidelity: "real", source: "https://z", note: "Opus 4.1" },
    },
  },
} as Record<string, unknown>;

const at = (period: string, path: string[]) =>
  businessLeavesForPeriod(toolRecord, period).find((l) => l.path.join(".") === path.join("."));

describe("businessLeavesForPeriod", () => {
  it("maps the FLAT dataset key `swe_bench.verified` onto the NESTED engine path", () => {
    // Regression: treating the dataset key as a nested path silently dropped
    // every SWE-bench leaf (the engine reads metrics.swe_bench.verified).
    const leaf = at("2026-01", ["swe_bench", "verified"]);
    expect(leaf).toBeDefined();
    expect(leaf!.leaf.value).toBe(74.5);
  });

  it("emits plain numbers and the full provenance leaf shape", () => {
    const leaf = at("2026-01", ["users"])!.leaf;
    expect(leaf).toEqual({
      value: 1000,
      fidelity: "real",
      source: "https://x",
      as_of: "2026-01-05",
      recovery_note: "n",
    });
    expect(typeof leaf.value).toBe("number");
  });

  it("carries fidelity verbatim and never upgrades it", () => {
    expect(at("2026-02", ["users"])!.leaf.fidelity).toBe("interpolated");
    expect(at("2026-01", ["monthly_arr"])!.leaf.fidelity).toBe("held_flat");
  });

  it("emits NOTHING for a null month rather than holding a value flat", () => {
    expect(at("2026-03", ["users"])).toBeUndefined();
  });

  it("emits NOTHING for a field the research never substantiated", () => {
    // No `valuation`/`funding` series on this record at all.
    expect(at("2026-01", ["valuation"])).toBeUndefined();
    expect(at("2026-01", ["funding"])).toBeUndefined();
  });

  it("returns nothing for an unknown tool", () => {
    expect(businessLeavesForPeriod(undefined, "2026-01")).toEqual([]);
  });
});

describe("recovery dataset (real file)", () => {
  const dataset = loadRecoveryDataset(RECOVERY_PATH);
  const byLiveSlug = indexRecoveryByLiveSlug(dataset);

  it("resolves dataset slugs that differ from the live tools.slug", () => {
    expect(resolveDatasetSlug("intellicode")).toBe("microsoft-intellicode");
    expect(resolveDatasetSlug("gemini-cli")).toBe("google-gemini-cli");
    expect(resolveDatasetSlug("cursor")).toBe("cursor");
  });

  it("actually yields SWE-bench leaves from the shipped dataset", () => {
    // Guards the flat-vs-nested key contract against a dataset reshape.
    const leaves = businessLeavesForPeriod(byLiveSlug.get("claude-code"), "2026-01");
    const paths = leaves.map((l) => l.path.join("."));
    expect(paths).toContain("swe_bench.verified");
  });

  it("never emits a leaf whose field the dataset lists under not_found", () => {
    for (const [datasetKey, missing] of Object.entries(dataset.not_found ?? {})) {
      const record = byLiveSlug.get(resolveDatasetSlug(datasetKey));
      const paths = new Set(
        businessLeavesForPeriod(record, "2026-01").map((l) => l.path.join("."))
      );
      for (const field of missing) {
        expect(paths.has(field)).toBe(false);
      }
    }
  });

  it("emits only finite numeric values across every covered period", () => {
    const periods = ["2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"];
    const known = new Set(BUSINESS_METRIC_PATHS.map((m) => m.path.join(".")));
    for (const record of byLiveSlug.values()) {
      for (const period of periods) {
        for (const { path, leaf } of businessLeavesForPeriod(record, period)) {
          expect(known.has(path.join("."))).toBe(true);
          expect(Number.isFinite(leaf.value)).toBe(true);
          expect(["real", "interpolated", "held_flat"]).toContain(leaf.fidelity);
        }
      }
    }
  });
});
