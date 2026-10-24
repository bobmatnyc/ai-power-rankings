import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ClientRankings from "../../app/[lang]/client-rankings-optimized";

/**
 * #192 slice 1: the home page movers strip in the server HTML.
 *
 * Why: the strip was computed in client effects only, scanned the first 30
 * ranks, and showed the top 3 tools under "gaining momentum" when nothing moved.
 * What: renders the home rankings component to static HTML, as the server does
 * (no effects run), from 40 fixture rows whose biggest riser is rank 35 and
 * which hold one faller. The movers region is the markup between the stats
 * block and "Recently Updated". Covers the server output (AC5), the signed
 * faller (AC2), the snapshot-date label (Q2) and the empty state (AC3).
 * Test: `npx vitest run tests/unit/home-movers-192.test.tsx`. No network.
 */

const MOVERS_TEXT = {
  title: "Biggest movers",
  sinceLastUpdate: "Since last update",
  sinceLastUpdateOn: "Since last update on {date}",
  up: "Moving up",
  down: "Moving down",
  empty: "No rank changes since the last update.",
};

function row(rank: number, name: string, rankChange = 0) {
  return {
    rank,
    previousRank: rank + rankChange,
    rankChange,
    tool: { id: `id-${rank}`, slug: `tool-${rank}`, name, category: "code-editor", status: "active" },
    scores: { overall: 90 - rank, agentic_capability: 5, innovation: 5 },
    metrics: {},
  };
}

function fortyRows(withMoves: boolean) {
  const rows = Array.from({ length: 40 }, (_, i) => row(i + 1, `Tool ${String(i + 1).padStart(2, "0")}`));
  rows[0] = row(1, "Top One");
  rows[1] = row(2, "Top Two");
  rows[2] = row(3, "Top Three");
  if (withMoves) {
    rows[34] = row(35, "Deep Riser", 20);
    rows[7] = row(8, "Steep Faller", -4);
  }
  return rows;
}

function moversRegion(props: { rows: ReturnType<typeof fortyRows>; snapshotDate?: string }): string {
  const html = renderToStaticMarkup(
    <ClientRankings
      loadingText="Loading"
      lang="en"
      initialRankings={props.rows}
      moversText={MOVERS_TEXT}
      moversSnapshotDate={props.snapshotDate}
    />
  );
  const start = html.indexOf(">Last Update<");
  const end = html.indexOf("Recently Updated");
  expect(start, "stats block present").toBeGreaterThan(-1);
  expect(end, "recently updated present").toBeGreaterThan(start);
  return html.slice(start, end);
}

/** The region's text, tags stripped, within 30 characters of `name`. */
function textNear(region: string, name: string): string {
  const text = region.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
  const at = text.indexOf(name);
  return at < 0 ? "" : text.slice(Math.max(0, at - 30), at + name.length + 30);
}

describe("home movers strip (#192)", () => {
  it("AC5: server HTML holds the movers heading and the rank-35 riser with its delta", () => {
    const region = moversRegion({ rows: fortyRows(true) });
    expect(textNear(region, "Deep Riser")).toContain("+20");
    expect(region).toContain(MOVERS_TEXT.title);
    expect(region).toContain(MOVERS_TEXT.up);
  });

  it("AC2: the faller is listed under the down heading with a signed delta", () => {
    const region = moversRegion({ rows: fortyRows(true) });
    expect(textNear(region, "Steep Faller")).toContain("-4");
    expect(region).toContain(MOVERS_TEXT.down);
    expect(region.indexOf("Steep Faller")).toBeGreaterThan(region.indexOf(MOVERS_TEXT.down));
  });

  it("Q2: the label names the last update and its snapshot date, not a week", () => {
    const region = moversRegion({ rows: fortyRows(true), snapshotDate: "2026-10-20T00:00:00.000Z" });
    expect(region.toLowerCase()).not.toContain("week");
    expect(region).toContain("Since last update on Oct 20, 2026");
  });

  it("AC3: with no rank changes the region shows the empty line and none of the top 3", () => {
    const region = moversRegion({ rows: fortyRows(false) });
    for (const name of ["Top One", "Top Two", "Top Three"]) {
      expect(region, name).not.toContain(name);
    }
    expect(region).toContain(MOVERS_TEXT.empty);
  });
});
