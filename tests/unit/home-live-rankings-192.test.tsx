import { isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ClientRankings from "../../app/[lang]/client-rankings-optimized";
import en from "../../i18n/dictionaries/en.json";
import { selectMovers } from "../../lib/rankings/select-movers";

/**
 * #192 slice 1: the home page reads the live rankings snapshot on the server.
 *
 * Why: the page passed a hardcoded three-row list with no rank changes, so the
 * top 3 went stale and the movers strip was always empty.
 * What: mocks the rankings and tools repositories, renders the `Home` server
 * component, takes the props it gives the rankings component, and renders that
 * component to static HTML as the server does. Checks the empty state when the
 * snapshot read throws or finds no snapshot (no tool from the old list), and
 * that snapshot rows, their movers and the snapshot date reach the HTML in the
 * rows `/api/rankings` returns for the same snapshot.
 * Test: `npx vitest run tests/unit/home-live-rankings-192.test.tsx`. No network.
 */

const getCurrentRankings = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("../../lib/db/connection", () => ({ getDb: () => ({}) }));
vi.mock("../../lib/db/repositories/rankings.repository", () => ({
  rankingsRepository: { getCurrentRankings: () => getCurrentRankings() },
}));

const TOOLS: Record<string, { id: string; slug: string; name: string }> = {
  t1: { id: "t1", slug: "alpha-agent", name: "Alpha Agent" },
  t2: { id: "t2", slug: "beta-editor", name: "Beta Editor" },
  t3: { id: "t3", slug: "gamma-cli", name: "Gamma CLI" },
  t4: { id: "t4", slug: "delta-ide", name: "Delta IDE" },
  t5: { id: "t5", slug: "epsilon-bot", name: "Epsilon Bot" },
};

vi.mock("../../lib/db/repositories/tools.repository", () => ({
  ToolsRepository: class {
    async findById(id: string) {
      const t = TOOLS[id];
      return t ? { ...t, category: "code-editor", status: "active", info: {} } : null;
    }
    async findBySlug() {
      return null;
    }
  },
}));

const OLD_HARDCODED_NAMES = ["GitHub Copilot", "Claude Code", "Cline"];

/** Snapshot entries: rank 4 rose 6 places, rank 2 fell 1 place. Stored out of rank order. */
const SNAPSHOT = {
  id: "snap-1",
  period: "2026-10",
  algorithm_version: "v7.9",
  is_current: true,
  published_at: new Date("2026-10-20T00:00:00.000Z"),
  created_at: new Date("2026-10-19T00:00:00.000Z"),
  updated_at: new Date("2026-10-20T00:00:00.000Z"),
  data: {
    rankings: [
      { tool_id: "t3", rank: 3, score: 70, movement: { previous_position: 3, change: 0 } },
      { tool_id: "t1", rank: 1, score: 90, movement: { previous_position: 1, change: 0 } },
      { tool_id: "t2", rank: 2, score: 80, movement: { previous_position: 1, change: -1 } },
      { tool_id: "t4", rank: 4, score: 60, movement: { previous_position: 10, change: 6 } },
      { tool_id: "t5", rank: 5, score: 50 },
    ],
  },
};

/** The props `Home` passes to the rankings component (found by its `initialRankings` prop). */
function findRankingsProps(node: ReactNode): Record<string, any> | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findRankingsProps(child);
      if (found) return found;
    }
    return null;
  }
  if (!isValidElement(node)) return null;
  const props = node.props as Record<string, any>;
  if ("initialRankings" in props) return props;
  return findRankingsProps(props.children);
}

async function renderHome() {
  const { default: Home } = await import("../../app/[lang]/page");
  const tree = await Home({ params: Promise.resolve({ lang: "en" }) });
  const props = findRankingsProps(tree);
  expect(props, "the page rendered the rankings component, not its error page").not.toBeNull();
  const html = renderToStaticMarkup(<ClientRankings {...(props as any)} />);
  return { props: props as Record<string, any>, html };
}

/** The markup between the stats block and "Recently Updated". */
function moversRegion(html: string): string {
  return html.slice(html.indexOf(">Last Update<"), html.indexOf("Recently Updated"));
}

beforeEach(() => {
  getCurrentRankings.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("home page live rankings (#192)", () => {
  it.each([
    ["the snapshot read throws", () => getCurrentRankings.mockRejectedValue(new Error("read failed"))],
    ["no snapshot is current", () => getCurrentRankings.mockResolvedValue(null)],
  ])("renders the empty state and no hardcoded tool when %s", async (_label, arrange) => {
    arrange();
    const { props, html } = await renderHome();

    for (const name of OLD_HARDCODED_NAMES) {
      expect(html, name).not.toContain(name);
    }
    expect(props.initialRankings).toEqual([]);
    expect(html).toContain("Unable to load rankings data");
    expect(moversRegion(html)).toContain(en.home.movers.empty);
    expect(console.warn).toHaveBeenCalled();
  });

  it("passes the snapshot rows, their movers and the snapshot date to the strip", async () => {
    getCurrentRankings.mockResolvedValue(SNAPSHOT);
    const { props, html } = await renderHome();

    // Same rows as /api/rankings returns for this snapshot.
    vi.stubEnv("NODE_ENV", "production");
    const { GET } = await import("../../app/api/rankings/route");
    const api = await (await GET()).json();
    expect(props.initialRankings).toEqual(api.rankings);
    expect(props.moversSnapshotDate).toBe(api.published_at);

    // Top 3 in rank order, and only 3 hero cards.
    const top = ["Alpha Agent", "Beta Editor", "Gamma CLI"].map((n) => html.indexOf(n));
    expect(top.every((i) => i > -1)).toBe(true);
    expect(top).toEqual([...top].sort((a, b) => a - b));
    expect(html.slice(0, html.indexOf(">Last Update<"))).not.toContain("Delta IDE");

    // Movers computed by selectMovers from the same rows.
    const movers = selectMovers(api.rankings as any[]);
    expect(movers.up.map((r: any) => r.tool.name)).toEqual(["Delta IDE"]);
    expect(movers.down.map((r: any) => r.tool.name)).toEqual(["Beta Editor"]);
    const region = moversRegion(html);
    expect(region).toContain("Delta IDE");
    expect(region).toContain("+6");
    expect(region).toContain("Beta Editor");
    expect(region).toContain("Since last update on Oct 20, 2026");
    expect(region).not.toContain(en.home.movers.empty);
  });
});
