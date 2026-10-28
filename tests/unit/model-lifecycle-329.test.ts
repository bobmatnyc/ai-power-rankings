/**
 * #329: the per-major model seed and its lifecycle (D05 working draft).
 *
 * Why: the models list must end with one active row per available line and major, with every
 *   older or unavailable point archived as `deprecated`. A bad lifecycle row would activate an
 *   unavailable model, rank two points of one major, archive by redirect or carry a licensed
 *   figure into a public file.
 * What: validates the shipped seeds and lifecycle, then breaks one rule at a time in a copy and
 *   expects a throw. Plans the status step against a recorded-SQL double and runs the loader's
 *   dry run and apply with `--set-status`.
 * Test: `npx vitest run tests/unit/model-lifecycle-329.test.ts`. No database, no network.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EXISTING_FAMILY_METRIC_SLUGS } from "../../lib/db/repositories/model-metrics-seed.repository";
import {
  assertNoBenchmarkFigures,
  dropArchivedSlugs,
  KNOWN_REDIRECT_SLUGS,
  type LifecycleSeedRow,
  MODEL_LIFECYCLE_FILE,
  MODEL_LIFECYCLE_LIVE_SLUGS,
  MODEL_STATUS_UPDATE_SQL,
  type ModelLifecycle,
  parseModelLifecycle,
  planModelStatus,
} from "../../lib/db/repositories/model-lifecycle";
import { parseModelSeed } from "../../lib/db/repositories/model-seed.repository";
import { MODEL_SEED_UPSERT_SQL, type ModelSeedDb } from "../../lib/db/repositories/model-seed-writer";
import { D90_OLD_SLUGS } from "../../scripts/duplicate-tool-merge";
import { loadModelSeeds, parseArgs, readModelLifecycle, readModelSeeds, SEEDS } from "../../scripts/load-model-seeds";

const readFile = (file: string) => readFileSync(file, "utf8");
const SEED_ROWS: LifecycleSeedRow[] = readModelSeeds("all", readFile).map((e) => e.row);
const LIFECYCLE_TEXT = readFile(MODEL_LIFECYCLE_FILE);
const LIFECYCLE = readModelLifecycle(readFile);

type Doc = { models: Record<string, unknown>[] } & Record<string, unknown>;
const lifecycleDoc = (): Doc => JSON.parse(LIFECYCLE_TEXT) as Doc;
const entry = (doc: Doc, slug: string) => doc.models.find((m) => m["slug"] === slug)!;
const parse = (doc: Doc, seeds: readonly LifecycleSeedRow[] = SEED_ROWS) => parseModelLifecycle(JSON.stringify(doc), seeds);

// #329: the vendor families the owner expects on the list after the apply.
const EXPECTED_VENDORS = [
  "Anthropic",
  "OpenAI",
  "Google",
  "xAI",
  "DeepSeek",
  "Alibaba",
  "Mistral AI",
  "Moonshot AI",
  "Z.ai",
  "MiniMax",
  "Meta",
  "Xiaomi",
];
const LIVE_VENDOR: Record<string, string> = {
  "claude-opus": "Anthropic",
  "claude-sonnet": "Anthropic",
  grok: "xAI",
  "devstral-small-2": "Mistral AI",
};

describe("shipped per-major seed and lifecycle (#329)", () => {
  it("the majors seed is valid JSON in the model seed format and every seed row has a lifecycle row", () => {
    const majors = parseModelSeed(readFile(SEEDS.majors.file));
    expect(majors.models.length).toBeGreaterThan(0);
    expect(LIFECYCLE.rows.map((r) => r.slug).sort()).toEqual([...SEED_ROWS.map((r) => r.slug), ...MODEL_LIFECYCLE_LIVE_SLUGS].sort());
  });

  it("has exactly one active row per line and major, each available with both sources", () => {
    const active = LIFECYCLE.rows.filter((r) => r.targetStatus === "active");
    const keys = active.map((r) => `${r.line}#${r.major}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const row of active) {
      expect(row.availability.available, row.slug).toBe(true);
      expect(row.availability.sourceUrl, row.slug).toMatch(/^https:\/\//);
      expect(row.codingSourceUrl, row.slug).toMatch(/^https:\/\//);
    }
    expect(active.length).toBeGreaterThanOrEqual(20);
    expect(active.length).toBeLessThanOrEqual(60);
  });

  it("covers every expected vendor family with an active row", () => {
    const vendorOf = new Map(readModelSeeds("all", readFile).map((e) => [e.row.slug, e.row.company]));
    const vendors = new Set(
      LIFECYCLE.rows.filter((r) => r.targetStatus === "active").map((r) => vendorOf.get(r.slug) ?? LIVE_VENDOR[r.slug])
    );
    for (const vendor of EXPECTED_VENDORS) expect(vendors, vendor).toContain(vendor);
  });

  it("archives every superseded or unavailable point as deprecated, never as redirect", () => {
    const archived = LIFECYCLE.rows.filter((r) => r.targetStatus !== "active");
    expect(archived.length).toBeGreaterThan(0);
    for (const row of archived) {
      expect(row.targetStatus).toBe("deprecated");
      expect(["superseded", "unavailable"]).toContain(row.archiveReason);
    }
  });

  it("names no benchmark figure in any tracked model seed file", () => {
    for (const file of [...Object.values(SEEDS).map((s) => s.file), MODEL_LIFECYCLE_FILE]) {
      expect(() => assertNoBenchmarkFigures(JSON.parse(readFile(file))), file).not.toThrow();
    }
  });

  it("knows every D90 and D91 redirect alias", () => {
    const fold = readFile("lib/db/migrations/0019_fold_model_families.sql");
    const d91 = /old_slugs constant text\[\] := ARRAY\[([^\]]+)\]/.exec(fold)![1]!.match(/'([^']+)'/g)!.map((s) => s.slice(1, -1));
    expect(d91.length).toBe(7);
    for (const slug of [...D90_OLD_SLUGS, ...d91]) expect(KNOWN_REDIRECT_SLUGS, slug).toContain(slug);
  });
});

describe("lifecycle rules each fail on a bad fixture (#329)", () => {
  const cases: [string, (doc: Doc) => void, RegExp][] = [
    ["two active rows on one line and major", (d) => Object.assign(entry(d, "claude-opus-5-0"), { target_status: "active", archive_reason: undefined, superseded_by: undefined }), /2 active rows on claude-opus#5/],
    ["an active row with no availability source", (d) => delete (entry(d, "gpt-astra")["availability"] as Record<string, unknown>)["source_url"], /availability: source_url is required/],
    ["an active row that is not available", (d) => ((entry(d, "gpt-astra")["availability"] as Record<string, unknown>)["available"] = false), /an active row must be available/],
    ["an active row with no coding source", (d) => delete entry(d, "glm")["coding_source_url"], /needs a coding_source_url/],
    ["an image or video model slug", (d) => (entry(d, "glm")["slug"] = "gemini-image"), /out of scope \(D52\)/],
    ["a slug that is a redirect alias", (d) => (entry(d, "glm")["slug"] = "opus-4-6"), /redirect alias/],
    // Synthetic text only: no real model name sits beside a figure in this file.
    ["a benchmark figure key", (d) => ((d["rules"] as Record<string, unknown>)["terminal_bench"] = 1), /names a benchmark figure/],
    ["a benchmark figure in text", (d) => (d["ruling"] = "Model Zeta scored 1 on TB"), /names a score/],
    ["a deprecated row without a reason", (d) => delete entry(d, "grok-4-5")["archive_reason"], /needs archive_reason/],
    ["a superseded row pointing at an archived row", (d) => (entry(d, "grok-4-5")["superseded_by"] = "grok-4-6"), /not an active row/],
    ["an archived point later than the active one", (d) => (entry(d, "grok-4-5")["point"] = "4.9"), /not earlier than the active grok/],
    ["a point outside its major", (d) => (entry(d, "grok")["point"] = "5.0"), /not in major 4/],
    ["an availability check after the file date", (d) => ((entry(d, "grok")["availability"] as Record<string, unknown>)["checked_at"] = "2099-01-01"), /after the file's checked_at/],
    ["a seed row with no lifecycle row", (d) => (d.models = d.models.filter((m) => m["slug"] !== "mimo")), /seed row mimo has no lifecycle row/],
    ["a slug that is neither seeded nor live", (d) => (entry(d, "grok")["slug"] = "grok-9"), /neither a seed row nor a live row/],
  ];
  it.each(cases)("refuses %s", (_name, mutate, error) => {
    const doc = lifecycleDoc();
    expect(() => parse(doc)).not.toThrow();
    mutate(doc);
    expect(() => parse(doc)).toThrow(error);
  });

  it("refuses a seed row with an image modality (D52)", () => {
    const seeds = SEED_ROWS.map((r) => (r.slug === "glm" ? { ...r, modality: "image" } : r));
    expect(() => parse(lifecycleDoc(), seeds)).toThrow(/glm is a image model \(D52\)/);
  });

  it("refuses text that is not JSON", () => {
    expect(() => parseModelLifecycle("{", SEED_ROWS)).toThrow();
  });
});

interface Call {
  sql: string;
  params: unknown[] | undefined;
}

/** A recorded-SQL double: SELECTs answer from `rows`, writes return one row each. */
function fakeDb(rows: Record<string, unknown>[]): { db: ModelSeedDb; calls: Call[] } {
  const calls: Call[] = [];
  const query = async (sql: string, params?: unknown[]) => {
    calls.push({ sql, params });
    if (sql.trimStart().startsWith("SELECT")) {
      const slugs = (params?.[0] as string[]) ?? [];
      return { rows: rows.filter((r) => slugs.includes(r["slug"] as string)) };
    }
    return { rows: [{ slug: params?.[0] }] };
  };
  return { db: { query, transaction: (fn) => fn({ query }) }, calls };
}

const one = (slug: string): ModelLifecycle => ({ checkedAt: LIFECYCLE.checkedAt, rows: LIFECYCLE.rows.filter((r) => r.slug === slug) });

describe("lifecycle helpers (#329)", () => {
  it("dropArchivedSlugs drops every deprecated slug and keeps every active one", () => {
    const all = LIFECYCLE.rows.map((r) => r.slug);
    const kept = dropArchivedSlugs([...all, "not-in-lifecycle"], LIFECYCLE);
    for (const row of LIFECYCLE.rows) expect(kept.includes(row.slug), row.slug).toBe(row.targetStatus === "active");
    expect(kept).toContain("not-in-lifecycle");
  });

  it("the metrics allowlist is the lifecycle's live slugs, devstral-small-2 included", () => {
    expect([...EXISTING_FAMILY_METRIC_SLUGS]).toEqual([...MODEL_LIFECYCLE_LIVE_SLUGS]);
    expect(EXISTING_FAMILY_METRIC_SLUGS).toContain("devstral-small-2");
  });
});

describe("status step plan and loader (#329)", () => {
  it("moves a deprecated row to active only when the lifecycle file says active", async () => {
    const row = { slug: "grok-4-5", kind: "model", status: "deprecated", redirect_to: null, model_lifecycle: null };
    const archived = one("grok-4-5");
    expect(archived.rows[0]!.targetStatus).toBe("deprecated");
    const stay = await planModelStatus(fakeDb([row]).db, archived, new Set());
    expect(stay).toEqual([expect.objectContaining({ slug: "grok-4-5", outcome: "set", from: "deprecated", to: "deprecated" })]);
    const flipped: ModelLifecycle = { ...archived, rows: [{ ...archived.rows[0]!, targetStatus: "active", archiveReason: null, supersededBy: null }] };
    const move = await planModelStatus(fakeDb([row]).db, flipped, new Set());
    expect(move).toEqual([expect.objectContaining({ slug: "grok-4-5", outcome: "set", from: "deprecated", to: "active" })]);
    // A deprecated row the lifecycle does not list is never planned.
    const other = await planModelStatus(fakeDb([row, { ...row, slug: "legacy-model" }]).db, flipped, new Set());
    expect(other.map((p) => p.slug)).toEqual(["grok-4-5"]);
  });

  // D0c: the status step activates rows that carry no benchmark figure (none of these rows has one).
  it("D0c: plans each status move, activating without a figure, and refuses redirect, other kinds and missing rows", async () => {
    const { db } = fakeDb([
      { slug: "gpt-astra", kind: "model", status: "inactive", redirect_to: null, model_lifecycle: null },
      { slug: "claude-opus", kind: "model", status: "active", redirect_to: null, model_lifecycle: null },
      { slug: "grok-4-5", kind: "model", status: "active", redirect_to: null, model_lifecycle: null },
      { slug: "glm", kind: "model", status: "redirect", redirect_to: "glm-x", model_lifecycle: null },
      { slug: "kimi", kind: "harness", status: "active", redirect_to: null, model_lifecycle: null },
    ]);
    const lifecycle: ModelLifecycle = {
      checkedAt: LIFECYCLE.checkedAt,
      rows: LIFECYCLE.rows.filter((r) => ["gpt-astra", "claude-opus", "grok-4-5", "glm", "kimi", "mimo", "qwen"].includes(r.slug)),
    };
    const plans = await planModelStatus(db, lifecycle, new Set(["mimo"]));
    const by = new Map(plans.map((p) => [p.slug, p]));
    expect(by.get("gpt-astra")).toMatchObject({ outcome: "set", from: "inactive", to: "active" });
    expect(by.get("claude-opus")).toMatchObject({ outcome: "set", from: "active", to: "active" });
    expect(by.get("grok-4-5")).toMatchObject({ outcome: "set", from: "active", to: "deprecated" });
    expect(by.get("glm")).toMatchObject({ outcome: "refused" });
    expect(by.get("kimi")).toMatchObject({ outcome: "refused" });
    expect(by.get("mimo")).toMatchObject({ outcome: "set", from: "inactive", to: "active" });
    expect(by.get("qwen")).toMatchObject({ outcome: "refused", reason: expect.stringMatching(/load the model seed first/) });
  });

  it("the status update names only status and data.modelLifecycle and never matches a redirect", () => {
    expect(MODEL_STATUS_UPDATE_SQL).not.toMatch(/metrics|modelSeed|name\s*=/);
    expect(MODEL_STATUS_UPDATE_SQL).toMatch(/status IN \('inactive', 'active', 'deprecated'\)/);
    expect(MODEL_STATUS_UPDATE_SQL).toMatch(/kind = 'model'/);
  });

  it("a dry run with the lifecycle prints the status plan and writes nothing", async () => {
    const { db, calls } = fakeDb([{ slug: "grok", kind: "model", status: "active", redirect_to: null, model_lifecycle: null }]);
    const lines: string[] = [];
    const code = await loadModelSeeds(db, [], false, (l) => lines.push(l), one("grok"));
    expect(code).toBe(0);
    expect(lines).toContain("would set status: grok: active -> active");
    expect(lines).toContain("status: 1 row(s), 1 set active, 0 set deprecated, 0 unchanged, 0 refused");
    expect(calls.filter((c) => c.sql === MODEL_STATUS_UPDATE_SQL)).toHaveLength(0);
  });

  it("an apply writes the seed rows, then the statuses, in one transaction", async () => {
    const entries = readModelSeeds("majors", readFile).filter((e) => e.row.slug === "grok-4-5");
    const { db, calls } = fakeDb([]);
    const lines: string[] = [];
    const code = await loadModelSeeds(db, entries, true, (l) => lines.push(l), one("grok-4-5"));
    expect(code).toBe(0);
    const writes = calls.filter((c) => c.sql === MODEL_SEED_UPSERT_SQL || c.sql === MODEL_STATUS_UPDATE_SQL).map((c) => c.sql);
    expect(writes).toEqual([MODEL_SEED_UPSERT_SQL, MODEL_STATUS_UPDATE_SQL]);
    expect(lines.at(-1)).toBe("apply: committed, 1 row(s) written, 1 status(es) set");
  });

  it("an apply writes nothing when a status is refused", async () => {
    const { db, calls } = fakeDb([{ slug: "grok", kind: "model", status: "redirect", redirect_to: "x", model_lifecycle: null }]);
    const lines: string[] = [];
    expect(await loadModelSeeds(db, [], true, (l) => lines.push(l), one("grok"))).toBe(1);
    expect(calls.filter((c) => c.sql === MODEL_STATUS_UPDATE_SQL)).toHaveLength(0);
    expect(lines.at(-1)).toBe("apply: nothing written because a row was refused");
  });

  it("--set-status needs --seed all, and the majors seed is selectable", () => {
    expect(parseArgs(["--set-status"])).toEqual({ seed: "all", apply: false, setStatus: true });
    expect(parseArgs(["--seed", "majors"])).toEqual({ seed: "majors", apply: false });
    expect(parseArgs(["--seed", "closed", "--set-status"])).toEqual({ errors: ["--set-status needs --seed all"] });
  });
});
