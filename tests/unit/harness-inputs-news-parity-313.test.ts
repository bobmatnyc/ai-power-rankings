/**
 * #313: the SQL port of the news corpus rule counts what the TypeScript rule counts.
 *
 * Why: the news-mentions rule (#313) sets news_mentions to the site's /api/news corpus, and 0024 recomputes it in SQL.
 *   The SQL is a port of `buildToolCatalogue` and `articleToolTags`, so it is held to them on
 *   articles built to hit each branch: mention shapes, relevance gates, per-kind tags, redirect
 *   rows, whole-word title matching with letter, digit, punctuation and non-ASCII neighbours.
 * What: seeds the audit tools (one redirect row, one tool with a multi-word name), 400 articles
 *   from a seeded generator plus fixed edge cases, runs 0024, and compares every group c row's
 *   stored count with `expectedNewsCounts`. A title neighbour outside the classified ranges
 *   must stop the migration, not be guessed.
 * Test: `npx vitest run tests/unit/harness-inputs-news-parity-313.test.ts`. No server, no network.
 */

import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pgliteMigrationDb } from "./fixtures/timestamptz-237-fixture";
import { addArticle, apply0024, expectedNewsCounts, kindedChainDb, ROWS, seedOldState } from "./fixtures/harness-inputs-313";

/** A small deterministic generator (mulberry32) so a failure reproduces. */
function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NAMES = ["Claude Code", "Cursor", "GitHub Copilot", "Windsurf", "Claude Opus", "Gemini Code Assist", "Amazon Q Developer", "Kiro"];
const NEIGHBOURS = ["", " ", "'s", "’s", "-", "x", "2", "é", "é", ":", " — ", " ", "🚀"];
const RELEVANCE = [undefined, 0.2, 0.49, 0.5, 0.9, 1, "0.9", null];

async function scenario(): Promise<PGlite> {
  const db = await kindedChainDb();
  await seedOldState(db);
  // A retired model row that redirects to an active one (the model-alias shape), and a stale data.slug-free redirect.
  await db.exec(`UPDATE public."tools" SET status = 'redirect', data = data || '{"redirect_to": "opus-4-6"}'::jsonb WHERE slug = 'opus-4-5'`);
  const ids = Object.fromEntries(
    (await db.query<{ slug: string; id: string }>(`SELECT slug, id FROM public."tools" WHERE slug IN ('claude-code','cursor','github-copilot','opus-4-6','windsurf')`)).rows.map((r) => [r.slug, r.id])
  );
  const next = rng(313);
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)] as T;
  const mention = (): unknown => {
    const rel = pick(RELEVANCE);
    const base = pick<Record<string, unknown>>([
      { name: pick(NAMES) },
      { tool: pick(NAMES) },
      { name: pick(["claude-code", "CURSOR", " github-copilot ", "opus-4-5", "unknown tool"]) },
      { toolId: ids[pick(["claude-code", "cursor", "github-copilot", "opus-4-6", "windsurf"])] },
      { tool_id: ids["cursor"], name: "ignored when the id resolves" },
      { toolId: "not-an-id", name: pick(NAMES) },
      { toolId: 7, name: "Cursor" },
    ]);
    if (rel !== undefined) base["relevance"] = rel;
    return pick([base, base, base, pick(NAMES), "claude-code", 42, null, [base], { name: "" }]);
  };
  // Fixed cases for the second-kind gate (#285): a model leads, a harness follows at each side of 0.5.
  const second = [0.3, 0.4, 0.49, 0.5, 0.51];
  for (const [i, rel] of second.entries()) {
    await addArticle(db, { slug: `kind-${i}`, title: "Release notes", mentions: [{ toolId: ids["opus-4-6"], relevance: 0.95 }, { name: "Windsurf", relevance: rel }] });
  }
  // Title fill is ungated: the model leads, the harness is only named in the title.
  await addArticle(db, { slug: "kind-title", title: "Windsurf and Cursor compared", mentions: [{ toolId: ids["opus-4-6"], relevance: 0.9 }] });
  for (let i = 0; i < 400; i++) {
    const count = Math.floor(next() * 4);
    const title = `${pick(["", "New: ", "Why "])}${pick(NAMES)}${pick(NEIGHBOURS)} ${pick(["adds agents", "and", "vs"])} ${pick(NAMES)}${pick(NEIGHBOURS)}`;
    const mentions = next() < 0.05 ? pick(["not an array", { name: "Cursor" }, null]) : Array.from({ length: count }, mention);
    await addArticle(db, {
      slug: `gen-${i}`,
      title,
      mentions,
      status: next() < 0.1 ? "draft" : "active",
      daysAgo: pick([1, 30, 200, 364, 380]),
      noPublishedDate: next() < 0.1,
    });
  }
  return db;
}

describe("#313 the SQL corpus rule against the TypeScript rule", () => {
  let db: PGlite;
  let oracle: Record<string, number>;
  let run: Awaited<ReturnType<typeof apply0024>>;

  beforeAll(async () => {
    db = await scenario();
    oracle = await expectedNewsCounts(db);
    run = await apply0024(db, pgliteMigrationDb(db));
  }, 180_000);
  afterAll(async () => {
    await db.close();
  });

  it("the scenario reaches every branch it claims to (the oracle is not trivially zero)", () => {
    expect(run.exitCode, run.lines.join("\n")).toBe(0);
    expect(oracle["claude-code"]).toBeGreaterThan(20);
    expect(oracle["cursor"]).toBeGreaterThan(20);
    expect(oracle["github-copilot"]).toBeGreaterThan(5);
    expect(Object.keys(oracle).length).toBeGreaterThan(6);
  });

  it("every group c row holds the TypeScript count", async () => {
    for (const row of ROWS.filter((r) => r.group === "c")) {
      const { rows } = await db.query<{ data: any }>(`SELECT data FROM public."tools" WHERE slug = $1`, [row.slug]);
      const container = row.path[0] === "info" ? rows[0]!.data.info.metrics : rows[0]!.data.metrics;
      expect([row.slug, container.news_mentions]).toEqual([row.slug, oracle[row.slug] ?? 0]);
    }
  });
});

describe("#313 a title neighbour the table cannot classify", () => {
  it("stops the migration instead of guessing", async () => {
    const db = await kindedChainDb();
    await seedOldState(db);
    await addArticle(db, { slug: "greek", title: "Claude Codeα launches", mentions: [] });
    const result = await apply0024(db, pgliteMigrationDb(db));
    expect(result.exitCode).toBe(1);
    expect(result.lines.join("\n")).toContain("is not classified");
    await db.close();
  }, 120_000);
});

// #313: 0028 (#314) renames claude-artifacts to Claude.AI and keeps the slug; the resolver's
// FORMER_NAMES keeps "Claude Artifacts" pointing at that row. 0024 may run before or after 0028.
describe.each([
  { renamed: false, expected: 2 },
  { renamed: true, expected: 3 },
])("#313 a renamed tool's former name (0028 applied first: $renamed)", ({ renamed, expected }) => {
  it("counts the former name as the TypeScript rule does", async () => {
    const db = await kindedChainDb();
    await seedOldState(db);
    if (renamed) {
      // The rename 0028 makes: column and JSON name, kind productivity, slug and id kept.
      await db.exec(
        `UPDATE public."tools" SET name = 'Claude.AI', kind = 'productivity', data = jsonb_set(data, '{name}', '"Claude.AI"') WHERE slug = 'claude-artifacts'`
      );
    }
    await addArticle(db, { slug: "former-title", title: "Claude Artifacts gets a new editor", mentions: [] });
    await addArticle(db, { slug: "former-mention", title: "Release notes", mentions: [{ name: "Claude Artifacts", relevance: 0.9 }] });
    await addArticle(db, { slug: "new-title", title: "Claude.AI adds projects", mentions: [] });
    const oracle = await expectedNewsCounts(db);
    const result = await apply0024(db, pgliteMigrationDb(db));
    expect(result.exitCode, result.lines.join("\n")).toBe(0);
    const { rows } = await db.query<{ data: any }>(`SELECT data FROM public."tools" WHERE slug = 'claude-artifacts'`);
    expect(oracle["claude-artifacts"]).toBe(expected);
    expect(rows[0]!.data.metrics.news_mentions).toBe(expected);
    await db.close();
  }, 120_000);
});
