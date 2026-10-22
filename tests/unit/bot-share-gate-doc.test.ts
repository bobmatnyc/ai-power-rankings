/**
 * #176: docs/refresh/bot-share-gate.md must keep a pass/fail row, with both
 * cells filled, for every M7 metric from #201/#202, plus Status and Frozen-on lines.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const doc = readFileSync(join(process.cwd(), "docs/refresh/bot-share-gate.md"), "utf8");

const METRICS = [
  "Engagement",
  "Views per user",
  "List-to-detail rate",
  "Insights traffic",
  "Search Console indexed pages",
  "Search Console 404 count",
  "Search Console clicks and impressions",
  "API spend per month",
  "/rankings recommendation",
];

// Only the section 3 threshold table counts; the decisions log reuses metric names.
const thresholdSection = doc.split(/^## /m).find((s) => s.startsWith("3. ")) ?? "";

function rowCells(metric: string): string[] | undefined {
  const line = thresholdSection.split("\n").find((l) => l.startsWith(`| ${metric} |`));
  return line
    ?.split("|")
    .slice(1, -1)
    .map((c) => c.trim());
}

describe("bot-share gate doc", () => {
  it.each(METRICS)("has a row with Pass and Fail cells for %s", (metric) => {
    const cells = rowCells(metric);
    expect(cells, `missing table row for ${metric}`).toBeDefined();
    expect(cells).toHaveLength(3);
    expect(cells?.[1]).not.toBe("");
    expect(cells?.[2]).not.toBe("");
  });

  it("has a Status line and a Frozen on line", () => {
    expect(doc).toMatch(/^Status: DRAFT — freezes after #174$/m);
    expect(doc).toMatch(/^Frozen on: .+$/m);
  });
});
