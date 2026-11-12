/**
 * #453: the admin PUT refuses to activate a row whose licence review is pending, on PGlite.
 *
 * Why: the Tools Manager can set any row active. A model whose licence the owner has not
 *   reviewed must not go live that way either, and an edit that is refused must write nothing.
 * What: runs `app/api/admin/tools/[slug]/route.ts` with the real ToolsRepository over a PGlite
 *   `tools` table (only `requireAdmin` and `getDb` replaced), with each licence review value,
 *   and once with the review turned pending between the route's read and its write.
 * Test: `npx vitest run tests/unit/admin-tool-licence-453.test.ts`. No server, no network.
 */

import type { PGlite } from "@electric-sql/pglite";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { linkedDb } from "./fixtures/tool-links-183-fixture";

const { requireAdmin, getDb, holder } = vi.hoisted(() => {
  const holder = { db: null as unknown };
  return { requireAdmin: vi.fn(), getDb: vi.fn(() => holder.db), holder };
});
vi.mock("../../lib/api-auth", () => ({ requireAdmin }));
vi.mock("../../lib/db/connection", () => ({ getDb }));

import { PUT } from "../../app/api/admin/tools/[slug]/route";
import { ToolsRepository } from "../../lib/db/repositories/tools.repository";

vi.setConfig({ testTimeout: 60_000 });

const PENDING = { licenceReview: "pending" };

let pg: PGlite;
beforeEach(async () => {
  let db: unknown;
  ({ pg, db } = await linkedDb([
    { slug: "m", name: "M", kind: "model", status: "inactive" },
    { slug: "live", name: "Live", kind: "model", status: "active" },
  ]));
  await pg.query(`UPDATE public."tools" SET data = $1::jsonb WHERE slug = 'live'`, [JSON.stringify({ modelSeed: PENDING })]);
  holder.db = db;
  requireAdmin.mockReset();
  requireAdmin.mockResolvedValue({ userId: "u", user: {}, error: null });
});
afterEach(async () => {
  vi.restoreAllMocks();
  await pg.close();
});

const setData = (slug: string, data: unknown) =>
  pg.query(`UPDATE public."tools" SET data = $1::jsonb WHERE slug = $2`, [JSON.stringify(data), slug]);

function put(slug: string, body: unknown) {
  return PUT(
    new NextRequest(`http://localhost/api/admin/tools/${slug}`, { method: "PUT", body: JSON.stringify(body) }),
    { params: Promise.resolve({ slug }) }
  );
}

async function stored(slug: string) {
  const { rows } = await pg.query<{ name: string; status: string }>(`SELECT name, status FROM public."tools" WHERE slug = $1`, [slug]);
  return rows[0]!;
}

describe("#453 PUT /api/admin/tools/[slug] licence gate", () => {
  it.each<[string, unknown]>([
    ["a pending review", { modelSeed: PENDING }],
    ["a reviewed review without a ruling", { modelSeed: { licenceReview: "reviewed" } }],
    ["an unreadable modelSeed (fail closed)", { modelSeed: "pending" }],
  ])("refuses to activate a row with %s: 409, nothing written", async (_name, data) => {
    await setData("m", data);
    const res = await put("m", { status: "active", name: "Renamed" });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/^Tool m cannot be set active: .+Nothing was written\.$/);
    expect(await stored("m")).toEqual({ name: "M", status: "inactive" });
  });

  it.each<[string, unknown]>([
    ["reviewed with a ruling", { modelSeed: { licenceReview: "reviewed", licenceReviewRuling: "D88" } }],
    ["not_required", { modelSeed: { licenceReview: "not_required" } }],
    ["a null review", { modelSeed: { licenceReview: null } }],
    ["no modelSeed", {}],
  ])("activates a row with %s", async (_name, data) => {
    await setData("m", data);
    const res = await put("m", { status: "active" });
    expect(res.status).toBe(200);
    expect((await stored("m")).status).toBe("active");
  });

  it("an active pending row stays editable and active (D83)", async () => {
    const res = await put("live", { status: "active", name: "Live 2" });
    expect(res.status).toBe(200);
    expect(await stored("live")).toEqual({ name: "Live 2", status: "active" });
  });

  it("a pending row may still be edited without activation", async () => {
    await setData("m", { modelSeed: PENDING });
    const res = await put("m", { status: "deprecated" });
    expect(res.status).toBe(200);
    expect((await stored("m")).status).toBe("deprecated");
  });

  it("refuses at write time when the review turns pending after the route read the row", async () => {
    await setData("m", { modelSeed: { licenceReview: "not_required" } });
    const original = ToolsRepository.prototype.findBySlug;
    vi.spyOn(ToolsRepository.prototype, "findBySlug").mockImplementation(async function (this: ToolsRepository, slug: string) {
      const found = await original.call(this, slug);
      await setData("m", { modelSeed: PENDING });
      return found;
    });
    const res = await put("m", { status: "active", name: "Renamed" });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/changed since it was read/);
    expect(await stored("m")).toEqual({ name: "M", status: "inactive" });
  });
});
