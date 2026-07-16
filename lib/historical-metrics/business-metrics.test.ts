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
  periodIsSourceBacked,
  resolveDatasetSlug,
  USERS_SEMANTIC_EXCLUSIONS,
  USERS_SEMANTICALLY_VALID,
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

/** A slug with no semantic exclusion, so the fixture exercises the base rules. */
const FIXTURE_SLUG = "fixture-tool";

const at = (period: string, path: string[]) =>
  businessLeavesForPeriod(FIXTURE_SLUG, toolRecord, period).find(
    (l) => l.path.join(".") === path.join(".")
  );

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
    expect(businessLeavesForPeriod(FIXTURE_SLUG, undefined, "2026-01")).toEqual([]);
  });
});

describe("source integrity (rule 4)", () => {
  const series = (monthly: Record<string, unknown>, anchors?: unknown[]) =>
    ({ anchors, monthly }) as never;

  it("rejects a `real` month with no source URL", () => {
    expect(
      periodIsSourceBacked(series({ "2026-01": { value: 1, fidelity: "real", source: null } }), "2026-01")
    ).toBe(false);
  });

  it("accepts an `interpolated` month with no source of its own when both anchors are sourced", () => {
    // An interpolated month is derived, so it has no source URL by design.
    const s = series({ "2026-01": { value: 5, fidelity: "interpolated", source: null } }, [
      { date: "2025-06-01", value: 1, source: "https://a" },
      { date: "2026-06-01", value: 9, source: "https://b" },
    ]);
    expect(periodIsSourceBacked(s, "2026-01")).toBe(true);
  });

  it("rejects a month interpolated TOWARD an unsourced anchor", () => {
    const s = series({ "2026-01": { value: 5, fidelity: "interpolated", source: null } }, [
      { date: "2025-06-01", value: 1, source: "https://a" },
      { date: "2026-06-01", value: 9, source: null },
    ]);
    expect(periodIsSourceBacked(s, "2026-01")).toBe(false);
  });

  it("rejects a month held flat FROM an unsourced anchor", () => {
    const s = series({ "2026-01": { value: 5, fidelity: "held_flat", source: null } }, [
      { date: "2025-06-01", value: 5, source: null },
    ]);
    expect(periodIsSourceBacked(s, "2026-01")).toBe(false);
  });

  it("accepts a month held flat from a sourced anchor", () => {
    const s = series({ "2026-01": { value: 5, fidelity: "held_flat", source: "https://a" } }, [
      { date: "2025-06-01", value: 5, source: "https://a" },
    ]);
    expect(periodIsSourceBacked(s, "2026-01")).toBe(true);
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

  const PERIODS = ["2025-12", "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"];

  /** Every leaf emitted for a slug across the whole backfill window. */
  const leavesAcrossWindow = (slug: string) =>
    PERIODS.flatMap((p) => businessLeavesForPeriod(slug, byLiveSlug.get(slug), p));

  const pathsAcrossWindow = (slug: string) =>
    new Set(leavesAcrossWindow(slug).map((l) => l.path.join(".")));

  it("actually yields SWE-bench leaves from the shipped dataset", () => {
    // Guards the flat-vs-nested key contract against a dataset reshape.
    const leaves = businessLeavesForPeriod("claude-code", byLiveSlug.get("claude-code"), "2026-01");
    const paths = leaves.map((l) => l.path.join("."));
    expect(paths).toContain("swe_bench.verified");
  });

  describe("semantic omissions (rule 3)", () => {
    it("never emits `users` for Claude Artifacts (500M = Artifacts CREATED, not users)", () => {
      expect(pathsAcrossWindow("claude-artifacts").has("users")).toBe(false);
    });

    it("never emits `users` for ChatGPT Canvas (900M = ChatGPT WAU, a parent count)", () => {
      expect(pathsAcrossWindow("chatgpt-canvas").has("users")).toBe(false);
    });

    it("keeps ChatGPT Canvas's parent-attributed financials — attribution is allowed", () => {
      // The owner's policy: parent FINANCIALS flow through; only the parent's
      // user count is a mislabel. Guards against over-correcting rule 3 into a
      // blanket parent-exclusion policy.
      const paths = pathsAcrossWindow("chatgpt-canvas");
      expect(paths.has("monthly_arr")).toBe(true);
      expect(paths.has("valuation")).toBe(true);
    });

    it("never emits `users` for Cursor (paying-customers vs enterprise-customers splice)", () => {
      expect(pathsAcrossWindow("cursor").has("users")).toBe(false);
    });

    it("never emits a JetBrains AI `users` value of 9 (that figure is a PERCENT)", () => {
      const users = leavesAcrossWindow("jetbrains-ai").filter((l) => l.path[0] === "users");
      expect(users).toEqual([]);
    });

    it("still emits `users` where the count is genuine, sourced and consistent", () => {
      // The exclusions must not gut the dataset: Replit Agent's 22.5M -> 50M
      // series is one definition throughout and fully sourced.
      expect(pathsAcrossWindow("replit-agent").has("users")).toBe(true);
    });

    it("classifies every `users` series in the dataset as excluded or valid", () => {
      // A dataset reshape that adds a new `users` series must fail here rather
      // than silently feed the engine an unaudited proxy metric.
      for (const [datasetKey, record] of Object.entries(dataset.tools)) {
        if (!record.users) continue;
        const slug = resolveDatasetSlug(datasetKey);
        const classified =
          slug in USERS_SEMANTIC_EXCLUSIONS || USERS_SEMANTICALLY_VALID.has(slug);
        expect(classified, `${slug} has a \`users\` series but is unaudited`).toBe(true);
      }
    });

    it("gives every exclusion a documented reason", () => {
      for (const [slug, reason] of Object.entries(USERS_SEMANTIC_EXCLUSIONS)) {
        expect(reason.length, `${slug} needs a reason`).toBeGreaterThan(40);
      }
    });
  });

  describe("source integrity across the shipped dataset (rule 4)", () => {
    it("emits no leaf marked `real` without a source URL", () => {
      for (const slug of byLiveSlug.keys()) {
        for (const { path, leaf } of leavesAcrossWindow(slug)) {
          if (leaf.fidelity === "real") {
            expect(leaf.source, `${slug}.${path.join(".")} is real but unsourced`).toBeTruthy();
          }
        }
      }
    });

    it("drops the unsourced anchors called out in review", () => {
      // Cursor's "$60B valuation / SpaceX acquisition" and Google Jules'
      // "52.2% SWE-bench" have no primary source and must never reappear.
      const cursorVals = leavesAcrossWindow("cursor")
        .filter((l) => l.path[0] === "valuation")
        .map((l) => l.leaf.value);
      expect(cursorVals).not.toContain(60_000_000_000);

      const julesSwe = leavesAcrossWindow("google-jules").filter(
        (l) => l.path.join(".") === "swe_bench.verified"
      );
      expect(julesSwe).toEqual([]);
    });

    it("drops Claude Code's monthly_arr (both anchors unsourced)", () => {
      expect(pathsAcrossWindow("claude-code").has("monthly_arr")).toBe(false);
    });

    it("keeps Snyk Code's monthly_arr (both anchors sourced)", () => {
      expect(pathsAcrossWindow("snyk-code").has("monthly_arr")).toBe(true);
    });
  });

  it("never emits a leaf whose field the dataset lists under not_found", () => {
    for (const [datasetKey, missing] of Object.entries(dataset.not_found ?? {})) {
      const slug = resolveDatasetSlug(datasetKey);
      const paths = new Set(
        businessLeavesForPeriod(slug, byLiveSlug.get(slug), "2026-01").map((l) => l.path.join("."))
      );
      for (const field of missing) {
        expect(paths.has(field)).toBe(false);
      }
    }
  });

  it("emits only finite numeric values across every covered period", () => {
    const known = new Set(BUSINESS_METRIC_PATHS.map((m) => m.path.join(".")));
    for (const [slug, record] of byLiveSlug.entries()) {
      for (const period of PERIODS) {
        for (const { path, leaf } of businessLeavesForPeriod(slug, record, period)) {
          expect(known.has(path.join("."))).toBe(true);
          expect(Number.isFinite(leaf.value)).toBe(true);
          expect(["real", "interpolated", "held_flat"]).toContain(leaf.fidelity);
        }
      }
    }
  });
});
