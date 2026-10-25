// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regression tests for #197 (b) — the admin Tools Manager lists noindex tools.
 *
 * Why: the public `/api/tools` leaves every slug of NOINDEX_TOOL_SLUGS out of
 * the tools index. `usePayload` read that route, so the admin Tools Manager
 * lost those active tools and `deleteTool` threw "Tool not found" for them.
 * What: `usePayload` runs with `fetch` replaced and must read the admin-auth
 * route and keep a noindex slug in its list. The admin route runs with
 * `requireAdmin` and the repository replaced: a denied caller gets 401 and no
 * read, an admin gets the noindex slug back.
 * Test: `npx vitest run tests/unit/admin-tools-list-197.test.tsx`. No
 * database access, no network.
 */

const { requireAdmin, findByStatus } = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  findByStatus: vi.fn(),
}));

vi.mock("../../lib/api-auth", () => ({ requireAdmin }));
vi.mock("../../lib/db/repositories/tools.repository", () => ({
  ToolsRepository: class {
    findByStatus = findByStatus;
  },
}));
vi.mock("../../lib/db/repositories/articles.repository", () => ({
  ArticlesRepository: class {},
}));

import * as adminTools from "../../app/api/admin/tools/route";
import { toManagerTool, usePayload } from "../../hooks/use-payload";
import { isNoindexToolSlug, NOINDEX_TOOL_SLUGS } from "../../lib/seo/url-table";
import type { Tool } from "../../types/database";

// Literal, not the hook constant, so the test pins the route itself.
const ADMIN_URL = "/api/admin/tools?status=active";
const NOINDEX_SLUG = [...NOINDEX_TOOL_SLUGS][0] ?? "";

function row(slug: string): Tool {
  return {
    id: `id-${slug}`,
    slug,
    name: slug,
    category: "ide-assistant",
    status: "active",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    info: { description: `about ${slug}` },
  };
}

const ROWS = [row("claude-code"), row(NOINDEX_SLUG)];

describe("#197 usePayload reads the admin tools list", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (url: string) => {
      if (url === ADMIN_URL) return new Response(JSON.stringify({ total: ROWS.length, tools: ROWS }));
      // #288: discontinue answers the written row from the admin route.
      const slug = url.startsWith("/api/admin/tools/") ? url.slice("/api/admin/tools/".length) : "";
      const hit = ROWS.find((r) => r.slug === slug);
      return hit
        ? new Response(JSON.stringify({ tool: { ...hit, status: "discontinued" } }))
        : new Response("{}", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches the admin-auth route, not the public /api/tools", async () => {
    const { result } = renderHook(() => usePayload());
    await act(() => result.current.fetchTools());

    const urls = fetchMock.mock.calls.map(([url]) => url as string);
    expect(urls).toEqual([ADMIN_URL]);
  });

  it("keeps a noindex slug in the list, and discontinueTool finds it", async () => {
    expect(isNoindexToolSlug(NOINDEX_SLUG)).toBe(true);
    const { result } = renderHook(() => usePayload());
    await act(() => result.current.fetchTools());

    expect(result.current.tools.map((t) => t.slug)).toContain(NOINDEX_SLUG);

    // Before #197 (b) the noindex tool was absent and this threw "Tool not found".
    await act(() => result.current.discontinueTool(`id-${NOINDEX_SLUG}`));
    expect(result.current.tools.find((t) => t.slug === NOINDEX_SLUG)?.status).toBe("discontinued");
  });

  it("toManagerTool lifts info.description into info.product.description", () => {
    const mapped = toManagerTool(row("cursor"));
    expect(mapped.info?.product?.description).toBe("about cursor");
    expect(mapped.description).toBe("about cursor");
    expect(mapped.slug).toBe("cursor");
  });
});

describe("#197 GET /api/admin/tools?status=active", () => {
  beforeEach(() => {
    requireAdmin.mockReset();
    findByStatus.mockReset();
    findByStatus.mockResolvedValue(ROWS);
  });

  const call = () => adminTools.GET(new NextRequest(`http://localhost${ADMIN_URL}`));

  it("rejects a non-admin caller before any read", async () => {
    requireAdmin.mockResolvedValue({
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });
    const res = await call();
    expect(res.status).toBe(401);
    expect(findByStatus).not.toHaveBeenCalled();
  });

  it("returns every active tool to an admin, noindex slugs included", async () => {
    requireAdmin.mockResolvedValue({ userId: "u", user: {}, error: null });
    const res = await call();
    expect(res.status).toBe(200);
    expect(findByStatus).toHaveBeenCalledWith("active");
    const body = (await res.json()) as { tools: Tool[] };
    expect(body.tools.map((t) => t.slug)).toContain(NOINDEX_SLUG);
  });
});
