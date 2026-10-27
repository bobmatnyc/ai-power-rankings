/**
 * #313, #312: migration 0024 (harness input corrections) on the real migration chain (PGlite).
 *
 * Why: 0024 is applied by hand to production. It must write the sourced figures, refuse and
 *   write nothing when a stored value is not the one the file expects, change nothing on a
 *   re-run, record provenance, and compute news_mentions from the articles table.
 * What: applies migrations 0000..0017 to PGlite, seeds the 66 harness tools with their expected old
 *   values, then runs the committed 0024 through `runMigrations --only`. Checks the guard
 *   (a changed old value raises, nothing is written, nothing is recorded), idempotence,
 *   delete semantics, provenance, the kept tools, group c against seeded articles, and a build
 *   with groups left out. Also: the identity guard of rows 4, 19 and 20, the info.metrics shadow
 *   guard, full harness coverage of group c, and that updated_at is left alone.
 * Test: `npx vitest run tests/unit/harness-inputs-0024-313.test.ts`. No server, no network.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildHarnessInputsSql, HARNESS_INPUTS_MIGRATION } from "../../lib/db/harness-inputs-sql";
import { addArticle, apply0024, expectedNewsCounts, KEPT_TOOLS, kindedChainDb, ROWS, seedOldState, toolsState } from "./fixtures/harness-inputs-313";
import { readMigration, REPO_ROOT } from "./fixtures/migration-chain-183";
import { pgliteMigrationDb } from "./fixtures/timestamptz-237-fixture";

const FILE = HARNESS_INPUTS_MIGRATION;
const data = async (db: PGlite, slug: string) =>
  (await db.query<{ data: any }>(`SELECT data FROM public."tools" WHERE slug = $1`, [slug])).rows[0]!.data;

async function freshDb(articles = true): Promise<PGlite> {
  const db = await kindedChainDb();
  await seedOldState(db);
  if (articles) {
    await addArticle(db, { slug: "a1", title: "Claude Code ships a new release", mentions: [{ name: "Claude Code", relevance: 0.9 }] });
    await addArticle(db, { slug: "a2", title: "Cursor raises money", mentions: [{ tool: "Cursor", relevance: 0.8 }, { name: "Claude Code", relevance: 0.3 }] });
    await addArticle(db, { slug: "a3", title: "Old news", mentions: [{ name: "Claude Code", relevance: 1 }], daysAgo: 400 });
    await addArticle(db, { slug: "a4", title: "Draft piece", mentions: [{ name: "Claude Code", relevance: 1 }], status: "draft" });
    await addArticle(db, { slug: "a5", title: "Undated Claude Code review", mentions: [], noPublishedDate: true, daysAgo: 5 });
  }
  return db;
}

describe("#313 the committed 0024 file", () => {
  it("is one guarded DO block and touches no weight, company or ranking column", () => {
    const sql = readMigration(FILE);
    expect(sql.match(/^DO \$k313\$$/gm)).toHaveLength(1);
    expect(sql).toContain("SET LOCAL lock_timeout = '5s';");
    expect(sql).toContain("FOR UPDATE;");
    expect(sql).toContain("slugs missing from tools");
    expect(sql).toContain("post-check failed");
    expect(sql.match(/\bUPDATE public\."tools"/g)).toHaveLength(1);
    expect(sql).not.toMatch(/\b(INSERT INTO public|DELETE FROM public|DROP TABLE|ALTER TABLE|TRUNCATE)\b/);
    expect(readFileSync(path.join(REPO_ROOT, "docs/refresh/harness-inputs-2026-10.json"), "utf8")).toContain('"issue": "#313"');
  });
});

describe("#313 0024 on the migration chain (PGlite)", () => {
  let db: PGlite;
  let migrationDb: ReturnType<typeof pgliteMigrationDb>;
  let before: Awaited<ReturnType<typeof toolsState>>;
  let first: Awaited<ReturnType<typeof apply0024>>;
  let expectedNews: Record<string, number>;

  beforeAll(async () => {
    db = await freshDb();
    before = await toolsState(db);
    expectedNews = await expectedNewsCounts(db);
    migrationDb = pgliteMigrationDb(db);
    first = await apply0024(db, migrationDb);
  }, 120_000);
  afterAll(async () => {
    await db.close();
  });

  it("applies through the runner, writes every file row and records the file once", async () => {
    expect(first.exitCode, first.lines.join("\n")).toBe(0);
    expect(await migrationDb.listAppliedFilenames()).toEqual([FILE]);
    expect(migrationDb.notices).toContain(`#313 0024: ${ROWS.length} rows over ${new Set(ROWS.map((r) => r.slug)).size} tools: ${ROWS.length} changed, 0 already at target`);
  });

  it("writes the sourced figures and replaces Claude Code's npm object", async () => {
    const cc = await data(db, "claude-code");
    expect(cc.metrics.monthly_arr).toBe(2500000000);
    expect(cc.metrics.github_stars).toBe(153527);
    expect(cc.metrics.npm).toEqual({ package_name: "@anthropic-ai/claude-code", downloads_last_month: 44789616, collected_at: "2026-10-27", window: "2026-09-24..2026-10-23" });
    expect(cc.metrics.vscode.installs).toBe(28782113);
    const copilot = await data(db, "github-copilot");
    expect(copilot.info.metrics).toMatchObject({ github_stars: 11296, users: 4700000 });
    expect(copilot.metrics.npm.downloads_last_month).toBe(5791014);
    expect(copilot.metrics.vscode.installs).toBe(74815310);
    expect((await data(db, "cursor")).info.metrics.monthly_arr).toBe(1000000000);
  });

  it("deletes: absent after the run, siblings kept", async () => {
    const cc = await data(db, "claude-code");
    for (const field of ["pypi"]) expect(cc.metrics[field]).toBeUndefined();
    for (const container of [cc.info.metrics, cc.metrics]) {
      expect(container.valuation).toBeUndefined();
      expect(container.funding).toBeUndefined();
    }
    expect((await data(db, "cursor")).metrics.vscode).toBeUndefined();
    expect((await data(db, "github-copilot")).info.metrics.monthly_arr).toBeUndefined();
    expect((await data(db, "github-copilot")).metrics.pypi).toBeUndefined();
    const snyk = await data(db, "snyk-code");
    expect(["valuation", "funding", "monthly_arr"].map((f) => snyk.metrics[f])).toEqual([undefined, undefined, undefined]);
    expect((await data(db, "claude-code")).info.metrics.news_mentions).toBeTypeOf("number");
  });

  it("(d) leaves replit-agent, devin and sourcegraph-cody their own figures", async () => {
    for (const slug of KEPT_TOOLS) {
      expect((await data(db, slug)).metrics).toMatchObject({ valuation: 9000000000, funding: 400000000, monthly_arr: 1000000000 });
    }
  });

  it("writes provenance where stored provenance lives, and drops the removed values' entries", async () => {
    const cc = await data(db, "claude-code");
    const fields = cc.business_metrics_provenance.fields;
    expect(fields.valuation).toBeUndefined();
    expect(fields.funding).toBeUndefined();
    expect(cc.business_metrics_provenance.parent_note).toBe("corporate-level");
    expect(fields.monthly_arr).toMatchObject({ value: 2500000000, as_of: "2026-02-12", migration: "0024", issue: "#313" });
    expect(fields.monthly_arr.source).toMatch(/anthropic\.com/);
    expect(fields.npm.value.package_name).toBe("@anthropic-ai/claude-code");
    expect(cc.metrics_provenance).toBeUndefined();
  });

  it("group c: each count is the TypeScript corpus rule over the seeded articles (active, in window)", async () => {
    expect(expectedNews["claude-code"]).toBe(2); // a1 and a2 (a3 is too old, a4 a draft)
    for (const row of ROWS.filter((r) => r.group === "c")) {
      const container = row.path[0] === "info" ? (await data(db, row.slug)).info.metrics : (await data(db, row.slug)).metrics;
      expect([row.slug, container.news_mentions]).toEqual([row.slug, expectedNews[row.slug] ?? 0]);
    }
    expect((await data(db, "claude-code")).business_metrics_provenance.fields.news_mentions).toMatchObject({ window: "12 months", migration: "0024" });
  });

  it("changes no column but data, and no tool outside the file", async () => {
    const after = await toolsState(db);
    const touched = new Set(ROWS.map((r) => r.slug));
    for (const [i, b] of before.entries()) {
      const a = after[i]!;
      const strip = (r: any) => ({ ...r.row, data: undefined });
      expect(strip(a)).toEqual(strip(b));
      if (!touched.has(b.slug as string)) expect(a).toEqual(b);
    }
  });

  it("group c covers every active harness tool and leaves none to a drift notice", async () => {
    const harness = (await db.query<{ slug: string }>(`SELECT slug FROM public."tools" WHERE kind = 'harness' AND status = 'active' ORDER BY slug`)).rows.map((r) => r.slug);
    expect(harness.length).toBeGreaterThan(60);
    const covered = new Set(ROWS.filter((r) => r.group === "c").map((r) => r.slug));
    // The one harness row outside the file is a fixture tool that is not in production or the kind sheet.
    expect(harness.filter((slug) => !covered.has(slug))).toEqual(["unreviewed-new-tool"]);
    for (const slug of harness.filter((s) => covered.has(s))) {
      const tool = await data(db, slug);
      expect([slug, tool.metrics?.news_mentions ?? tool.info?.metrics?.news_mentions]).toEqual([slug, expectedNews[slug] ?? 0]);
    }
    expect(migrationDb.notices.filter((n) => n.includes("outside the change list"))).toEqual([]);
  });

  it("does not bump updated_at on any row (a data correction is not a public update)", async () => {
    const after = await toolsState(db);
    for (const [i, b] of before.entries()) expect([b.slug, after[i]!.row.updated_at]).toEqual([b.slug, b.row.updated_at]);
  });

  it("a forced re-run changes nothing", async () => {
    const state = await toolsState(db);
    migrationDb.notices.length = 0;
    await addArticle(db, { slug: "late", title: "Claude Code again", mentions: [{ name: "Claude Code", relevance: 1 }] });
    const again = await apply0024(db, migrationDb, true);
    expect(again.exitCode, again.lines.join("\n")).toBe(0);
    expect(migrationDb.notices).toContain(`#313 0024: ${ROWS.length} rows over ${new Set(ROWS.map((r) => r.slug)).size} tools: 0 changed, ${ROWS.length} already at target`);
    expect(await toolsState(db)).toEqual(state); // the new article does not move a value this migration wrote
  });
});

describe("#313 0024 refuses an unexpected old value", () => {
  it.each([
    ["a changed scalar (vscode installs)", `UPDATE public."tools" SET data = jsonb_set(data, '{metrics,vscode,installs}', '999') WHERE slug = 'claude-code'`, /claude-code.*refusing to overwrite/],
    ["a value where nothing was expected (github_stars)", `UPDATE public."tools" SET data = jsonb_set(data, '{metrics,github_stars}', '1') WHERE slug = 'cursor'`, /cursor.*refusing to overwrite/],
    ["a changed value to delete (valuation)", `UPDATE public."tools" SET data = jsonb_set(data, '{metrics,valuation}', '1') WHERE slug = 'bolt-new'`, /bolt-new.*refusing to delete/],
    ["a changed object to delete (cursor vscode)", `UPDATE public."tools" SET data = jsonb_set(data, '{metrics,vscode,installs}', '1') WHERE slug = 'cursor'`, /cursor.*refusing to delete/],
  ])("%s: raises, writes nothing, records nothing", async (_name, edit, message) => {
    const db = await freshDb();
    await db.exec(edit);
    const state = await toolsState(db);
    const migrationDb = pgliteMigrationDb(db);
    const result = await apply0024(db, migrationDb);
    expect(result.exitCode).toBe(1);
    expect(result.lines.join("\n")).toMatch(message);
    expect(await toolsState(db)).toEqual(state);
    expect(await migrationDb.listAppliedFilenames()).toEqual([]);
    await db.close();
  }, 120_000);

  it.each([
    ["a sourced figure on info.metrics (cursor monthly_arr)", "cursor", "monthly_arr", /cursor.*info\.metrics.*shadowed/],
    ["a computed count on info.metrics (claude-code news_mentions)", "claude-code", "news_mentions", /claude-code.*info\.metrics.*shadowed/],
  ])("%s: a data.metrics key of the same name would shadow the write, so it raises and writes nothing", async (_name, slug, field, message) => {
    const db = await freshDb();
    await db.query(`UPDATE public."tools" SET data = jsonb_set(data, ARRAY['metrics', $2], '7'::jsonb, true) WHERE slug = $1`, [slug, field]);
    const state = await toolsState(db);
    const migrationDb = pgliteMigrationDb(db);
    const result = await apply0024(db, migrationDb);
    expect(result.exitCode).toBe(1);
    expect(result.lines.join("\n")).toMatch(message);
    expect(await toolsState(db)).toEqual(state);
    expect(await migrationDb.listAppliedFilenames()).toEqual([]);
    await db.close();
  }, 120_000);

  it.each([
    ["row 4: claude-code VS Code extension id", "claude-code", "{metrics,vscode,extension_id}", /claude-code.*identity/],
    ["row 19: github-copilot npm package id", "github-copilot", "{metrics,npm,package_name}", /github-copilot.*identity/],
    ["row 20: github-copilot VS Code extension id", "github-copilot", "{metrics,vscode,extension_id}", /github-copilot.*identity/],
  ])("%s: a different stored package or extension raises, writes nothing", async (_name, slug, where, message) => {
    const db = await freshDb();
    await db.query(`UPDATE public."tools" SET data = jsonb_set(data, $2::text[], '"someone.else"'::jsonb) WHERE slug = $1`, [slug, where]);
    const state = await toolsState(db);
    const migrationDb = pgliteMigrationDb(db);
    const result = await apply0024(db, migrationDb);
    expect(result.exitCode).toBe(1);
    expect(result.lines.join("\n")).toMatch(message);
    expect(await toolsState(db)).toEqual(state);
    expect(await migrationDb.listAppliedFilenames()).toEqual([]);
    await db.close();
  }, 120_000);

  it("a drifted news_mentions on a harness tool the old list left out raises, it is not just noticed", async () => {
    const db = await freshDb();
    await db.exec(`UPDATE public."tools" SET data = data || '{"metrics": {"news_mentions": 999}}'::jsonb WHERE slug = 'warp'`);
    const state = await toolsState(db);
    const result = await apply0024(db, pgliteMigrationDb(db));
    expect(result.exitCode).toBe(1);
    expect(result.lines.join("\n")).toMatch(/warp.*refusing to overwrite/);
    expect(await toolsState(db)).toEqual(state);
    await db.close();
  }, 120_000);

  it("drift on an active harness tool outside the change list raises, writes nothing, records nothing", async () => {
    const db = await freshDb();
    await db.exec(`UPDATE public."tools" SET data = data || '{"metrics": {"news_mentions": 999}}'::jsonb WHERE slug = 'unreviewed-new-tool'`);
    const state = await toolsState(db);
    const migrationDb = pgliteMigrationDb(db);
    const result = await apply0024(db, migrationDb);
    expect(result.exitCode, result.lines.join("\n")).toBe(1);
    expect(result.lines.join("\n")).toMatch(/unreviewed-new-tool.*999/);
    expect(await toolsState(db)).toEqual(state);
    expect(await migrationDb.listAppliedFilenames()).toEqual([]);
    await db.close();
  }, 120_000);

  it("a missing slug raises before any write", async () => {
    const db = await freshDb();
    await db.exec(`DELETE FROM public."tools" WHERE slug = 'baz'`);
    const result = await apply0024(db, pgliteMigrationDb(db));
    expect(result.exitCode).toBe(1);
    expect(result.lines.join("\n")).toContain("slugs missing from tools: baz");
    await db.close();
  }, 120_000);

  it("an empty news window raises instead of writing zeros", async () => {
    const db = await freshDb(false);
    const state = await toolsState(db);
    const result = await apply0024(db, pgliteMigrationDb(db));
    expect(result.exitCode).toBe(1);
    expect(result.lines.join("\n")).toContain("no active article in the last 12 months");
    expect(await toolsState(db)).toEqual(state);
    await db.close();
  }, 120_000);
});

describe("#313 0024 built with groups left out", () => {
  it("without c and d only the other groups are written", async () => {
    const db = await freshDb(false);
    await db.query(buildHarnessInputsSql(ROWS, { excludeGroups: ["c", "d"] }));
    const cc = await data(db, "claude-code");
    expect(cc.metrics.monthly_arr).toBe(2500000000); // sourced
    expect(cc.metrics.valuation).toBe(965000000000); // d left alone
    expect(cc.info.metrics.news_mentions).toBe(2); // c left alone
    expect((await data(db, "github-copilot")).info.metrics.monthly_arr).toBeUndefined(); // a
    await db.close();
  }, 120_000);
});
