// @vitest-environment jsdom
/**
 * #288: `usePayload` edit and discontinue reach the admin route and never fail open.
 *
 * Why: the hook wrote to the GET-only public route, and it replaced the list row
 *   with whatever a 2xx body held, so a body with no `tool` erased the row.
 * What: `fetch` is replaced (the network boundary only). A write must go to
 *   `/api/admin/tools/<slug>` with only the edited fields; a written row goes
 *   through `toManagerTool`; a non-2xx or a 2xx with no row rejects with the
 *   server's error and leaves the list as it was.
 * Test: `npx vitest run tests/unit/admin-tool-edit-hook-288.test.tsx`.
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePayload } from "../../hooks/use-payload";
import type { Tool } from "../../types/database";

const LIST_URL = "/api/admin/tools?status=active";
const WRITE_URL = "/api/admin/tools/claude-code";

const ROW: Tool = {
  id: "tool-claude-code",
  slug: "claude-code",
  name: "Claude Code",
  category: "ide-assistant",
  status: "active",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  info: { description: "about claude code" },
};

type Reply = { status: number; body: unknown };
const json = ({ status, body }: Reply) => new Response(JSON.stringify(body), { status });

describe("#288 usePayload writes", () => {
  const fetchMock = vi.fn();
  let writeReply: Reply;

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (url: string) =>
      url === LIST_URL ? json({ status: 200, body: { tools: [ROW] } }) : json(writeReply)
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function loaded() {
    const hook = renderHook(() => usePayload());
    await act(() => hook.result.current.fetchTools());
    return hook;
  }
  const listed = (h: Awaited<ReturnType<typeof loaded>>) => h.result.current.tools[0];

  it("updateTool PUTs only the edited fields and keeps the description mapping", async () => {
    writeReply = { status: 200, body: { tool: { ...ROW, name: "Claude Code CLI" } } };
    const hook = await loaded();
    await act(() => hook.result.current.updateTool(ROW.id, { name: "Claude Code CLI" }));

    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe(WRITE_URL);
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body as string)).toEqual({ name: "Claude Code CLI" });
    expect(listed(hook)?.name).toBe("Claude Code CLI");
    expect(listed(hook)?.info?.product?.description).toBe("about claude code");
  });

  it.each([
    ["updateTool", { status: 403, body: { error: "Forbidden" } }, "Forbidden"],
    ["updateTool", { status: 200, body: {} }, "Tool write failed (HTTP 200)"],
    ["discontinueTool", { status: 401, body: { error: "Unauthorized" } }, "Unauthorized"],
    ["discontinueTool", { status: 200, body: { ok: true } }, "Tool write failed (HTTP 200)"],
  ] as const)("%s rejects on %j and leaves the list unchanged", async (method, reply, message) => {
    writeReply = reply;
    const hook = await loaded();
    const before = listed(hook);

    const write =
      method === "updateTool"
        ? () => hook.result.current.updateTool(ROW.id, { name: "Changed" })
        : () => hook.result.current.discontinueTool(ROW.id);
    await act(async () => {
      await expect(write()).rejects.toThrow(message);
    });

    expect(fetchMock.mock.calls[1]?.[0]).toBe(WRITE_URL);
    expect(listed(hook)).toEqual(before);
    expect(hook.result.current.error?.message).toBe(message);
  });

  it("discontinueTool DELETEs on the admin route and lists the returned status", async () => {
    writeReply = { status: 200, body: { tool: { ...ROW, status: "discontinued" } } };
    const hook = await loaded();
    await act(() => hook.result.current.discontinueTool(ROW.id));

    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe(WRITE_URL);
    expect(init.method).toBe("DELETE");
    expect(listed(hook)?.status).toBe("discontinued");
  });
});
