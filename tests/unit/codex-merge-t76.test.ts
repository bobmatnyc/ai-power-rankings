/**
 * The Codex merge (ar-Te2/T76): openai-codex-cli into openai-codex.
 *
 * Why: the owner's rules allow no rank override and no scoring change, so Codex can only move
 *   through better data: one row instead of two, and the stars and npm downloads the engine
 *   reads. These tests prove the guards refuse an unexpected state, the merged data has the
 *   shape the engine reads (completeness rises), the dry run writes nothing, and the apply
 *   merges once.
 * What: pure tests of `checkCodexRows` and `planSurvivorData` on fixtures shaped like the live
 *   rows; the v8.1 engine over the before and merged fixture; then `runMerge --set codex` on
 *   the migration chain (PGlite) with links, metrics history, articles and a current board.
 * Test: `npx vitest run tests/unit/codex-merge-t76.test.ts`. No server, no network.
 */

import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { RankingEngineV76 } from "../../lib/ranking-algorithm-v76";
import { loadCheckedInScoringProfiles, profileWeights } from "../../lib/scoring-profiles";
import { runMigrations, splitStatements } from "../../scripts/apply-migrations";
import {
  checkCodexRows,
  CODEX_DESCRIPTION,
  CODEX_FETCHED,
  CODEX_WEBSITE,
  countNewsMentions,
  planSurvivorData,
} from "../../scripts/codex-merge";
import { mergedTools } from "../../scripts/codex-merge-board";
import { derivePairs, MERGE_SETS, type MergeDb, type ToolRow } from "../../scripts/duplicate-tool-merge";
import { type MergeMode, parseArgs, runMerge } from "../../scripts/merge-duplicate-tools";
import { chainDb, MIGRATION_FILES, readMigration } from "./fixtures/migration-chain-183";
import { pgliteMigrationDb } from "./fixtures/timestamptz-237-fixture";

const NOW = new Date("2026-11-10T12:00:00Z");
const FINGERPRINT = "sha256:0123456789abcdef";

/** openai-codex as the public API shows it (2026-11-10), plus an unsourced user count. */
function survivorData(): Record<string, unknown> {
  return {
    id: "40",
    name: "OpenAI Codex",
    website_url: "https://openai.com/codex",
    description: "OpenAI Codex evolved in 2025 from the AI model powering GitHub Copilot to include GPT-5-Codex for agentic workflows.",
    tagline: "AI system that translates natural language to code",
    features: ["Natural language to code translation", "Multi-language code generation", "Code completion and suggestions", "API-based integration"],
    pricing_model: "api-based",
    metrics: { users: 50000, news_mentions: 9 },
    business_metrics_provenance: {
      fields: { news_mentions: { value: 9, source: "https://aipowerranking.com/api/news", migration: "0024", issue: "#313", as_of: "2026-10-27" } },
    },
    info: {
      metrics: {},
      summary: "AI system that translates natural language to code",
      website: "https://openai.com/codex",
      business: { free_tier: false, base_price: null, pricing_model: "api-based", enterprise_pricing: true },
      features: ["Natural language to code translation", "Multi-language code generation", "Code completion and suggestions", "API-based integration"],
      technical: {
        tool_support: false,
        llm_providers: ["OpenAI Codex"],
        context_window: 8000,
        language_support: ["Python", "JavaScript", "TypeScript", "Java", "C++", "C#", "PHP", "Ruby", "Go", "Rust", "SQL", "Shell"],
        multi_file_support: false,
        subprocess_support: false,
      },
      description: "OpenAI Codex is the AI model powering GitHub Copilot and other code generation tools.",
    },
  };
}

/** openai-codex-cli as the public API shows it, with the Terminal-Bench and SWE-bench figures it carries. */
function cliData(): Record<string, unknown> {
  return {
    id: "24",
    name: "OpenAI Codex CLI",
    website_url: "https://openai.com/research/codex-cli",
    description: "Modern CLI tool powered by o3 reasoning model for autonomous software engineering",
    tagline: "Terminal-based AI coding agent",
    features: [],
    metrics: { users: 7000, news_mentions: 12, terminal_bench: 83.1, swe_bench: { verified: 74.9 } },
    metrics_provenance: { terminal_bench: { source: "https://www.tbench.ai/leaderboard/terminal-bench/2.1", as_of: "2026-06-07" } },
    business_metrics_provenance: {
      fields: {
        users: { value: 7000, source: "https://example.org/codex-wau", as_of: "2026-03-31" },
        news_mentions: { value: 12, source: "https://aipowerranking.com/api/news", migration: "0024", issue: "#313", as_of: "2026-10-27" },
      },
    },
    info: {
      metrics: {},
      summary: "Terminal-based AI coding agent",
      website: "https://openai.com/research/codex-cli",
      business: { pricing_model: "open-source" },
      features: [],
      technical: {
        cli_based: true,
        tool_support: true,
        llm_providers: ["OpenAI o3", "OpenAI GPT-4"],
        context_window: 128000,
        language_support: ["Python", "JavaScript", "TypeScript", "Java", "C++", "C#", "Go", "Rust", "Ruby"],
        multi_file_support: true,
        subprocess_support: true,
      },
      description: "Modern CLI tool powered by o3 reasoning model for autonomous software engineering",
    },
  };
}

const row = (slug: string, data: Record<string, unknown>, status = "active", kind = "harness"): ToolRow => ({
  id: `00000000-0000-4000-8000-0000000000${slug === "openai-codex" ? "40" : "24"}`,
  slug,
  status,
  kind,
  data,
});

describe("checkCodexRows (guards)", () => {
  it("passes both active rows as `merge` and the finished merge as `already-merged`", () => {
    const fresh = checkCodexRows([row("openai-codex", survivorData()), row("openai-codex-cli", cliData())]);
    expect(fresh).toMatchObject({ ok: true, state: "merge" });
    const done = checkCodexRows([
      row("openai-codex", { ...survivorData(), merged_from: ["openai-codex-cli"] }),
      row("openai-codex-cli", { ...cliData(), redirect_to: "openai-codex" }, "redirect"),
    ]);
    expect(done).toMatchObject({ ok: true, state: "already-merged" });
  });

  it.each([
    ["a missing CLI row", [row("openai-codex", survivorData())], "row openai-codex-cli is missing"],
    ["another data id", [row("openai-codex", { ...survivorData(), id: "41" }), row("openai-codex-cli", cliData())], "openai-codex has data.id 41, expected 40"],
    ["a model-kind row", [row("openai-codex", survivorData()), row("openai-codex-cli", cliData(), "active", "model")], "openai-codex-cli is kind model, expected harness"],
    ["a retired survivor", [row("openai-codex", survivorData(), "inactive"), row("openai-codex-cli", cliData())], "openai-codex is inactive, expected active"],
    ["a conflicting data.slug", [row("openai-codex", { ...survivorData(), slug: "codex" }), row("openai-codex-cli", cliData())], 'openai-codex carries data.slug "codex"'],
    [
      "a CLI row redirecting elsewhere",
      [row("openai-codex", survivorData()), row("openai-codex-cli", { ...cliData(), redirect_to: "chatgpt-canvas" }, "redirect")],
      "unexpected state: openai-codex-cli is redirect (redirect_to \"chatgpt-canvas\"), openai-codex lacks the merge marker",
    ],
    [
      "a half merge (CLI retired, survivor unmarked)",
      [row("openai-codex", survivorData()), row("openai-codex-cli", { ...cliData(), redirect_to: "openai-codex" }, "redirect")],
      "unexpected state: openai-codex-cli is redirect (redirect_to \"openai-codex\"), openai-codex lacks the merge marker",
    ],
  ])("refuses %s", (_label, rows, problem) => {
    const check = checkCodexRows(rows);
    expect(check.ok).toBe(false);
    expect(check.ok ? [] : check.problems).toContain(problem);
  });
});

describe("planSurvivorData (field by field)", () => {
  const survivor = row("openai-codex", survivorData());
  const old = row("openai-codex-cli", cliData());
  const plan = planSurvivorData(survivor, old, { newsMentions: 17, asOf: "2026-11-10" });
  const data = plan.data as Record<string, any>;

  it("writes the fetched stars and npm downloads in the 0024 shape the engine reads, with provenance", () => {
    expect(data.metrics.github_stars).toBe(134417);
    expect(data.metrics.npm).toEqual({ package_name: "@openai/codex", downloads_last_month: 96036077, collected_at: "2026-11-10", window: "2026-10-10..2026-11-08" });
    expect(data.business_metrics_provenance.fields.github_stars).toEqual({
      value: 134417, source: "https://api.github.com/repos/openai/codex", migration: "codex-merge", issue: "ar-Te2/T76", as_of: "2026-11-10", fetched_at: CODEX_FETCHED.fetched_at,
    });
    expect(data.business_metrics_provenance.fields.npm.value).toEqual(data.metrics.npm);
    expect(data.business_metrics_provenance.fields.npm.source).toBe("https://api.npmjs.org/downloads/point/2026-10-10:2026-11-08/@openai%2Fcodex");
    expect(data.metrics.news_mentions).toBe(17);
    expect(data.business_metrics_provenance.fields.news_mentions).toMatchObject({ value: 17, as_of: "2026-11-10", window: "12 months" });
  });

  it("keeps the survivor's identity and fixes its description and website", () => {
    expect([data.id, data.name]).toEqual(["40", "OpenAI Codex"]);
    expect(data.description).toBe(CODEX_DESCRIPTION);
    expect(data.info.description).toBe(CODEX_DESCRIPTION);
    expect(CODEX_DESCRIPTION).not.toMatch(/GitHub Copilot/);
    expect([data.website_url, data.info.website]).toEqual([CODEX_WEBSITE, CODEX_WEBSITE]);
  });

  it("carries the CLI's benchmarks and sourced users, its technical block and the union of languages", () => {
    expect(data.metrics.terminal_bench).toBe(83.1);
    expect(data.metrics_provenance.terminal_bench.as_of).toBe("2026-06-07");
    expect(data.metrics.swe_bench).toEqual({ verified: 74.9 });
    // Sourced (as_of 2026-03-31) beats unsourced.
    expect(data.metrics.users).toBe(7000);
    expect(data.business_metrics_provenance.fields.users.as_of).toBe("2026-03-31");
    expect(data.info.technical).toMatchObject({ context_window: 128000, multi_file_support: true, cli_based: true, llm_providers: ["OpenAI o3", "OpenAI GPT-4"] });
    expect(data.info.technical.language_support).toHaveLength(12); // the CLI's nine are all in the survivor's twelve
    // The survivor's non-empty fields stay; its features are not replaced by the CLI's empty list.
    expect(data.info.features).toHaveLength(4);
    expect(data.info.business).toEqual((survivorData()["info"] as any).business);
    expect(data.merged_from).toEqual(["openai-codex-cli"]);
  });

  it("names every decision and mutates neither input", () => {
    expect(plan.decisions).toContain("  field metrics.terminal_bench: cli value taken with its provenance (survivor undefined as_of none, cli 83.1 as_of 2026-06-07)");
    expect(plan.decisions.some((l) => l.startsWith("  field metrics.users: cli value taken"))).toBe(true);
    expect(survivor.data).toEqual(survivorData());
    expect(old.data).toEqual(cliData());
  });

  it("keeps the survivor's value when the CLI's provenance is not newer", () => {
    const sourced = survivorData();
    (sourced["business_metrics_provenance"] as any).fields.users = { value: 50000, source: "https://example.org/x", as_of: "2026-09-30" };
    const p = planSurvivorData(row("openai-codex", sourced), old, { newsMentions: 1, asOf: "2026-11-10" });
    expect((p.data as any).metrics.users).toBe(50000);
  });

  it("takes the CLI's value when neither row sources it", () => {
    const cli = cliData();
    delete (cli["business_metrics_provenance"] as any).fields.users;
    const p = planSurvivorData(survivor, row("openai-codex-cli", cli), { newsMentions: 1, asOf: "2026-11-10" });
    expect((p.data as any).metrics.users).toBe(7000);
  });

  it("sets the fetched stars on a github block stored only under info.metrics", () => {
    const nested = survivorData();
    (nested["info"] as any).metrics = { github: { stars: 10, forks: 3 } };
    const d = planSurvivorData(row("openai-codex", nested), old, { newsMentions: 1, asOf: "2026-11-10" }).data as any;
    expect(d.metrics.github).toEqual({ stars: 134417, forks: 3 });
  });

  it("the v8.1 harness engine reads the merged row: completeness, adoption and score rise", () => {
    const weights = profileWeights(loadCheckedInScoringProfiles(), "v8.1", "harness");
    const engine = new RankingEngineV76(weights);
    const score = (d: Record<string, unknown>) =>
      engine.calculateToolScore(
        { tool_id: "t", name: "OpenAI Codex", slug: "openai-codex", category: "autonomous-agent", status: "active", info: d, metrics: (d["metrics"] as never) ?? {} } as never,
        NOW
      );
    const before = score(survivorData());
    const after = score(plan.data);
    expect(after.dataCompleteness).toBeGreaterThan(before.dataCompleteness);
    expect(after.confidenceMultiplier).toBeGreaterThan(before.confidenceMultiplier);
    expect(after.factorScores["developerAdoption"]).toBeGreaterThan(before.factorScores["developerAdoption"]!);
    expect(after.overallScore).toBeGreaterThan(before.overallScore);
  });
});

describe("countNewsMentions", () => {
  const catalogue = [
    { id: "40", db_id: "u40", slug: "openai-codex", name: "OpenAI Codex", kind: "harness", status: "active" },
    { id: "24", db_id: "u24", slug: "openai-codex-cli", name: "OpenAI Codex CLI", kind: "harness", status: "active" },
  ];
  const articles = [
    { title: "OpenAI Codex ships a desktop app", toolMentions: [{ tool: "OpenAI Codex", relevance: 0.9 }] },
    { title: "Codex CLI adds sandboxing", toolMentions: [{ tool: "OpenAI Codex CLI", relevance: 0.9 }] },
    { title: "OpenAI Codex CLI and OpenAI Codex", toolMentions: [{ toolId: "24", relevance: 0.9 }] },
    { title: "Unrelated", toolMentions: [] },
  ];

  it("counts an article tagged to either row once, after the merge", () => {
    expect(countNewsMentions({ catalogue, articles })).toEqual({ survivor: 1, old: 2, merged: 3 });
  });
});

describe("board report", () => {
  it("scores the after board without the CLI row and with the survivor's planned data", () => {
    const tool = (slug: string) => ({ id: slug, name: slug, slug, category: "autonomous-agent", status: "active", kind: "harness", data: { id: slug } });
    const after = mergedTools([tool("openai-codex"), tool("openai-codex-cli"), tool("cursor")], { id: "40", merged: true });
    expect(after.map((t) => t.slug)).toEqual(["openai-codex", "cursor"]);
    expect(after[0]!.data).toEqual({ id: "40", merged: true });
    expect(after[1]!.data).toEqual({ id: "cursor" });
  });
});

describe("parseArgs --set", () => {
  it("defaults to d90 and accepts codex", () => {
    expect(parseArgs([]).set).toBe(MERGE_SETS.d90);
    expect(parseArgs(["--set", "codex", "--dry-run"])).toMatchObject({ set: MERGE_SETS.codex, mode: { mode: "dry-run" } });
    expect(parseArgs(["--set", "other"]).errors).toEqual(["--set needs one of d90, codex"]);
  });

  it("derives the one Codex pair from the URL table", () => {
    expect(derivePairs(MERGE_SETS.codex.oldSlugs)).toEqual([{ oldSlug: "openai-codex-cli", newSlug: "openai-codex" }]);
  });
});

/** A MergeDb over PGlite that records every statement. */
function recording(db: PGlite, statements: string[]): MergeDb {
  return {
    query: (text, params) => {
      statements.push(text);
      return db.query(text, params);
    },
    transaction: (fn) => {
      statements.push("BEGIN");
      return db.transaction((tx) =>
        fn({
          query: (text, params) => {
            statements.push(text);
            return tx.query(text, params);
          },
        })
      );
    },
  };
}

async function idOf(db: PGlite, slug: string): Promise<string> {
  return (await db.query<{ id: string }>(`SELECT id FROM public."tools" WHERE slug = $1`, [slug])).rows[0]!.id;
}

async function snapshot(db: PGlite) {
  const q = async (sql: string) => (await db.query(sql)).rows;
  return {
    tools: await q(`SELECT slug, status, data::text, updated_at::text FROM public."tools" ORDER BY slug`),
    links: await q(`SELECT id, model_tool_id, harness_tool_id, relation FROM public."tool_links" ORDER BY id`),
    metrics: await q(`SELECT id, tool_id, collected_date::text FROM public."tool_metrics_history" ORDER BY id`),
  };
}

describe("runMerge --set codex on the migration chain", () => {
  let db: PGlite;
  const dir = mkdtempSync(path.join(os.tmpdir(), "codex-merge-"));
  const run = async (mode: MergeMode, statements: string[] = []) => {
    const log: string[] = [];
    const code = await runMerge(
      { db: recording(db, statements), fingerprint: FINGERPRINT, log: (l) => log.push(l), now: () => NOW },
      mode,
      MERGE_SETS.codex
    );
    return { code, log, statements };
  };

  beforeAll(async () => {
    const backfill = "0017_backfill_tool_kind.sql";
    db = await chainDb(backfill);
    const files = { list: () => [...MIGRATION_FILES], read: readMigration };
    expect((await runMigrations({ db: pgliteMigrationDb(db), files, log: () => {} }, { dryRun: false, only: backfill, showColumns: null, force: false })).exitCode).toBe(0);
    for (const file of MIGRATION_FILES.filter((f) => f.startsWith("0020") || f.startsWith("0021"))) {
      for (const statement of splitStatements(readMigration(file))) await db.exec(statement);
    }
    const set = (slug: string, data: Record<string, unknown>) =>
      db.query(`UPDATE public."tools" SET data = $2::jsonb WHERE slug = $1`, [slug, JSON.stringify(data)]);
    await set("openai-codex", survivorData());
    await set("openai-codex-cli", cliData());
    await db.query(`INSERT INTO public."tool_links" (model_tool_id, harness_tool_id, relation) VALUES ($1, $2, 'supports')`, [
      await idOf(db, "opus-4-6"),
      await idOf(db, "openai-codex-cli"),
    ]);
    for (const [slug, day] of [["openai-codex-cli", "2026-11-01"], ["openai-codex", "2026-11-01"], ["openai-codex-cli", "2026-10-01"]] as const) {
      await db.query(`INSERT INTO public."tool_metrics_history" (tool_id, tool_slug, collected_date, period) VALUES ($1, $2, $3, '2026-11')`, [await idOf(db, slug), slug, day]);
    }
    const article = (slug: string, title: string, mentions: unknown[], published: string) =>
      db.query(
        `INSERT INTO public."articles" (slug, title, content, ingestion_type, tool_mentions, published_date) VALUES ($1, $2, 'x', 'url', $3::jsonb, $4)`,
        [slug, title, JSON.stringify(mentions), published]
      );
    await article("a1", "OpenAI Codex ships a desktop app", [{ tool: "OpenAI Codex", relevance: 0.9 }], "2026-10-20");
    await article("a2", "Codex CLI adds sandboxing", [{ tool: "OpenAI Codex CLI", relevance: 0.9 }], "2026-10-21");
    await article("a3", "Old Codex story", [{ tool: "OpenAI Codex CLI", relevance: 0.9 }], "2025-01-01"); // outside the window
    await db.query(`INSERT INTO public."rankings" (period, algorithm_version, is_current, list, data) VALUES ('2026-11', '8.1', true, 'harness', $1::jsonb)`, [
      JSON.stringify([
        { tool_id: await idOf(db, "openai-codex"), tool_slug: "openai-codex", rank: 23, score: 48.34 },
        { tool_id: await idOf(db, "openai-codex-cli"), tool_slug: "openai-codex-cli", rank: 32, score: 44.29 },
      ]),
    ]);
  }, 120_000);
  afterAll(async () => {
    await db.close();
  });

  it("dry run issues SELECTs only under a read-only session, prints the plan and the board, changes nothing", async () => {
    const before = await snapshot(db);
    await db.exec("SET default_transaction_read_only = on");
    const { code, log, statements } = await run({ mode: "dry-run" });
    await db.exec("SET default_transaction_read_only = off");
    expect(code).toBe(0);
    for (const s of statements) expect(s.trim()).toMatch(/^SELECT\b/);
    expect(await snapshot(db)).toEqual(before);
    expect(log).toContain("pair 1/1: openai-codex-cli -> openai-codex [merge]");
    expect(log).toContain("codex: guards passed; state merge");
    expect(log).toContain("codex: news mentions (12 months): openai-codex 1, openai-codex-cli 1, merged 2");
    expect(log.some((l) => l.startsWith("  field metrics.github_stars: set to 134417"))).toBe(true);
    expect(log).toContain("board: published 2026-11: openai-codex rank 23 score 48.34; openai-codex-cli rank 32 score 44.29");
    const after = log.find((l) => l.startsWith("board: after: "));
    expect(after).toMatch(/^board: after: {2}openai-codex rank \d+ score [\d.]+; openai-codex-cli not on the board$/);
    expect(log).toContain("board: harness top 10 before:");
    expect(log).toContain("board: harness top 10 after:");
    const text = log.join("\n");
    expect(text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/); // no row ids
    expect(text).not.toMatch(/postgres(ql)?:\/\/|sha256:/); // no connection detail
  });

  it("apply refuses a D90 backup and a guard failure, writing nothing", async () => {
    const file = path.join(dir, "backup.json");
    expect((await run({ mode: "backup", file })).code).toBe(0);
    const backup = JSON.parse(readFileSync(file, "utf8"));
    expect(backup.ruling).toBe("ar-Te2/T76");
    const before = await snapshot(db);

    const d90 = path.join(dir, "d90.json");
    writeFileSync(d90, JSON.stringify({ ...backup, ruling: "D90" }));
    const wrongSet = await run({ mode: "apply", backupFile: d90 });
    expect(wrongSet.log.at(-1)).toBe("--apply: refused, nothing written: the backup was taken for D90, not ar-Te2/T76");

    const noSurvivor = path.join(dir, "no-survivor.json");
    writeFileSync(noSurvivor, JSON.stringify({ ...backup, tools: backup.tools.filter((t: { slug: string }) => t.slug !== "openai-codex") }));
    expect((await run({ mode: "apply", backupFile: noSurvivor })).log.at(-1)).toBe("--apply: refused, nothing written: the backup lacks the openai-codex row");

    await db.query(`UPDATE public."tools" SET data = data || '{"id": "41"}'::jsonb WHERE slug = 'openai-codex'`);
    const guarded = await snapshot(db);
    const dry = await run({ mode: "dry-run" });
    expect(dry.code).toBe(1);
    expect(dry.log).toContain("codex: UNRESOLVED: openai-codex has data.id 41, expected 40");
    const refused = await run({ mode: "apply", backupFile: file });
    expect(refused.code).toBe(1);
    expect(refused.log.at(-1)).toBe("--apply: refused, nothing written: codex guard: openai-codex has data.id 41, expected 40");
    expect(await snapshot(db)).toEqual(guarded);
    await db.query(`UPDATE public."tools" SET data = data || '{"id": "40"}'::jsonb WHERE slug = 'openai-codex'`);
    expect((await snapshot(db)).links).toEqual(before.links);
  });

  it("apply merges in one transaction; a re-run is a no-op", async () => {
    const file = path.join(dir, "backup-2.json");
    expect((await run({ mode: "backup", file })).code).toBe(0);
    const { code, log, statements } = await run({ mode: "apply", backupFile: file });
    expect(log.at(-1)).toBe("--apply: committed (merged)");
    expect(code).toBe(0);
    expect(statements.filter((s) => s === "BEGIN")).toHaveLength(1);

    const rows = await db.query<{ slug: string; status: string; data: Record<string, any> }>(
      `SELECT slug, status, data FROM public."tools" WHERE slug IN ('openai-codex', 'openai-codex-cli') ORDER BY slug`
    );
    const [survivor, old] = rows.rows;
    expect(old).toMatchObject({ status: "redirect", data: { redirect_to: "openai-codex", redirect_reason: "ar-Te2/T76: merged into openai-codex", previous_status: "active" } });
    expect(survivor!.status).toBe("active");
    expect(survivor!.data.metrics).toMatchObject({ github_stars: 134417, npm: { downloads_last_month: 96036077 }, news_mentions: 2, terminal_bench: 83.1 });
    expect(survivor!.data.description).toBe(CODEX_DESCRIPTION);
    expect(survivor!.data.merged_from).toEqual(["openai-codex-cli"]);
    const links = await db.query<{ h: string }>(`SELECT h.slug AS h FROM public."tool_links" l JOIN public."tools" h ON h.id = l.harness_tool_id`);
    expect(links.rows.map((r) => r.h)).toEqual(["openai-codex"]);
    const history = await db.query<{ slug: string | null; n: number }>(
      `SELECT t.slug, count(*)::int AS n FROM public."tool_metrics_history" m LEFT JOIN public."tools" t ON t.id = m.tool_id GROUP BY 1 ORDER BY 1`
    );
    // The 11-01 CLI row collides with the survivor's day (D90 rule: tool_id NULL, row kept).
    expect(history.rows).toEqual([{ slug: "openai-codex", n: 2 }, { slug: null, n: 1 }]);

    const merged = await snapshot(db);
    const again = await run({ mode: "apply", backupFile: file });
    expect(again.log.at(-1)).toBe("--apply: committed (no-op, already merged)");
    expect(await snapshot(db)).toEqual(merged);
    const dry = await run({ mode: "dry-run" });
    expect(dry.code).toBe(0);
    expect(dry.log).toContain("codex: guards passed; state already-merged");
  });
});
