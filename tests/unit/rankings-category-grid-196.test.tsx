// @vitest-environment jsdom
/**
 * #196: the rankings grid's client-side `?category=` filter.
 *
 * Why: `/rankings?category=` (the home and `/best-*` links) is filtered by the grid on the
 *   client, and the category route's grid re-applies it after hydration. An unknown value
 *   must show the whole board, and a known category with no row a message, not a blank grid.
 * What: renders the real `RankingsGrid` with a three-row board and a mocked query string.
 * Test: `npx vitest run tests/unit/rankings-category-grid-196.test.tsx`. No network.
 */
import { act, cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../i18n/dictionaries/en.json";

const nav = vi.hoisted(() => ({ search: "" }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/en/rankings",
  useSearchParams: () => new URLSearchParams(nav.search),
  useRouter: () => ({ push: () => {}, replace: () => {}, prefetch: () => {} }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("../../lib/analytics/track", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/analytics/track")>()),
  trackEvent: vi.fn(),
}));
vi.mock("../../components/ui/tool-icon", () => ({ ToolIcon: () => null }));
vi.mock("../../contexts/ranking-changes-context", () => ({ useRankingChanges: () => ({ changes: null }) }));
vi.mock("../../i18n/client", () => ({ useI18n: () => ({ dict: en, lang: "en" }) }));

import RankingsGrid from "../../components/ranking/rankings-grid";

function ranking(rank: number, slug: string, name: string, category: string) {
  return { rank, tool: { id: `id-${slug}`, slug, name, category, status: "active" }, scores: { overall: 80 - rank }, metrics: {} };
}
const rankings = [
  ranking(1, "cursor", "Cursor", "code-editor"),
  ranking(2, "claude-code", "Claude Code", "autonomous-agent"),
  ranking(3, "copilot", "GitHub Copilot", "ide-assistant"),
];
const names = ["Cursor", "Claude Code", "GitHub Copilot"];

async function renderGrid() {
  await act(async () => {
    render(<RankingsGrid lang="en" dict={en as never} initialRankings={rankings as never} />);
  });
}
const shown = () => names.filter((name) => screen.queryAllByText(name).length > 0);

beforeEach(() => {
  nav.search = "";
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({}), { status: 200 })));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("#196 grid ?category=", () => {
  it("a known category shows only its rows", async () => {
    nav.search = "category=autonomous-agent";
    await renderGrid();
    expect(shown()).toEqual(["Claude Code"]);
  });

  it.each(["category=no-such-category", "category="])("%s shows every row and no empty message", async (search) => {
    nav.search = search;
    await renderGrid();
    expect(shown()).toEqual(names);
    expect(screen.queryByText(en.rankings.lists.categoryEmpty)).toBeNull();
  });

  it("a known category with no row shows the empty message", async () => {
    nav.search = "category=testing-tool";
    await renderGrid();
    expect(shown()).toEqual([]);
    expect(screen.getByText(en.rankings.lists.categoryEmpty)).toBeTruthy();
  });
});
