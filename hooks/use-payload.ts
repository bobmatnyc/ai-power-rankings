"use client";

import { useCallback, useState } from "react";
import type { Ranking, Tool } from "@/types/database";

// #197: the public /api/tools leaves noindex slugs out, so the admin list reads
// the admin-auth route, which returns every active tool unfiltered.
export const ADMIN_TOOLS_URL = "/api/admin/tools?status=active";

/**
 * Maps a raw repository row from the admin route to the shape the Tools Manager reads.
 *
 * Why: #197 — the admin route returns repository rows, where the description
 * sits at `info.description`; the manager reads `info.product.description`.
 * What: keeps every row field and fills `description` and
 * `info.product.description` from `info.description` when they are absent.
 * Test: `toManagerTool lifts info.description into info.product.description`
 * in tests/unit/admin-tools-list-197.test.tsx.
 */
export function toManagerTool(row: Tool): Tool {
  const info = row.info ?? {};
  const description =
    info.product?.description ?? (info["description"] as string | undefined) ?? row.description;
  return {
    ...row,
    description: row.description ?? description,
    info: { ...info, product: { ...info.product, description } },
  };
}

/** The fields the admin edit route accepts (#288). */
export type ToolEdit = Partial<Pick<Tool, "name" | "category" | "status" | "description">>;

const EDITABLE_FIELDS = ["name", "category", "status", "description"] as const;

/** #288: the admin route refuses unknown keys, so send only the edited fields. */
function pickEditable(updates: ToolEdit): ToolEdit {
  const out: ToolEdit = {};
  for (const key of EDITABLE_FIELDS) {
    if (updates[key] !== undefined) Object.assign(out, { [key]: updates[key] });
  }
  return out;
}

/** The admin-auth edit and discontinue route for one tool (#288). */
export function adminToolUrl(slug: string): string {
  return `/api/admin/tools/${encodeURIComponent(slug)}`;
}

export function usePayload() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchTools = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // #197: admin route, so noindex slugs stay listed and editable here.
      const response = await fetch(ADMIN_TOOLS_URL);
      if (!response.ok) {
        throw new Error("Failed to fetch tools");
      }

      const data = await response.json();
      setTools(((data.tools as Tool[] | undefined) ?? []).map(toManagerTool));
    } catch (err) {
      setError(err as Error);
      console.error("Error fetching tools:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRankings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/admin/rankings/all");
      if (!response.ok) {
        throw new Error("Failed to fetch rankings");
      }

      const data = await response.json();
      setRankings(data.rankings || []);
    } catch (err) {
      setError(err as Error);
      console.error("Error fetching rankings:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // #288: edit and discontinue go to the admin-auth route; the public
  // /api/tools/[slug]/json serves GET only and answered 405.
  const writeTool = useCallback(
    async (toolId: string, init: RequestInit): Promise<Tool> => {
      const tool = tools.find((t) => t.id === toolId);
      if (!tool) {
        throw new Error("Tool not found");
      }

      const response = await fetch(adminToolUrl(tool.slug), init);
      const data = (await response.json().catch(() => null)) as {
        tool?: Tool;
        error?: string;
      } | null;
      // #288: only a 2xx carrying the written row changes the list.
      if (!response.ok || !data?.tool) {
        throw new Error(data?.error ?? `Tool write failed (HTTP ${response.status})`);
      }

      const written = toManagerTool(data.tool);
      setTools((prevTools) => prevTools.map((t) => (t.id === toolId ? written : t)));
      return written;
    },
    [tools]
  );

  const runWrite = useCallback(
    async (toolId: string, init: RequestInit, label: string): Promise<Tool> => {
      try {
        setLoading(true);
        setError(null);
        return await writeTool(toolId, init);
      } catch (err) {
        setError(err as Error);
        console.error(`Error ${label} tool:`, err);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [writeTool]
  );

  /** Edits the admin-editable fields of a tool; rejects on any failed write. */
  const updateTool = useCallback(
    (toolId: string, updates: ToolEdit) =>
      runWrite(
        toolId,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(pickEditable(updates)),
        },
        "updating"
      ),
    [runWrite]
  );

  /** Marks a tool discontinued (a status change; the row is kept). */
  const discontinueTool = useCallback(
    (toolId: string) => runWrite(toolId, { method: "DELETE" }, "discontinuing"),
    [runWrite]
  );

  return {
    tools,
    rankings,
    loading,
    error,
    fetchTools,
    fetchRankings,
    updateTool,
    discontinueTool,
  };
}
