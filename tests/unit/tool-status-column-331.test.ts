/**
 * #331: the `tools.status` column wins over a stale `data.status` in every repository reader.
 *
 * Why: `mapDbToolToData` once spread the JSONB `data` after the column, so a redirect row whose
 *   `data.status` still said "active" read as active (and the reverse). The column is the source of
 *   truth. `tool-status-column-d58.test.ts` covers one reader with a stubbed database; this file
 *   covers each mapped reader, the sitemap and the admin write-back on a real Postgres table.
 * What: runs the real ToolsRepository over a PGlite `tools` table with two disagreeing rows: column
 *   `redirect` / data `active`, and column `active` / data `redirect`. Each reader returns the column
 *   value; the sitemap lists only the column-active row; an admin refresh keeps the redirect column
 *   and rewrites `data.status` to match it.
 * Test: `npx vitest run tests/unit/tool-status-column-331.test.ts`. No server, no network.
 */

import type { PGlite } from "@electric-sql/pglite";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { linkedDb } from "./fixtures/tool-links-183-fixture";

const { requireAdmin, getDb, holder } = vi.hoisted(() => {
  const holder = { db: null as unknown };
  return { requireAdmin: vi.fn(), getDb: vi.fn(() => holder.db), holder };
});
vi.mock("server-only", () => ({}));
vi.mock("../../lib/api-auth", () => ({ requireAdmin }));
vi.mock("../../lib/db/connection", () => ({ getDb }));
vi.mock("../../lib/services/whats-new-summary.service", () => ({ listPeriods: async () => [] }));
vi.mock("../../lib/db/repositories/news", () => ({ newsRepository: { getPublishedSlugs: async () => [] } }));
vi.mock("../../lib/services/weekly-digest.repository", () => ({ listDigestWeeks: async () => [] }));
vi.mock("../../lib/db/repositories/rankings.repository", () => ({
  rankingsRepository: { getCurrentRankings: async () => null },
}));

import { POST } from "../../app/api/admin/tools/route";
import { ToolsRepository } from "../../lib/db/repositories/tools.repository";
import { buildSitemapEntries } from "../../lib/sitemap";

vi.setConfig({ testTimeout: 60_000 });

const ALIAS = "stale-alias-331"; // column redirect, data.status active
const BACK = "stale-back-331"; // column active, data.status redirect

let pg: PGlite;
let repo: ToolsRepository;
const ids: Record<string, string> = {};

beforeEach(async () => {
  let db: unknown;
  ({ pg, db } = await linkedDb([
    { slug: ALIAS, name: "Stale Alias", kind: "harness", status: "redirect" },
    { slug: BACK, name: "Stale Back", kind: "harness", status: "active" },
  ]));
  await pg.query(`UPDATE public."tools" SET data = '{"status":"active"}' WHERE slug = $1`, [ALIAS]);
  await pg.query(`UPDATE public."tools" SET data = '{"status":"redirect"}' WHERE slug = $1`, [BACK]);
  for (const slug of [ALIAS, BACK]) {
    const { rows } = await pg.query<{ id: string }>(`SELECT id FROM public."tools" WHERE slug = $1`, [slug]);
    ids[slug] = rows[0]!.id;
  }
  holder.db = db;
  requireAdmin.mockReset();
  requireAdmin.mockResolvedValue({ userId: "u", user: {}, error: null });
  repo = new ToolsRepository();
});
afterEach(async () => {
  vi.restoreAllMocks();
  await pg.close();
});

const statusBySlug = (rows: Array<{ slug: string; status: string }>) =>
  Object.fromEntries(rows.map((r) => [r.slug, r.status]));

describe("#331 the status column wins in every mapped reader", () => {
  it.each([
    ["findAll", () => repo.findAll()],
    ["findByIds", () => repo.findByIds([ids[ALIAS]!, ids[BACK]!])],
    ["findBySlugs", () => repo.findBySlugs([ALIAS, BACK])],
    ["findByCategory", () => repo.findByCategory("other")],
    ["findBySlug", async () => [await repo.findBySlug(ALIAS), await repo.findBySlug(BACK)].flatMap((t) => (t ? [t] : []))],
    ["findById", async () => [await repo.findById(ids[ALIAS]!), await repo.findById(ids[BACK]!)].flatMap((t) => (t ? [t] : []))],
  ])("%s returns redirect for column redirect / data active, and active for the reverse", async (_name, read) => {
    expect(statusBySlug(await read())).toEqual({ [ALIAS]: "redirect", [BACK]: "active" });
  });

  it("findByStatus filters on the column and reports the column value", async () => {
    expect(statusBySlug(await repo.findByStatus("active"))).toEqual({ [BACK]: "active" });
    expect(statusBySlug(await repo.findByStatus("redirect"))).toEqual({ [ALIAS]: "redirect" });
  });
});

describe("#331 readers whose output follows the column", () => {
  it("the sitemap lists the column-active tool page and leaves the column-redirect one out", async () => {
    const paths = (await buildSitemapEntries("https://example.test")).map((e) => new URL(e.url).pathname);
    expect(paths).toContain(`/en/tools/${BACK}`);
    expect(paths).not.toContain(`/en/tools/${ALIAS}`);
  });

  it("an admin refresh of a redirect row keeps the redirect column and syncs data.status to it", async () => {
    const res = await POST(
      new NextRequest("http://localhost/api/admin/tools", {
        method: "POST",
        body: JSON.stringify({ action: "refresh-display", toolId: ids[ALIAS] }),
      })
    );
    expect(res.status).toBe(200);
    const { rows } = await pg.query<{ status: string; data_status: string }>(
      `SELECT status, data->>'status' AS data_status FROM public."tools" WHERE slug = $1`,
      [ALIAS]
    );
    expect(rows[0]).toEqual({ status: "redirect", data_status: "redirect" });
  });
});
