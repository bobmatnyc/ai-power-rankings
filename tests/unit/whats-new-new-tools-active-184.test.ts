/**
 * #184: the what's-new "New Tools" set lists active tools only.
 *
 * Why: seeded open-weight models are created `inactive`. `getMonthlyData` feeds both the
 *   summary prompt and `calculateDataHash`, so an inactive tool in that set would trigger a
 *   paid LLM call and publish the tool under "new tools added".
 * What: runs the real `getMonthlyData` over a recording `pg-proxy` database that returns a
 *   tool row only when the rendered statement carries the `status = 'active'` bound parameter,
 *   so the result depends on the filter being in the SQL. Another case checks the
 *   statement's parameters directly.
 * Test: `npx vitest run tests/unit/whats-new-new-tools-active-184.test.ts`. No network.
 */

import { drizzle } from "drizzle-orm/pg-proxy";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ statements: [] as Array<{ text: string; params: unknown[] }> }));

vi.mock("../../lib/db/connection", () => ({
  getDb: () =>
    drizzle(async (text: string, params: unknown[]) => {
      state.statements.push({ text, params });
      if (/from "tools"/i.test(text)) {
        const all = [
          ["id-active", "Active Tool", "other", new Date(), null, "active"],
          ["id-inactive", "Inactive Model", "other", new Date(), null, "inactive"],
        ];
        // Mimic Postgres: apply the status filter only if the statement binds one.
        const wanted = /"status" = \$\d+/.test(text) ? params.filter((p) => p === "active" || p === "inactive") : null;
        const rows = all.filter((r) => wanted === null || wanted.includes(r[5]));
        return { rows: rows.map((r) => r.slice(0, 5)) };
      }
      return { rows: [] };
    }),
}));
vi.mock("../../lib/data/changelog-entries", () => ({ CHANGELOG_ENTRIES: [] }));

import { WhatsNewAggregationService } from "../../lib/services/whats-new-aggregation.service";

beforeEach(() => {
  state.statements = [];
});

describe("#184 what's-new New Tools", () => {
  it("excludes an inactive tool created this month, keeps an active one, and hashes only the active id", async () => {
    const service = new WhatsNewAggregationService();
    const data = await service.getMonthlyData();
    expect(data.newTools.map((t) => t.id)).toEqual(["id-active"]);
    expect(data.metadata.totalNewTools).toBe(1);

    const withInactive = { ...data, newTools: [...data.newTools, { ...data.newTools[0]!, id: "id-inactive" }] };
    expect(service.calculateDataHash(withInactive)).not.toBe(service.calculateDataHash(data));
  });

  it("binds status = 'active' on the tools statement", async () => {
    await new WhatsNewAggregationService().getMonthlyData();
    const tools = state.statements.find((s) => /from "tools"/i.test(s.text));
    expect(tools?.text).toMatch(/"status" = \$\d+/);
    expect(tools?.params).toContain("active");
  });
});
