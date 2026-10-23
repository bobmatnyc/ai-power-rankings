// @vitest-environment jsdom
/**
 * #207: a rankings search that matches no row shows a message and a clear
 * button instead of a blank grid; the dead GoogleAnalyticsOptimized loader is gone.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../i18n/dictionaries/en.json";

const nav = vi.hoisted(() => ({ search: "", push: () => {} }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/en/rankings",
  useSearchParams: () => new URLSearchParams(nav.search),
  useRouter: () => ({ push: nav.push, replace: () => {}, prefetch: () => {} }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("../../lib/analytics/track", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/analytics/track")>()),
  trackEvent: vi.fn(),
}));
vi.mock("../../components/ui/tool-icon", () => ({ ToolIcon: () => null }));
vi.mock("../../contexts/ranking-changes-context", () => ({
  useRankingChanges: () => ({ changes: null }),
}));
vi.mock("../../i18n/client", () => ({ useI18n: () => ({ dict: en, lang: "en" }) }));

import RankingsGrid from "../../components/ranking/rankings-grid";
import { SITE_SEARCH_DEBOUNCE_MS } from "../../components/ranking/use-rankings-search";
import { trackEvent } from "../../lib/analytics/track";

const dict = en as never;
const repoRoot = path.resolve(__dirname, "../..");

function ranking(rank: number, slug: string, name: string, category: string) {
  return {
    rank,
    tool: { id: `id-${slug}`, slug, name, category, status: "active" },
    scores: { overall: 80 - rank },
    metrics: {},
  };
}

const rankings = [
  ranking(1, "cursor", "Cursor", "code-editor"),
  ranking(2, "claude-code", "Claude Code", "autonomous-agent"),
  ranking(3, "copilot", "GitHub Copilot", "ide-assistant"),
];
const names = ["Cursor", "Claude Code", "GitHub Copilot"];

async function renderGrid(initial: unknown[] = rankings) {
  await act(async () => {
    render(<RankingsGrid lang="en" dict={dict} initialRankings={initial as never} />);
  });
}

const box = () => screen.getByRole("searchbox", { name: en.common.search }) as HTMLInputElement;
const type = (value: string) => fireEvent.change(box(), { target: { value } });

beforeEach(() => {
  nav.search = "";
  nav.push = () => {};
  vi.mocked(trackEvent).mockClear();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({}), { status: 200 })));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("rankings search empty state (#207)", () => {
  it("shows a status message with the trimmed term and no ranking cards when nothing matches", async () => {
    await renderGrid();
    type("  zzzz  ");
    const status = screen.getByRole("status");
    expect(status.textContent).toBe(en.rankings.noResults.replace("{term}", "zzzz"));
    for (const name of names) expect(screen.queryByText(name)).toBeNull();
  });

  it("still sends one site_search with result_count 0 and no term text for a no-match term", async () => {
    await renderGrid();
    vi.useFakeTimers();
    try {
      type("zzzz");
      act(() => vi.advanceTimersByTime(SITE_SEARCH_DEBOUNCE_MS * 3));
    } finally {
      vi.useRealTimers();
    }
    const searches = vi.mocked(trackEvent).mock.calls.filter(([name]) => name === "site_search");
    expect(searches).toEqual([
      [
        "site_search",
        { query_length: 4, query_length_bucket: "4-10", result_count: 0, search_location: "rankings" },
      ],
    ]);
    expect(JSON.stringify(searches)).not.toContain("zzzz");
  });

  it("the clear button empties the box, hides the message and shows every row, without navigating", async () => {
    const push = vi.fn();
    nav.push = push;
    const pushState = vi.spyOn(window.history, "pushState");
    const replaceState = vi.spyOn(window.history, "replaceState");
    await renderGrid();
    type("zzzz");
    fireEvent.click(screen.getByRole("button", { name: en.rankings.clearSearch }));
    expect(box().value).toBe("");
    expect(screen.queryByRole("status")).toBeNull();
    for (const name of names) expect(screen.getAllByText(name).length).toBeGreaterThan(0);
    expect(push).not.toHaveBeenCalled();
    expect(pushState).not.toHaveBeenCalled();
    expect(replaceState).not.toHaveBeenCalled();
  });

  it("shows no message when the term is empty or only spaces", async () => {
    await renderGrid();
    expect(screen.queryByRole("status")).toBeNull();
    type("   ");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows no message when the term matches a row", async () => {
    await renderGrid();
    type("Cursor");
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getAllByText("Cursor").length).toBeGreaterThan(0);
  });

  it("shows no message while the rankings are loading", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    await renderGrid([]);
    expect(screen.getByText(en.common.loading)).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("a category filter with zero rows and no term shows no search message", async () => {
    nav.search = "category=no-such-category";
    await renderGrid();
    for (const name of names) expect(screen.queryByText(name)).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("button", { name: en.rankings.clearSearch })).toBeNull();
  });
});

describe("dead GA loader removal (#207)", () => {
  it("GoogleAnalytics-optimized.tsx is deleted", () => {
    expect(existsSync(path.join(repoRoot, "components/analytics/GoogleAnalytics-optimized.tsx"))).toBe(false);
  });

  it("the live GoogleAnalytics loader and its layout import remain", () => {
    expect(existsSync(path.join(repoRoot, "components/analytics/GoogleAnalytics.tsx"))).toBe(true);
    const layout = readFileSync(path.join(repoRoot, "app/[lang]/layout.tsx"), "utf8");
    expect(layout).toContain('import { GoogleAnalytics } from "@/components/analytics/GoogleAnalytics";');
    expect(layout).toMatch(/<GoogleAnalytics\b/);
  });
});
