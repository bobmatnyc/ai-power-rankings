/**
 * #314: migrations 0027 (nine new productivity rows) and 0028 (six existing rows move) on the
 * real migration chain (PGlite).
 *
 * Why: 0027 and 0028 are hand-applied to production at different times (0028 with activation, after
 *   11-01). Their claims are executor behaviour: the new rows are inactive and unscored, a clash
 *   refuses and writes nothing, a re-run is a no-op, the rename keeps the slug, a second Claude.AI
 *   row stops the rename, and the three Dd1 harnesses change kind only.
 * What: chain 0000..0016 with the audit's tools, then 0017 and the files under test through
 *   `runMigrations --only`. Row snapshots compare whole rows before and after.
 * Test: `npx vitest run tests/unit/productivity-rows-pglite-314.test.ts`. No server, no network.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseProductivitySeed } from "../../lib/db/repositories/productivity-seed.repository";
import { runMigrations } from "../../scripts/apply-migrations";
import { chainDb, MIGRATION_FILES, readMigration, REPO_ROOT } from "./fixtures/migration-chain-183";
import { pgliteMigrationDb } from "./fixtures/timestamptz-237-fixture";

const F17 = "0017_backfill_tool_kind.sql";
const F27 = "0027_create_productivity_rows.sql";
const F28 = "0028_convert_productivity_existing_rows.sql";
const NEW_SLUGS = [
  "chatgpt",
  "genspark",
  "gemini-app",
  "grok-app",
  "hermes-agent",
  "manus",
  "microsoft-copilot",
  "mistral-vibe",
  "notion-ai",
];
// #314 (Dd1; D8c for claude-desktop-extensions): these change kind only, harness to productivity.
const DD1_HARNESSES = ["chatgpt-canvas", "claude-desktop-extensions", "cowork"];
/** Every row 0028 may write: the six it converts and the three retired aliases that follow. */
const CONVERTED = ["claude-artifacts", "openclaw", "perplexity", ...DD1_HARNESSES, "clawdbot", "moltbot", "cowork-ai"];
const SEED = parseProductivitySeed(readFileSync(path.join(REPO_ROOT, "docs/refresh/productivity-tools.json"), "utf8"), {
  takenSlugs: new Set(),
  reservedSegments: new Set(),
});

interface Ctx {
  db: PGlite;
  mdb: ReturnType<typeof pgliteMigrationDb>;
}

async function apply(ctx: Ctx, only: string, force = false) {
  return runMigrations(
    { db: ctx.mdb, files: { list: () => [...MIGRATION_FILES], read: readMigration }, log: () => {} },
    { dryRun: false, only, showColumns: null, force }
  );
}

/** The wrong values production holds on openclaw (spec section 6); the fixture row has only a name. */
const OPENCLAW_LIVE = {
  name: "OpenClaw",
  info: {
    website: "https://openclaw.dev",
    description: "",
    business: { pricing_model: "subscription", free_tier: false, license_type: "proprietary" },
  },
};

let ctx: Ctx;

async function setOpenclawData(data: unknown) {
  await ctx.db.query(`UPDATE public."tools" SET data = $1::jsonb WHERE slug = 'openclaw'`, [JSON.stringify(data)]);
}

beforeEach(async () => {
  const db = await chainDb(F17);
  ctx = { db, mdb: pgliteMigrationDb(db) };
  expect((await apply(ctx, F17)).exitCode).toBe(0);
  await setOpenclawData(OPENCLAW_LIVE);
}, 120_000);
afterEach(async () => {
  await ctx.db.close();
});

/** Whole rows, keyed by slug, for the given slugs (or all rows). */
async function rows(slugs?: readonly string[]) {
  const r = await ctx.db.query<{ slug: string; row: Record<string, unknown> }>(
    `SELECT slug, to_jsonb(t) AS row FROM public."tools" t WHERE $1::text[] IS NULL OR slug = ANY($1) ORDER BY slug`,
    [slugs ?? null]
  );
  return r.rows;
}

describe("#314 migration 0027 creates the nine new rows", () => {
  it("inserts them inactive, kind productivity, unscored and without metrics, matching the seed", async () => {
    expect((await apply(ctx, F27)).exitCode).toBe(0);
    const got = await rows(NEW_SLUGS);
    expect(got.map((g) => g.slug)).toEqual([...NEW_SLUGS].sort());
    for (const { slug, row } of got) {
      const seed = SEED.products.find((p) => p.slug === slug)!;
      expect(row["status"], slug).toBe("inactive");
      expect(row["kind"], slug).toBe("productivity");
      expect(row["category"], slug).toBe("productivity");
      expect(row["name"], slug).toBe(seed.name);
      expect(row["subcategory"], slug).toBe(seed.subcategory);
      expect(row["company_id"], slug).toBeNull();
      expect(row["current_score"], slug).toEqual({});
      expect(row["baseline_score"], slug).toEqual({});
      const data = row["data"] as { info: Record<string, unknown>; metrics?: unknown; source_url: string };
      expect(data.metrics, slug).toBeUndefined();
      expect(data.info["website"], slug).toBe(seed.websiteUrl);
      expect(data.info["description"], slug).toBe(seed.description);
      expect(data.info["company"], slug).toBe(seed.company);
      expect(data.source_url, slug).toBe(seed.sourceUrl);
    }
  });

  it("writes nothing else and is a no-op on a forced second run", async () => {
    const others = NEW_SLUGS.length;
    const before = await rows();
    expect((await apply(ctx, F27)).exitCode).toBe(0);
    const once = await rows();
    expect(once).toHaveLength(before.length + others);
    expect(once.filter((r) => !NEW_SLUGS.includes(r.slug))).toEqual(before);
    expect((await apply(ctx, F27, true)).exitCode).toBe(0);
    expect(await rows()).toEqual(once);
  });

  it("refuses, writing nothing, when a new slug is held by a row of another kind", async () => {
    await ctx.db.query(
      `INSERT INTO public."tools" (slug, name, category, status, kind) VALUES ('manus', 'Manus', 'other', 'active', 'harness')`
    );
    const before = await rows();
    expect((await apply(ctx, F27)).exitCode).not.toBe(0);
    expect(await rows()).toEqual(before);
  });

  it("fails the precondition when tools.kind is missing", async () => {
    await ctx.db.exec(`ALTER TABLE public."tools" DROP CONSTRAINT tools_kind_check; ALTER TABLE public."tools" DROP COLUMN kind CASCADE`);
    expect((await apply(ctx, F27)).exitCode).not.toBe(0);
    expect(await rows(NEW_SLUGS)).toEqual([]);
  });
});

describe("#314 migration 0028 converts the six existing rows", () => {
  it("renames claude-artifacts to Claude.AI, keeps its slug and moves it to productivity", async () => {
    const before = (await rows(["claude-artifacts"]))[0]!.row;
    expect(before["kind"]).toBe("harness");
    expect((await apply(ctx, F28)).exitCode).toBe(0);
    const after = (await rows(["claude-artifacts"]))[0]!.row;
    expect(after["slug"]).toBe("claude-artifacts");
    expect(after["id"]).toBe(before["id"]);
    expect(after["name"]).toBe("Claude.AI");
    expect(after["kind"]).toBe("productivity");
    expect(after["subcategory"]).toBe("ai_assistant");
    expect(after["category"]).toBe("productivity");
    expect(after["status"]).toBe(before["status"]);
    expect(after["current_score"]).toEqual(before["current_score"]);
    const data = after["data"] as { name: string; info: { website: string } };
    expect(data.name).toBe("Claude.AI");
    expect(data.info.website).toBe("https://claude.ai");
  });

  it("changes openclaw's kind (and data), and perplexity's kind, subcategory and category only", async () => {
    const [claw, pplx] = (await rows(["openclaw", "perplexity"])).map((r) => r.row);
    expect(claw!["kind"]).toBe("harness");
    expect(pplx!["kind"]).toBe("other");
    expect((await apply(ctx, F28)).exitCode).toBe(0);
    const [claw2, pplx2] = (await rows(["openclaw", "perplexity"])).map((r) => r.row);
    const strip = (r: Record<string, unknown>, keys: string[]) =>
      Object.fromEntries(Object.entries(r).filter(([k]) => !keys.includes(k)));
    expect(claw2!["kind"]).toBe("productivity");
    // #314: openclaw's data is corrected in its own test below; every other column stays.
    expect(strip(claw2!, ["kind", "data", "updated_at"])).toEqual(strip(claw!, ["kind", "data", "updated_at"]));
    expect(pplx2!["kind"]).toBe("productivity");
    expect(pplx2!["subcategory"]).toBe("ai_assistant");
    expect(pplx2!["category"]).toBe("productivity");
    expect(strip(pplx2!, ["kind", "subcategory", "category", "updated_at"])).toEqual(
      strip(pplx!, ["kind", "subcategory", "category", "updated_at"])
    );
  });

  // #314: the Architect's ruling corrects openclaw's website, pricing and licence, cited to sources.
  it("corrects openclaw's website, pricing and licence, records sources and leaves the description alone", async () => {
    const before = (await rows(["openclaw"]))[0]!.row;
    expect((await apply(ctx, F28)).exitCode).toBe(0);
    const after = (await rows(["openclaw"]))[0]!.row;
    const data = after["data"] as {
      info: { website: string; description: string; business: Record<string, unknown> };
      info_provenance: Record<string, { source: string; as_of: string }>;
    };
    expect(data.info.website).toBe("https://openclaw.ai");
    expect(data.info.business).toEqual({ pricing_model: "free", free_tier: true, license_type: "MIT" });
    expect(data.info.description).toBe("");
    expect(data.info_provenance["website"]!.source).toBe("https://openclaw.ai/");
    expect(data.info_provenance["pricing_model"]!.source).toBe("https://openclaw.ai/");
    expect(data.info_provenance["license_type"]!.source).toBe("https://github.com/openclaw/openclaw/blob/main/LICENSE");
    expect(after["name"]).toBe(before["name"]);
    expect(after["category"]).toBe(before["category"]);
  });

  it("corrects a license_type stored on data.info as well, and accepts a row already at the targets", async () => {
    await setOpenclawData({
      info: { website: "https://openclaw.ai", license_type: "proprietary", business: { pricing_model: "free", free_tier: true } },
    });
    expect((await apply(ctx, F28)).exitCode).toBe(0);
    const info = ((await rows(["openclaw"]))[0]!.row["data"] as { info: Record<string, unknown> }).info;
    expect(info["license_type"]).toBe("MIT");
  });

  it.each([
    ["an unexpected website", { website: "https://example.test", business: { pricing_model: "subscription", free_tier: false, license_type: "proprietary" } }],
    ["an unexpected pricing_model", { website: "https://openclaw.dev", business: { pricing_model: "usage", free_tier: false, license_type: "proprietary" } }],
    ["a missing free_tier", { website: "https://openclaw.dev", business: { pricing_model: "subscription", license_type: "proprietary" } }],
    ["an unexpected licence", { website: "https://openclaw.dev", business: { pricing_model: "subscription", free_tier: false, license_type: "gpl" } }],
    ["no licence field", { website: "https://openclaw.dev", business: { pricing_model: "subscription", free_tier: false } }],
  ])("raises, writing nothing, on %s", async (_n, info) => {
    await setOpenclawData({ info });
    const before = await rows();
    expect((await apply(ctx, F28)).exitCode).not.toBe(0);
    expect(await rows()).toEqual(before);
  });

  it("moves chatgpt-canvas, claude-desktop-extensions, cowork and cowork-ai to productivity, changing kind only", async () => {
    const slugs = [...DD1_HARNESSES, "cowork-ai"];
    const before = await rows(slugs);
    expect(before.map((r) => [r.slug, r.row["kind"]])).toEqual([...slugs].sort().map((s) => [s, "harness"]));
    expect((await apply(ctx, F27)).exitCode).toBe(0);
    expect((await apply(ctx, F28)).exitCode).toBe(0);
    const after = await rows(slugs);
    for (const [i, r] of after.entries()) {
      expect([r.slug, r.row["kind"]]).toEqual([r.slug, "productivity"]);
      const { kind: _k, updated_at: _u, ...rest } = r.row;
      const { kind: _k0, updated_at: _u0, ...rest0 } = before[i]!.row;
      expect(rest, r.slug).toEqual(rest0);
    }
  });

  it("leaves every Dd1 row at kind productivity after both files", async () => {
    expect((await apply(ctx, F27)).exitCode).toBe(0);
    expect((await apply(ctx, F28)).exitCode).toBe(0);
    const got = await rows(["claude-artifacts", "openclaw", ...DD1_HARNESSES, "cowork-ai"]);
    expect(got.map((r) => [r.slug, r.row["kind"]])).toEqual(
      ["chatgpt-canvas", "claude-artifacts", "claude-desktop-extensions", "cowork", "cowork-ai", "openclaw"].map((s) => [s, "productivity"])
    );
  });

  it.each(DD1_HARNESSES)("raises, writing nothing, when %s is the harness side of a tool link", async (slug) => {
    await ctx.db.query(
      `INSERT INTO public."tool_links" (model_tool_id, harness_tool_id, relation)
       SELECT m.id, h.id, 'supports' FROM public."tools" m, public."tools" h WHERE m.slug = 'glm-5-0' AND h.slug = $1`,
      [slug]
    );
    const before = await rows();
    expect((await apply(ctx, F28)).exitCode).not.toBe(0);
    expect(await rows()).toEqual(before);
  });

  it("raises, writing nothing, when cowork is missing", async () => {
    await ctx.db.query(`DELETE FROM public."tools" WHERE slug = 'cowork'`);
    const before = await rows();
    expect((await apply(ctx, F28)).exitCode).not.toBe(0);
    expect(await rows()).toEqual(before);
  });

  it("moves openclaw's retired aliases clawdbot and moltbot to productivity, changing nothing else on them", async () => {
    const before = await rows(["clawdbot", "moltbot"]);
    expect(before.map((r) => r.row["kind"])).toEqual(["harness", "harness"]);
    expect((await apply(ctx, F28)).exitCode).toBe(0);
    const after = await rows(["clawdbot", "moltbot"]);
    for (const [i, r] of after.entries()) {
      expect(r.row["kind"], r.slug).toBe("productivity");
      const { kind: _k, updated_at: _u, ...rest } = r.row;
      const { kind: _k0, updated_at: _u0, ...rest0 } = before[i]!.row;
      expect(rest, r.slug).toEqual(rest0);
    }
  });

  it("raises, writing nothing, when openclaw is still the harness side of a tool link", async () => {
    await ctx.db.query(
      `INSERT INTO public."tool_links" (model_tool_id, harness_tool_id, relation)
       SELECT m.id, h.id, 'supports' FROM public."tools" m, public."tools" h WHERE m.slug = 'glm-5-0' AND h.slug = 'openclaw'`
    );
    const before = await rows();
    expect((await apply(ctx, F28)).exitCode).not.toBe(0);
    expect(await rows()).toEqual(before);
  });

  it("changes no row outside the nine, and a forced re-run writes nothing", async () => {
    const before = await rows();
    expect((await apply(ctx, F28)).exitCode).toBe(0);
    const once = await rows();
    expect(once.filter((r) => !CONVERTED.includes(r.slug))).toEqual(before.filter((r) => !CONVERTED.includes(r.slug)));
    expect((await apply(ctx, F28, true)).exitCode).toBe(0);
    expect(await rows()).toEqual(once);
  });

  it.each([
    ["a row with slug claude-ai", `('claude-ai', 'Claude', 'other', 'inactive')`],
    ["another row named Claude.AI", `('some-other-slug', 'claude.ai', 'other', 'inactive')`],
  ])("raises, writing nothing, when %s already exists", async (_n, values) => {
    await ctx.db.query(`INSERT INTO public."tools" (slug, name, category, status) VALUES ${values}`);
    const before = await rows();
    expect((await apply(ctx, F28)).exitCode).not.toBe(0);
    expect(await rows()).toEqual(before);
  });

  it("raises, writing nothing, when claude-artifacts is missing", async () => {
    await ctx.db.query(`DELETE FROM public."tools" WHERE slug = 'claude-artifacts'`);
    const before = await rows();
    expect((await apply(ctx, F28)).exitCode).not.toBe(0);
    expect(await rows()).toEqual(before);
  });

  it("raises, writing nothing, when openclaw holds a kind this migration did not expect", async () => {
    await ctx.db.query(`UPDATE public."tools" SET kind = 'model' WHERE slug = 'openclaw'`);
    const before = await rows();
    expect((await apply(ctx, F28)).exitCode).not.toBe(0);
    expect(await rows()).toEqual(before);
  });
});
