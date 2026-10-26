/**
 * #290: tool repository writes that match no row, and non-UUID id lookups, on PGlite.
 *
 * Why: `deleteFromDb` and `updateScoring` matched `data->>'id'`, so a row with no
 *   `data.id` was never touched while `deleteFromDb` still answered true; and a
 *   non-UUID id reached the uuid column, so Postgres threw and the routes answered 500.
 * What: runs the real ToolsRepository and `app/api/admin/tools/route.ts` over a PGlite
 *   `tools` table (only `requireAdmin` and `getDb` are replaced). The routes' arms for
 *   a repository write that returns no row spy on that one repository method.
 * Test: `npx vitest run tests/unit/tool-repo-writes-290.test.ts`. No server, no network.
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

import { DELETE, POST, PUT } from "../../app/api/admin/tools/route";
import { ToolsRepository } from "../../lib/db/repositories/tools.repository";

vi.setConfig({ testTimeout: 60_000 });

const MISSING_UUID = "00000000-0000-4000-8000-000000000000";
const NOT_A_UUID = "not-a-uuid";

let pg: PGlite;
let repo: ToolsRepository;
let cursorId: string;
let legacyId: string;

beforeEach(async () => {
  let db: unknown;
  ({ pg, db } = await linkedDb([
    { slug: "cursor", name: "Cursor", kind: "harness" }, // no data.id
    { slug: "legacy", name: "Legacy", kind: "harness" }, // non-UUID data.id
    { slug: "other", name: "Other", kind: "harness" }, // no data.id
  ]));
  await pg.query(`UPDATE public."tools" SET data = '{"id":"tool-legacy"}' WHERE slug = 'legacy'`);
  holder.db = db;
  requireAdmin.mockReset();
  requireAdmin.mockResolvedValue({ userId: "u", user: {}, error: null });
  repo = new ToolsRepository();
  cursorId = await idOf("cursor");
  legacyId = await idOf("legacy");
});
afterEach(async () => {
  vi.restoreAllMocks();
  await pg.close();
});

async function idOf(slug: string): Promise<string> {
  const { rows } = await pg.query<{ id: string }>(`SELECT id FROM public."tools" WHERE slug = $1`, [slug]);
  return rows[0]!.id;
}
async function count(): Promise<number> {
  const { rows } = await pg.query<{ n: number }>(`SELECT count(*)::int AS n FROM public."tools"`);
  return rows[0]!.n;
}

describe("#290 findById", () => {
  it("returns null for a non-UUID id instead of throwing", async () => {
    await expect(repo.findById(NOT_A_UUID)).resolves.toBeNull();
  });

  it("still finds a row by UUID and a legacy row by its non-UUID data.id", async () => {
    expect((await repo.findById(cursorId))?.slug).toBe("cursor");
    expect((await repo.findById("tool-legacy"))?.slug).toBe("legacy");
  });

  it("findByIds tolerates a non-UUID id next to a UUID", async () => {
    const found = await repo.findByIds([NOT_A_UUID, cursorId]);
    expect(found.map((t) => t.slug)).toEqual(["cursor"]);
  });
});

describe("#290 deleteById", () => {
  it("deletes a row that has no data.id, by its UUID, and only that row", async () => {
    await expect(repo.deleteById(cursorId)).resolves.toBe(true);
    expect(await count()).toBe(2);
    expect(await repo.findBySlug("cursor")).toBeNull();
  });

  it("deletes a legacy row by its non-UUID data.id", async () => {
    await expect(repo.deleteById("tool-legacy")).resolves.toBe(true);
    expect(await repo.findBySlug("legacy")).toBeNull();
  });

  it.each([
    ["an unknown UUID", MISSING_UUID],
    ["a non-UUID id", NOT_A_UUID],
  ])("returns false for %s and deletes nothing", async (_label, id) => {
    await expect(repo.deleteById(id)).resolves.toBe(false);
    expect(await count()).toBe(3);
  });
});

describe("#290 updateScoring", () => {
  const scores = { baseline_score: { overall: 1 }, current_score: { overall: 2 } };

  it("scores a row that has no data.id", async () => {
    const row = await repo.updateScoring(cursorId, scores);
    expect(row?.slug).toBe("cursor");
    expect(row?.current_score).toEqual({ overall: 2 });
    const { rows } = await pg.query<{ current_score: unknown }>(
      `SELECT current_score FROM public."tools" WHERE slug = 'cursor'`
    );
    expect(rows[0]?.current_score).toEqual({ overall: 2 });
  });

  it.each([
    ["an unknown UUID", MISSING_UUID],
    ["a non-UUID id", NOT_A_UUID],
  ])("returns null for %s", async (_label, id) => {
    await expect(repo.updateScoring(id, scores)).resolves.toBeNull();
  });
});

const post = (body: unknown) =>
  POST(new NextRequest("http://localhost/api/admin/tools", { method: "POST", body: JSON.stringify(body) }));
const put = (body: unknown) =>
  PUT(new NextRequest("http://localhost/api/admin/tools", { method: "PUT", body: JSON.stringify(body) }));
const del = (id: string) =>
  DELETE(new NextRequest(`http://localhost/api/admin/tools?id=${id}`, { method: "DELETE" }));

describe("#290 admin tools route", () => {
  it.each(["refresh-display", "update-company"])("%s answers 404 for a non-UUID id", async (action) => {
    const res = await post({ action, toolId: NOT_A_UUID, companyData: { name: "X" } });
    expect(res.status).toBe(404);
  });

  it("update-company writes a row that has no data.id", async () => {
    const res = await post({ action: "update-company", toolId: cursorId, companyData: { name: "Anysphere" } });
    expect(res.status).toBe(200);
    const { rows } = await pg.query<{ data: { company_info?: { name?: string } } }>(
      `SELECT data FROM public."tools" WHERE slug = 'cursor'`
    );
    expect(rows[0]?.data.company_info?.name).toBe("Anysphere");
  });

  it.each([
    ["refresh-display", { action: "refresh-display" }],
    ["update-company", { action: "update-company", companyData: { name: "X" } }],
  ])("%s answers 404 when the update writes no row", async (_label, body) => {
    vi.spyOn(ToolsRepository.prototype, "update").mockResolvedValue(null);
    const res = await post({ ...body, toolId: cursorId });
    expect(res.status).toBe(404);
  });

  it("DELETE ?id= answers 404 for a non-UUID id and for an unknown UUID", async () => {
    expect((await del(NOT_A_UUID)).status).toBe(404);
    expect((await del(MISSING_UUID)).status).toBe(404);
    expect(await count()).toBe(3);
  });

  it("DELETE ?id= answers 404, not 500, when the delete removes no row", async () => {
    vi.spyOn(ToolsRepository.prototype, "deleteById").mockResolvedValue(false);
    expect((await del(cursorId)).status).toBe(404);
  });

  it("DELETE ?id= deletes a row that has no data.id", async () => {
    expect((await del(cursorId)).status).toBe(200);
    expect(await repo.findBySlug("cursor")).toBeNull();
  });

  it("batch delete answers 404 when no id matched a row, 200 when one did", async () => {
    const none = await post({ action: "delete", toolIds: [NOT_A_UUID, MISSING_UUID] });
    expect(none.status).toBe(404);
    expect(((await none.json()) as { deletedTools: unknown[] }).deletedTools).toEqual([]);

    const some = await post({ action: "delete", toolIds: [NOT_A_UUID, cursorId] });
    expect(some.status).toBe(200);
    expect(await repo.findBySlug("cursor")).toBeNull();
  });

  it("cleanup-auto reports a delete that removed no row", async () => {
    await pg.query(`UPDATE public."tools" SET name = 'Thing (Auto)' WHERE slug = 'other'`);
    vi.spyOn(ToolsRepository.prototype, "deleteById").mockResolvedValue(false);
    const res = await post({ action: "cleanup-auto" });
    const body = (await res.json()) as { deletedTools: unknown[]; errors: string[] };
    expect(body.deletedTools).toEqual([]);
    expect(body.errors).toHaveLength(1);
  });

  it("PUT quick-fix-display counts only updates that wrote a row", async () => {
    vi.spyOn(ToolsRepository.prototype, "update").mockResolvedValue(null);
    const res = await put({ action: "quick-fix-display" });
    expect(res.status).toBe(404);
    const body = (await res.json()) as { success: boolean; fixedTools: unknown[]; failedTools: unknown[] };
    expect(body.success).toBe(false);
    expect(body.fixedTools).toEqual([]);
    expect(body.failedTools).toHaveLength(3);
  });

  it("PUT update-missing-company counts only updates that wrote a row", async () => {
    vi.spyOn(ToolsRepository.prototype, "update").mockResolvedValue(null);
    const res = await put({ action: "update-missing-company" });
    expect(res.status).toBe(404);
    expect(((await res.json()) as { updatedTools: unknown[] }).updatedTools).toEqual([]);
  });

  it("legacyId stays addressable through the route", async () => {
    expect((await del(legacyId)).status).toBe(200);
  });
});
