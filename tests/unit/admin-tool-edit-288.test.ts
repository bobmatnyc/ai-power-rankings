/**
 * #288: admin edit (PUT) and discontinue (DELETE) of one tool, on PGlite.
 *
 * Why: the Tools Manager's edit and discontinue answered 405 because they wrote
 *   to the GET-only public route. The admin route must refuse a non-admin before
 *   any read, validate the edit, and really write the row it reports.
 * What: runs `app/api/admin/tools/[slug]/route.ts` with the real ToolsRepository
 *   over a PGlite `tools` table; only `requireAdmin` and `getDb` are replaced.
 *   Each case reads the row back from the database rather than trusting the body.
 * Test: `npx vitest run tests/unit/admin-tool-edit-288.test.ts`. No server, no network.
 */

import type { PGlite } from "@electric-sql/pglite";
import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { linkedDb } from "./fixtures/tool-links-183-fixture";

const { requireAdmin, getDb, holder } = vi.hoisted(() => {
  const holder = { db: null as unknown };
  return { requireAdmin: vi.fn(), getDb: vi.fn(() => holder.db), holder };
});
vi.mock("../../lib/api-auth", () => ({ requireAdmin }));
vi.mock("../../lib/db/connection", () => ({ getDb }));

import { DELETE, PUT } from "../../app/api/admin/tools/[slug]/route";

vi.setConfig({ testTimeout: 60_000 });

const ADMIN = { userId: "u", user: {}, error: null };
const DENIED = {
  401: { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) },
  403: { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) },
} as const;

let pg: PGlite;
beforeEach(async () => {
  let db: unknown;
  ({ pg, db } = await linkedDb([
    { slug: "claude-code", name: "Claude Code", kind: "harness" },
    // No data.id: the repository's lookup falls back to the row UUID.
    { slug: "cursor", name: "Cursor", kind: "harness" },
  ]));
  // A stale data.status, as on production rows (#187), must not hide a status write.
  await pg.query(`UPDATE public."tools" SET data = $1 WHERE slug = 'claude-code'`, [
    JSON.stringify({
      id: "tool-claude-code",
      status: "active",
      info: { description: "old", product: { description: "old", pricing: "paid" } },
    }),
  ]);
  holder.db = db;
  requireAdmin.mockReset();
  requireAdmin.mockResolvedValue(ADMIN);
  getDb.mockClear();
});
afterEach(async () => {
  await pg.close();
});

const ctx = (slug: string) => ({ params: Promise.resolve({ slug }) });
const url = (slug: string) => `http://localhost/api/admin/tools/${slug}`;

function put(slug: string, body: unknown) {
  const raw = typeof body === "string" ? body : JSON.stringify(body);
  return PUT(new NextRequest(url(slug), { method: "PUT", body: raw }), ctx(slug));
}
const del = (slug: string) => DELETE(new NextRequest(url(slug), { method: "DELETE" }), ctx(slug));

async function stored(slug: string) {
  const { rows } = await pg.query<{ name: string; status: string; category: string; data: Record<string, unknown> }>(
    `SELECT name, status, category, data FROM public."tools" WHERE slug = $1`,
    [slug]
  );
  return rows[0];
}

describe("#288 PUT /api/admin/tools/[slug]", () => {
  it("an admin edit writes the edited fields to the row and answers it", async () => {
    const res = await put("claude-code", { name: "Claude Code CLI", description: "new" });
    expect(res.status).toBe(200);
    const { tool } = (await res.json()) as { tool: Record<string, unknown> };
    expect(tool).toMatchObject({ slug: "claude-code", name: "Claude Code CLI", status: "active" });

    const row = await stored("claude-code");
    expect(row?.name).toBe("Claude Code CLI");
    expect(row?.data["name"]).toBe("Claude Code CLI");
    expect(row?.data["info"]).toEqual({
      description: "new",
      product: { description: "new", pricing: "paid" },
    });
  });

  it("a status edit reads back from the row despite a stale data.status", async () => {
    const res = await put("claude-code", { status: "deprecated" });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { tool: { status: string } }).tool.status).toBe("deprecated");
    expect((await stored("claude-code"))?.status).toBe("deprecated");
  });

  it("edits a row that has no data.id", async () => {
    const res = await put("cursor", { category: "code-editor" });
    expect(res.status).toBe(200);
    expect((await stored("cursor"))?.category).toBe("code-editor");
  });

  it.each([
    ["an unknown key", { slug: "other" }],
    ["the whole row", { name: "X", id: "tool-claude-code", created_at: "2020-01-01" }],
    ["no field", {}],
    ["a system status", { status: "redirect" }],
    ["an empty name", { name: "  " }],
    ["a non-object", ["name"]],
    ["unreadable JSON", "{not json"],
  ])("answers 400 for %s and writes nothing", async (_label, body) => {
    const before = await stored("claude-code");
    const res = await put("claude-code", body);
    expect(res.status).toBe(400);
    expect(await stored("claude-code")).toEqual(before);
  });

  it("answers 404 for an unknown slug", async () => {
    const res = await put("no-such-tool", { name: "X" });
    expect(res.status).toBe(404);
  });

  it.each([401, 403] as const)("answers %i to a denied caller before any read or write", async (code) => {
    requireAdmin.mockResolvedValue(DENIED[code]);
    const before = await stored("claude-code");
    getDb.mockClear();
    const res = await put("claude-code", { name: "Hijacked" });
    expect(res.status).toBe(code);
    expect(getDb).not.toHaveBeenCalled();
    expect(await stored("claude-code")).toEqual(before);
  });
});

describe("#288 DELETE /api/admin/tools/[slug] discontinues", () => {
  it("sets status to discontinued and keeps the row", async () => {
    const res = await del("claude-code");
    expect(res.status).toBe(200);
    const { tool } = (await res.json()) as { tool: Record<string, unknown> };
    expect(tool).toMatchObject({ slug: "claude-code", status: "discontinued" });

    const row = await stored("claude-code");
    expect(row?.status).toBe("discontinued");
    expect(row?.data["status"]).toBe("discontinued");
    expect(row?.data["info"]).toMatchObject({ description: "old" });
  });

  it("answers 404 for an unknown slug", async () => {
    expect((await del("no-such-tool")).status).toBe(404);
  });

  it.each([401, 403] as const)("answers %i to a denied caller before any read or write", async (code) => {
    requireAdmin.mockResolvedValue(DENIED[code]);
    getDb.mockClear();
    const res = await del("claude-code");
    expect(res.status).toBe(code);
    expect(getDb).not.toHaveBeenCalled();
    expect((await stored("claude-code"))?.status).toBe("active");
  });
});
