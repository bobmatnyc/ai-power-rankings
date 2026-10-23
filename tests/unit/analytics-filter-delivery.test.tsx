// @vitest-environment jsdom
/**
 * #175: the sort select and the sidebar tag filter must hand `filter_use` to
 * gtag on a page that stays loaded.
 *
 * Why: gtag.js batches GA4 hits for about five seconds. A full document
 *   navigation (`window.location.href = ...`) leaves only gtag's pagehide
 *   flush, which a scripted collect capture cannot see, so the production
 *   capture saw no `filter_use` for these two controls. The sidebar category
 *   filter, a client-side `<Link>`, was captured.
 * What: Renders the real components with the real `trackEvent` and a
 *   recording `window.gtag`. Each test asserts the exact gtag call, that the
 *   route change goes through the App Router, and that jsdom never received a
 *   document navigation.
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../i18n/dictionaries/en.json";

const nav = vi.hoisted(() => ({
  pathname: "/en/rankings",
  search: "",
  pushed: [] as string[],
}));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
  useRouter: () => ({
    push: (url: string) => nav.pushed.push(url),
    replace: () => {},
    prefetch: () => {},
  }),
}));

vi.mock("../../components/ui/tool-icon", () => ({ ToolIcon: () => null }));
vi.mock("../../components/ui/sidebar", () => ({
  Sidebar: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  useSidebar: () => ({ isMobile: false, setOpenMobile: () => {} }),
}));
vi.mock("../../contexts/ranking-changes-context", () => ({
  useRankingChanges: () => ({ changes: null }),
}));
vi.mock("../../i18n/client", () => ({ useI18n: () => ({ dict: en, lang: "en" }) }));

import { AppSidebar } from "../../components/layout/app-sidebar";
import RankingsGrid from "../../components/ranking/rankings-grid";

const gtag = vi.fn();
const consoleError = vi.spyOn(console, "error");

/** jsdom reports every attempted document navigation as "Not implemented: navigation". */
function documentNavigations(): string[] {
  return consoleError.mock.calls
    .map((args) => args.map((a) => String((a as Error)?.message ?? a)).join(" "))
    .filter((text) => /Not implemented: navigation/.test(text));
}

const filterUseCalls = () => gtag.mock.calls.filter(([command, name]) => command === "event" && name === "filter_use");

beforeEach(() => {
  nav.pathname = "/en/rankings";
  nav.search = "";
  nav.pushed = [];
  gtag.mockClear();
  consoleError.mockClear();
  (window as unknown as { gtag: typeof gtag }).gtag = gtag;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({}), { status: 200 }))
  );
  // Radix Select needs these pointer/scroll APIs, which jsdom lacks.
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  Element.prototype.releasePointerCapture = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete (window as unknown as { gtag?: unknown }).gtag;
});

describe("filter_use delivery (#175)", () => {
  it("sort select: gtag gets filter_use and the page stays loaded", async () => {
    const rankings = [
      {
        rank: 1,
        tool: { id: "id-cursor", slug: "cursor", name: "Cursor", category: "code-editor", status: "active" },
        scores: { overall: 80 },
        metrics: {},
      },
    ];
    await act(async () => {
      render(<RankingsGrid lang="en" dict={en as never} initialRankings={rankings as never} />);
    });
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name: en.rankings.sort.score }));

    expect(filterUseCalls()).toEqual([
      ["event", "filter_use", { filter_name: "sort", filter_value: "score", page_type: "rankings" }],
    ]);
    expect(documentNavigations()).toEqual([]);
    expect(nav.pushed).toEqual(["/en/rankings?sort=score"]);
  });

  it("sidebar tag button: gtag gets filter_use and the page stays loaded", () => {
    render(<AppSidebar categories={[{ id: "all", name: "All", count: 1 }] as never} />);
    fireEvent.click(screen.getByText(en.features.testing));

    expect(filterUseCalls()).toEqual([
      ["event", "filter_use", { filter_name: "tag", filter_value: "testing", page_type: "rankings" }],
    ]);
    expect(documentNavigations()).toEqual([]);
    expect(nav.pushed).toEqual(["/en/rankings?tags=testing"]);
  });
});
