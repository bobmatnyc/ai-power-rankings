// @vitest-environment jsdom
/**
 * #175: each GA4 custom event fires from the real UI component with the
 * documented name and parameters (docs/refresh/ga4-event-plan.md).
 * `trackEvent` is mocked; the pure helpers stay real.
 */
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../i18n/dictionaries/en.json";

const nav = vi.hoisted(() => ({
  pathname: "/en/rankings",
  search: "",
  push: () => {},
}));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
  useRouter: () => ({ push: nav.push, replace: () => {}, prefetch: () => {} }),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    onClick,
    ...rest
  }: {
    href: string;
    children: ReactNode;
    onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  }) => (
    <a
      href={href}
      {...rest}
      onClick={(e) => {
        onClick?.(e);
        e.preventDefault(); // jsdom cannot navigate
      }}
    >
      {children}
    </a>
  ),
}));

vi.mock("../../lib/analytics/track", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/analytics/track")>()),
  trackEvent: vi.fn(),
}));

vi.mock("../../components/ui/tool-icon", () => ({ ToolIcon: () => null }));
vi.mock("../../components/tools/tool-detail-tabs", () => ({ ToolDetailTabs: () => null }));
vi.mock("../../components/ui/sidebar", () => ({
  Sidebar: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  useSidebar: () => ({ isMobile: false, setOpenMobile: () => {} }),
}));
vi.mock("../../contexts/ranking-changes-context", () => ({
  useRankingChanges: () => ({ changes: null }),
}));
vi.mock("../../i18n/client", () => ({ useI18n: () => ({ dict: en, lang: "en" }) }));

import { ScrollDepthTracker } from "../../components/analytics/scroll-depth-tracker";
import { AppSidebar } from "../../components/layout/app-sidebar";
import { RankingCard } from "../../components/ranking/ranking-card";
import RankingsGrid from "../../components/ranking/rankings-grid";
import { SITE_SEARCH_DEBOUNCE_MS, useRankingsSearch } from "../../components/ranking/use-rankings-search";
import { ToolDetailClient } from "../../app/[lang]/tools/[slug]/tool-detail-client";
import { trackEvent } from "../../lib/analytics/track";

const tracked = vi.mocked(trackEvent);
const dict = en as never;

function ranking(rank: number, slug: string, name: string, category: string) {
  return {
    rank,
    tool: { id: `id-${slug}`, slug, name, category, status: "active" },
    scores: {
      overall: 80 - rank,
      agentic_capability: 7,
      innovation: 7,
      technical_performance: 7,
      developer_adoption: 7,
      market_traction: 7,
      business_sentiment: 7,
      development_velocity: 7,
      platform_resilience: 7,
    },
    metrics: {},
  };
}

beforeEach(() => {
  tracked.mockClear();
  nav.pathname = "/en/rankings";
  nav.search = "";
  nav.push = () => {};
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({}), { status: 200 }))
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ranking_row_click", () => {
  it("fires with slug, rank, list and category when a ranking row is clicked", () => {
    render(<RankingCard ranking={ranking(2, "cursor", "Cursor", "code-editor")} />);
    fireEvent.click(screen.getByText("Cursor"));
    expect(tracked).toHaveBeenCalledWith("ranking_row_click", {
      tool_slug: "cursor",
      rank: 2,
      list_name: "rankings",
      tool_category: "code-editor",
    });
  });

  it("is not sent for the category badge, which is a filter_use instead", () => {
    render(<RankingCard ranking={ranking(2, "cursor", "Cursor", "code-editor")} />);
    fireEvent.click(screen.getByText("code editor"));
    expect(tracked).toHaveBeenCalledTimes(1);
    expect(tracked).toHaveBeenCalledWith("filter_use", {
      filter_name: "category",
      filter_value: "code-editor",
      page_type: "rankings",
    });
  });
});

describe("filter_use", () => {
  const categories = [
    { id: "all", name: "All", count: 3 },
    { id: "ide-assistant", name: "IDE Assistant", count: 2 },
  ];

  it("fires for a sidebar category link with the category id and page type", () => {
    nav.pathname = "/en/tools";
    render(<AppSidebar categories={categories} />);
    fireEvent.click(screen.getByText(en.tools.categories["ide-assistant"]));
    expect(tracked).toHaveBeenCalledWith("filter_use", {
      filter_name: "category",
      filter_value: "ide-assistant",
      page_type: "tools",
    });
  });

  it("fires for a sidebar tag button with the tag id", () => {
    render(<AppSidebar categories={categories} />);
    fireEvent.click(screen.getByText(en.features.testing));
    expect(tracked).toHaveBeenCalledWith("filter_use", {
      filter_name: "tag",
      filter_value: "testing",
      page_type: "rankings",
    });
  });
});

describe("tool_outbound_click", () => {
  it("sends the tool slug and destination host only, never the URL", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              tool: {
                id: "id-cursor",
                slug: "cursor",
                name: "Cursor",
                category: "code-editor",
                status: "active",
                website_url: "https://www.cursor.com/?utm_source=apr&ref=secret",
                github_repo: "https://github.com/getcursor/cursor",
              },
            }),
            { status: 200 }
          )
      )
    );
    render(<ToolDetailClient slug="cursor" lang="en" dict={dict} />);
    const [websiteLink] = await screen.findAllByText(en.tools.detail.visitWebsite);
    fireEvent.click(websiteLink);
    expect(tracked).toHaveBeenCalledWith("tool_outbound_click", {
      tool_slug: "cursor",
      link_domain: "cursor.com",
      link_type: "website",
    });
    fireEvent.click(screen.getAllByText("GitHub")[0]);
    expect(tracked).toHaveBeenLastCalledWith("tool_outbound_click", {
      tool_slug: "cursor",
      link_domain: "github.com",
      link_type: "github",
    });
    expect(JSON.stringify(tracked.mock.calls)).not.toContain("utm_source");
  });
});

describe("scroll_depth", () => {
  function scrollTo(y: number): void {
    Object.defineProperty(window, "scrollY", { value: y, configurable: true });
    fireEvent.scroll(window);
  }

  beforeEach(() => {
    Object.defineProperty(document.documentElement, "scrollHeight", { value: 4000, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0);
      return 0;
    });
  });

  it("fires once at 75% with the page type, and re-arms on a new page view", () => {
    const { rerender } = render(<ScrollDepthTracker />);
    scrollTo(1000); // (1000 + 800) / 4000 = 45%
    expect(tracked).not.toHaveBeenCalled();

    scrollTo(2300); // 77.5%
    scrollTo(3200); // 100%, same page view
    expect(tracked).toHaveBeenCalledTimes(1);
    expect(tracked).toHaveBeenCalledWith("scroll_depth", { percent_scrolled: 75, page_type: "rankings" });

    nav.pathname = "/en/tools/cursor";
    rerender(<ScrollDepthTracker />);
    scrollTo(3200);
    expect(tracked).toHaveBeenCalledTimes(2);
    expect(tracked).toHaveBeenLastCalledWith("scroll_depth", {
      percent_scrolled: 75,
      page_type: "tool_detail",
    });
  });
});

describe("site_search", () => {
  const rankings = [
    ranking(1, "cursor", "Cursor", "code-editor"),
    ranking(2, "claude-code", "Claude Code", "autonomous-agent"),
    ranking(3, "copilot", "GitHub Copilot", "ide-assistant"),
  ];

  const siteSearches = () => tracked.mock.calls.filter(([name]) => name === "site_search");

  async function renderGrid() {
    await act(async () => {
      render(<RankingsGrid lang="en" dict={dict} initialRankings={rankings as never} />);
    });
    return screen.getByRole("searchbox", { name: en.common.search });
  }

  // #233: the term is typed into the box; it never enters the URL.
  it("filters as you type and sends one site_search after the debounce, never the text", async () => {
    const push = vi.fn();
    nav.push = push;
    const pushState = vi.spyOn(window.history, "pushState");
    const replaceState = vi.spyOn(window.history, "replaceState");
    const box = await renderGrid();
    vi.useFakeTimers();
    try {
      for (const value of ["C", "Cu", "Cur", "Cursor"]) {
        fireEvent.change(box, { target: { value } });
        act(() => vi.advanceTimersByTime(SITE_SEARCH_DEBOUNCE_MS - 100));
      }
      expect(screen.queryByText("Claude Code")).toBeNull();
      expect(screen.getAllByText("Cursor").length).toBeGreaterThan(0);
      expect(siteSearches()).toHaveLength(0);

      act(() => vi.advanceTimersByTime(100));
      expect(siteSearches()).toEqual([
        [
          "site_search",
          { query_length: 6, query_length_bucket: "4-10", result_count: 1, search_location: "rankings" },
        ],
      ]);
      act(() => vi.advanceTimersByTime(SITE_SEARCH_DEBOUNCE_MS * 3));
      expect(siteSearches()).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
    expect(JSON.stringify(tracked.mock.calls)).not.toMatch(/cursor/i);
    expect(push).not.toHaveBeenCalled();
    expect(pushState).not.toHaveBeenCalled();
    expect(replaceState).not.toHaveBeenCalled();
    pushState.mockRestore();
    replaceState.mockRestore();
  });

  it("renders the box with no form ancestor and no name", async () => {
    const box = await renderGrid();
    expect(box.closest("form")).toBeNull();
    expect(box.hasAttribute("name")).toBe(false);
    expect(document.querySelector("form")).toBeNull();
  });

  it("the term badge clears the box and shows every row again", async () => {
    const box = await renderGrid();
    fireEvent.change(box, { target: { value: "Cursor" } });
    expect(screen.queryByText("Claude Code")).toBeNull();
    fireEvent.click(screen.getByText(/Cursor.*✕/));
    expect((box as HTMLInputElement).value).toBe("");
    expect(screen.getByText("Claude Code")).toBeTruthy();
  });

  // #233: ?term= and ?search= were the #175 entry points; middleware now strips them, and the grid ignores them.
  it.each(["term=Cursor", "search=Cursor"])("ignores ?%s in the URL", async (query) => {
    nav.search = query;
    await renderGrid();
    await new Promise((resolve) => setTimeout(resolve, SITE_SEARCH_DEBOUNCE_MS + 50));
    expect(screen.getByText("Claude Code")).toBeTruthy();
    expect(siteSearches()).toHaveLength(0);
  });

  it("sends nothing and shows every row without a search term", async () => {
    await act(async () => {
      render(<RankingsGrid lang="en" dict={dict} initialRankings={rankings as never} />);
    });
    expect(tracked.mock.calls.filter(([name]) => name === "site_search")).toHaveLength(0);
    expect(screen.getByText("Claude Code")).toBeTruthy();
  });

  // #175: the rankings API passes name/category/slug/id through unchecked.
  it("matches rows with null or undefined fields on the fields they do have", () => {
    const rows = [
      { tool: { id: null, slug: undefined, name: null, category: "cursor-like" } },
      { tool: { id: "id-x", slug: null, name: "Cursor Pro", category: undefined } },
      { tool: { id: "cursor-id", slug: undefined, name: undefined, category: null } },
      { tool: { id: null, slug: null, name: null, category: null } },
      { tool: { id: "id-y", slug: "other", name: "Other", category: "editor" } },
    ];
    const { result } = renderHook(() => useRankingsSearch(rows as never[], "cursor", true));
    expect(result.current).toEqual([rows[0], rows[1], rows[2]]);
  });
});
