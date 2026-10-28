/**
 * D58: the `tools.status` column decides a tool's status, never a stale `data.status` copy.
 *
 * Why: `mapDbToolToData` spread `data` after the column, so a deprecated (archived) row whose JSONB
 *   still says `status: "active"` read as active and its page stayed indexable.
 * What: a deprecated row with a stale `data.status: "active"`, read through the real
 *   `ToolsRepository.findBySlug` over a stubbed database, maps to `deprecated`, and the tool page
 *   metadata built from it is noindex.
 * Test: `npx vitest run tests/unit/tool-status-column-d58.test.ts`. No database, no network.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

const ROW = {
  id: "uuid-grok-4-5",
  slug: "grok-4-5",
  name: "Grok 4.5",
  category: "other",
  status: "deprecated",
  kind: "model",
  companyId: null,
  data: { id: "t-grok-4-5", status: "active", info: {} },
  createdAt: new Date("2026-10-28T00:00:00Z"),
  updatedAt: new Date("2026-10-28T00:00:00Z"),
};

afterEach(() => {
  vi.doUnmock("../../lib/db/connection");
  vi.resetModules();
});

describe("tool status comes from the column (D58)", () => {
  it("a deprecated row with a stale data.status of active maps to deprecated and its page is noindex", async () => {
    vi.resetModules();
    vi.doMock("../../lib/db/connection", () => ({
      getDb: () => ({ select: () => ({ from: () => ({ where: () => ({ limit: async () => [ROW] }) }) }) }),
    }));
    const { ToolsRepository } = await import("../../lib/db/repositories/tools.repository");
    const tool = await new ToolsRepository().findBySlug("grok-4-5");
    expect(tool).toMatchObject({ slug: "grok-4-5", status: "deprecated", db_id: "uuid-grok-4-5" });

    const { generateToolMetadata } = await import("../../app/[lang]/tools/[slug]/metadata");
    expect((await generateToolMetadata("grok-4-5", "en")).robots).toMatchObject({ index: false });
  });
});
