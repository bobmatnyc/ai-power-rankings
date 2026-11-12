/**
 * #453: no move into active while a model row's licence review is pending (planners and validator).
 *
 * Why: a custom-licence model must not go live before the owner has reviewed its licence. The
 *   planner of each activation path is the review step, so each must refuse a pending row,
 *   leave an active row alone (D83), and fail closed on a review it cannot read.
 * What: checks `licenceActivationRefusal` arm by arm, the seed validator's `reviewed` rule, the
 *   reseed rule `seedLicenceReview`, and the plans of `planModelStatus`, `planModelMetrics` and
 *   `planModelSeedRows` over a recorded-SQL double. The SQL guards run on PGlite in
 *   `licence-gate-pglite-453.test.ts`.
 * Test: `npx vitest run tests/unit/licence-gate-453.test.ts`. No database, no network.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { licenceActivationRefusal } from "../../lib/db/repositories/licence-review";
import { type ModelLifecycle, planModelStatus } from "../../lib/db/repositories/model-lifecycle";
import { MODEL_METRICS_SELECT_SQL, planModelMetrics } from "../../lib/db/repositories/model-metrics-writer";
import { parseModelSeed } from "../../lib/db/repositories/model-seed.repository";
import {
  MODEL_SEED_SELECT_SQL,
  type ModelSeedEntry,
  type ModelSeedQueryable,
  modelSeedProvenance,
  planModelSeedRows,
  seedLicenceReview,
} from "../../lib/db/repositories/model-seed-writer";
import { MODEL_TERMINAL_BENCH_SOURCE } from "../../lib/rankings/lists";
import { readModelLifecycle, readModelSeeds } from "../../scripts/load-model-seeds";

const readFile = (file: string) => readFileSync(file, "utf8");
const LIFECYCLE = readModelLifecycle(readFile);
const OPEN = readModelSeeds("open-weight", readFile);
// minimax: a custom licence (pending) that the lifecycle keeps active.
const MINIMAX = OPEN.find((e) => e.row.slug === "minimax")!;
const one = (slug: string): ModelLifecycle => ({ checkedAt: LIFECYCLE.checkedAt, rows: LIFECYCLE.rows.filter((r) => r.slug === slug) });

const PENDING = { licenceReview: "pending" };
const REVIEWED = { licenceReview: "reviewed", licenceReviewRuling: "D88" };

/** A query double: every SELECT answers `rows` for the asked slugs. */
function fakeDb(rows: Record<string, unknown>[]): ModelSeedQueryable {
  return {
    query: async (_sql, params) => {
      const slugs = (params?.[0] as string[]) ?? [];
      return { rows: rows.filter((r) => slugs.includes(r["slug"] as string)) };
    },
  };
}

describe("licenceActivationRefusal (#453)", () => {
  it.each<[string, unknown]>([
    ["no modelSeed (legacy row)", undefined],
    ["a null modelSeed", null],
    ["a modelSeed with no licenceReview (closed row)", {}],
    ["a null licenceReview", { licenceReview: null }],
    ["not_required", { licenceReview: "not_required" }],
    ["reviewed with a ruling id", REVIEWED],
    ["reviewed with a lettered ruling id", { licenceReview: "reviewed", licenceReviewRuling: "D9rl3" }],
  ])("allows %s", (_name, seed) => {
    expect(licenceActivationRefusal(seed)).toBeNull();
  });

  // Fail closed: every review the gate cannot read as allowed refuses.
  it.each<[string, unknown, RegExp]>([
    ["pending", PENDING, /pending/],
    ["reviewed without a ruling", { licenceReview: "reviewed" }, /no valid licenceReviewRuling/],
    ["reviewed with an empty ruling", { licenceReview: "reviewed", licenceReviewRuling: "" }, /no valid/],
    ["reviewed with a malformed ruling", { licenceReview: "reviewed", licenceReviewRuling: "88" }, /no valid/],
    ["reviewed with a numeric ruling", { licenceReview: "reviewed", licenceReviewRuling: 88 }, /no valid/],
    ["an unknown value", { licenceReview: "approved" }, /unknown value/],
    ["a non-string value", { licenceReview: 42 }, /unknown value/],
    ["a modelSeed that is a string", "pending", /not an object/],
    ["a modelSeed that is an array", [PENDING], /not an object/],
  ])("refuses %s", (_name, seed, reason) => {
    expect(licenceActivationRefusal(seed)).toMatch(reason);
  });
});

describe("seed validator: licence_review reviewed (#453)", () => {
  const doc = (patch: Record<string, unknown>) => {
    const d = JSON.parse(readFile("docs/refresh/open-weight-models-refresh.json")) as { models: Record<string, unknown>[] };
    const i = d.models.findIndex((m) => m["slug"] === "minimax");
    d.models[i] = { ...d.models[i]!, ...patch };
    return JSON.stringify(d);
  };
  const row = (text: string) => parseModelSeed(text).models.find((m) => m.slug === "minimax")!;

  it("accepts reviewed with an owner ruling id and keeps the ruling", () => {
    const parsed = row(doc({ licence_review: "reviewed", licence_review_ruling: "D88" }));
    expect(parsed).toMatchObject({ licenceReview: "reviewed", licenceReviewRuling: "D88" });
    expect(row(doc({}))).toMatchObject({ licenceReview: "pending", licenceReviewRuling: null });
  });

  it.each<[string, Record<string, unknown>, RegExp]>([
    ["reviewed without a ruling", { licence_review: "reviewed" }, /needs licence_review_ruling/],
    ["reviewed with an empty ruling", { licence_review: "reviewed", licence_review_ruling: " " }, /needs licence_review_ruling/],
    ["reviewed with a malformed ruling", { licence_review: "reviewed", licence_review_ruling: "ruling 88" }, /needs licence_review_ruling/],
    ["a ruling beside pending", { licence_review_ruling: "D88" }, /only with licence_review "reviewed"/],
  ])("rejects %s", (_name, patch, message) => {
    expect(() => parseModelSeed(doc(patch))).toThrow(message);
  });

  it("rejects reviewed on an OSI licence and a ruling on a closed row", () => {
    const d = JSON.parse(readFile("docs/refresh/open-weight-models-refresh.json")) as { models: Record<string, unknown>[] };
    const osi = d.models.find((m) => m["licence_review"] === "not_required")!;
    osi["licence_review"] = "reviewed";
    osi["licence_review_ruling"] = "D88";
    expect(() => parseModelSeed(JSON.stringify(d))).toThrow(/licence_review must be "not_required"/);
    const closed = JSON.parse(readFile("docs/refresh/model-majors-seed.json")) as { models: Record<string, unknown>[] };
    closed.models.find((m) => m["open_weight"] === false)!["licence_review_ruling"] = "D88";
    expect(() => parseModelSeed(JSON.stringify(closed))).toThrow(/closed row has no licence_review_ruling/);
  });
});

describe("reseed keeps a stored reviewed review (#453)", () => {
  const withReview = (licenceReview: "pending" | "not_required" | "reviewed", ruling: string | null = null): ModelSeedEntry => ({
    ...MINIMAX,
    row: { ...MINIMAX.row, licenceReview, licenceReviewRuling: ruling },
  });

  it.each<[string, ModelSeedEntry, unknown, { licenceReview: unknown; licenceReviewRuling: unknown; kept: boolean }]>([
    ["a pending seed keeps a stored reviewed", withReview("pending"), REVIEWED, { licenceReview: "reviewed", licenceReviewRuling: "D88", kept: true }],
    ["a pending seed over a stored pending", withReview("pending"), PENDING, { licenceReview: "pending", licenceReviewRuling: null, kept: false }],
    ["a pending seed over a reviewed without ruling", withReview("pending"), { licenceReview: "reviewed" }, { licenceReview: "pending", licenceReviewRuling: null, kept: false }],
    ["a not_required seed replaces a stored reviewed", withReview("not_required"), REVIEWED, { licenceReview: "not_required", licenceReviewRuling: null, kept: false }],
    ["a reviewed seed replaces the stored ruling", withReview("reviewed", "D90"), REVIEWED, { licenceReview: "reviewed", licenceReviewRuling: "D90", kept: false }],
    ["a new row takes the seed's value", withReview("pending"), undefined, { licenceReview: "pending", licenceReviewRuling: null, kept: false }],
  ])("%s", (_name, entry, stored, expected) => {
    expect(seedLicenceReview(entry.row, stored)).toEqual(expected);
  });

  it("plans an unchanged pending reseed over a stored reviewed as unchanged, and guards the kept ruling", async () => {
    const stored = { ...modelSeedProvenance(MINIMAX), ...REVIEWED };
    const existing = {
      slug: "minimax",
      kind: "model",
      status: "inactive",
      redirect_to: null,
      open_weight: true,
      hf_repo: MINIMAX.row.facts.hf_repo?.value ?? null,
      licence: MINIMAX.row.facts.licence?.value ?? null,
      parameters_b: MINIMAX.row.facts.parameters_b?.value?.toString() ?? null,
      active_parameters_b: MINIMAX.row.facts.active_parameters_b?.value?.toString() ?? null,
      release_date: MINIMAX.row.facts.release_date?.value ?? null,
      model_seed: stored,
    };
    const db: ModelSeedQueryable = { query: async (sql) => ({ rows: sql === MODEL_SEED_SELECT_SQL ? [existing] : [] }) };
    expect(await planModelSeedRows(db, [MINIMAX])).toEqual([{ slug: "minimax", seedFile: MINIMAX.seedFile, outcome: "unchanged" }]);
    // A changed fact still writes, keeping the review and passing its ruling to the upsert guard.
    const moved = await planModelSeedRows({ query: async () => ({ rows: [{ ...existing, model_seed: { ...stored, checkedAt: "2000-01-01" } }] }) }, [MINIMAX]);
    expect(moved[0]).toMatchObject({ outcome: "update" });
    const params = (moved[0] as { params: unknown[] }).params;
    expect(JSON.parse(params[8] as string).modelSeed).toMatchObject(REVIEWED);
    expect(params[10]).toBe("D88");
  });
});

describe("planModelStatus licence gate (#453)", () => {
  const row = (status: string, modelSeed: unknown) => ({ slug: "minimax", kind: "model", status, redirect_to: null, model_lifecycle: null, model_seed: modelSeed });

  it("refuses a move into active while the stored review is pending", async () => {
    const [plan] = await planModelStatus(fakeDb([row("inactive", PENDING)]), one("minimax"), new Set());
    expect(plan).toMatchObject({ slug: "minimax", outcome: "refused", reason: expect.stringMatching(/licence review is pending/) });
  });

  it("leaves an active pending row as today: set active -> active, never refused (D83)", async () => {
    const [plan] = await planModelStatus(fakeDb([row("active", PENDING)]), one("minimax"), new Set());
    expect(plan).toMatchObject({ outcome: "set", from: "active", to: "active" });
  });

  it.each<[string, unknown]>([
    ["reviewed with a ruling", REVIEWED],
    ["not_required", { licenceReview: "not_required" }],
    ["a null review", { licenceReview: null }],
    ["no modelSeed", undefined],
  ])("activates an inactive row with %s", async (_name, seed) => {
    const [plan] = await planModelStatus(fakeDb([row("inactive", seed)]), one("minimax"), new Set());
    expect(plan).toMatchObject({ outcome: "set", from: "inactive", to: "active" });
  });

  it("judges the review the seed step leaves: a kept reviewed activates, a pending seed over pending does not", async () => {
    const seedRows = new Map([["minimax", MINIMAX.row]]);
    const kept = await planModelStatus(fakeDb([row("inactive", REVIEWED)]), one("minimax"), new Set(), seedRows);
    expect(kept[0]).toMatchObject({ outcome: "set", to: "active" });
    const pending = await planModelStatus(fakeDb([row("inactive", PENDING)]), one("minimax"), new Set(), seedRows);
    expect(pending[0]).toMatchObject({ outcome: "refused" });
    const reviewedSeed = new Map([["minimax", { ...MINIMAX.row, licenceReview: "reviewed" as const, licenceReviewRuling: "D88" }]]);
    const now = await planModelStatus(fakeDb([row("inactive", PENDING)]), one("minimax"), new Set(), reviewedSeed);
    expect(now[0]).toMatchObject({ outcome: "set", to: "active" });
  });

  it("refuses a pending-review insert, and an insert whose review is unknown (fail closed)", async () => {
    const seedRows = new Map([["minimax", MINIMAX.row]]);
    const inserted = await planModelStatus(fakeDb([]), one("minimax"), new Set(["minimax"]), seedRows);
    expect(inserted[0]).toMatchObject({ outcome: "refused", reason: expect.stringMatching(/pending/) });
    const unknown = await planModelStatus(fakeDb([]), one("minimax"), new Set(["minimax"]));
    expect(unknown[0]).toMatchObject({ outcome: "refused", reason: expect.stringMatching(/unknown/) });
  });

  it("never gates a move to deprecated", async () => {
    const lifecycle: ModelLifecycle = { ...one("minimax"), rows: one("minimax").rows.map((r) => ({ ...r, targetStatus: "deprecated" as const })) };
    const [plan] = await planModelStatus(fakeDb([row("inactive", PENDING)]), lifecycle, new Set());
    expect(plan).toMatchObject({ outcome: "set", to: "deprecated" });
  });

  // Error arm: a failed read of the review yields no plan at all, never an allowed one.
  it("rejects, with no plan, when reading the rows fails", async () => {
    const broken: ModelSeedQueryable = { query: async () => Promise.reject(new Error("connection reset")) };
    await expect(planModelStatus(broken, one("minimax"), new Set())).rejects.toThrow("connection reset");
  });
});

describe("planModelMetrics activation licence gate (#453)", () => {
  const metricData = {
    metrics: { terminal_bench: 41.2 },
    metrics_provenance: { terminal_bench: { source: MODEL_TERMINAL_BENCH_SOURCE, as_of: "2026-10-01" } },
  };
  const db = (status: string, modelSeed: unknown): ModelSeedQueryable => ({
    query: async (sql) => {
      expect(sql).toBe(MODEL_METRICS_SELECT_SQL);
      return {
        rows: [{ slug: "minimax", kind: "model", status, redirect_to: null, metrics_type: "object", provenance_type: "object", metric_data: metricData, model_seed: modelSeed }],
      };
    },
  });

  it.each<[string, string, unknown, Record<string, unknown>]>([
    ["refuses an inactive pending row", "inactive", PENDING, { outcome: "refused", reason: expect.stringMatching(/pending/) }],
    ["refuses an unreadable review (fail closed)", "inactive", "garbled", { outcome: "refused", reason: expect.stringMatching(/not an object/) }],
    ["keeps an active pending row already active (D83)", "active", PENDING, { outcome: "already-active" }],
    ["activates a reviewed row with a ruling", "inactive", REVIEWED, { outcome: "activate" }],
    ["activates a row with a null review", "inactive", { licenceReview: null }, { outcome: "activate" }],
  ])("%s", async (_name, status, seed, expected) => {
    const plan = await planModelMetrics(db(status, seed), [], ["minimax"]);
    expect(plan.activation[0]).toMatchObject(expected);
  });
});
