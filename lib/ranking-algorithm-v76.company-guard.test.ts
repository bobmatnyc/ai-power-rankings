/**
 * Regression coverage for #241: a non-string `info.company` used to throw.
 *
 * Bug: `calculateCompanyBacking` called `.includes` on `info.company`. An
 * object (or number, or `true`) has no `.includes`, so one malformed tool threw
 * a TypeError and aborted the whole `computeRankings()` run.
 *
 * Fix under test: a non-string `company` / `company_name` scores exactly as if
 * the field were absent, and the engine logs one warning per affected tool
 * naming the tool id and the type found (never the value).
 *
 * DB-free, fake tool data only.
 */

import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { RankingEngineV76, type ToolMetricsV76 } from "./ranking-algorithm-v76";

const FIXED_DATE = new Date("2026-07-15T00:00:00Z");
const TOOL_ID = "id-fixture-company-tool";

/** Build an engine input the way computeRankings() does, with optional company fields. */
function toolWith(companyFields: Record<string, unknown>): ToolMetricsV76 {
  const data: Record<string, unknown> = {
    description: "An autonomous agent for code review and refactoring workflows.",
    features: ["review", "refactor", "test"],
    metrics: { funding: 20_000_000, employees: 30 },
    ...companyFields,
  };
  return {
    tool_id: TOOL_ID,
    name: "fixture-company-tool",
    slug: "fixture-company-tool",
    category: "autonomous-agent",
    status: "active",
    info: data,
    metrics: data["metrics"] as Record<string, unknown>,
  } as ToolMetricsV76;
}

describe("RankingEngineV76 — non-string company (#241)", () => {
  const engine = new RankingEngineV76();
  let warn: MockInstance<typeof console.warn>;

  beforeEach(() => {
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    warn.mockRestore();
  });

  const absentScore = () => engine.calculateToolScore(toolWith({}), FIXED_DATE);

  it.each([
    ["object company", { company: { name: "Acme Labs", size: 3 } }, "object"],
    ["array company", { company: ["Acme Labs"] }, "array"],
    ["number company", { company: 42 }, "number"],
    ["object company_name", { company_name: { name: "Acme Labs" } }, "object"],
  ])("scores a %s exactly as an absent company", (_label, fields, _type) => {
    const baseline = absentScore();
    warn.mockClear();

    const result = engine.calculateToolScore(toolWith(fields), FIXED_DATE);

    expect(result).toEqual(baseline);
  });

  it.each([
    ["object company", { company: { name: "Acme Labs" } }, "object"],
    ["array company", { company: ["Acme Labs"] }, "array"],
    ["number company", { company: 42 }, "number"],
  ])("logs exactly one warning naming the tool id for a %s", (_label, fields, type) => {
    engine.calculateToolScore(toolWith(fields), FIXED_DATE);

    expect(warn).toHaveBeenCalledTimes(1);
    const message = String(warn.mock.calls[0]?.[0]);
    expect(message).toContain(TOOL_ID);
    expect(message).toContain(type);
    expect(message).not.toContain("Acme");
    expect(message).not.toContain("42");
  });

  it("logs nothing for a string or absent company", () => {
    engine.calculateToolScore(toolWith({ company: "Acme Labs" }), FIXED_DATE);
    engine.calculateToolScore(toolWith({}), FIXED_DATE);
    engine.calculateToolScore(toolWith({ company: null }), FIXED_DATE);

    expect(warn).not.toHaveBeenCalled();
  });
});
