// @vitest-environment jsdom
/**
 * #194 (M5-2): the header nav, the phone menu and the footer.
 *
 * Why: the menu structure (Rankings entries are peers, D2d), the locale prefix
 *   on every href, `aria-current`, and the rule that the nav links only to live
 *   pages are all easy to break silently.
 * What: checks the nav model, proves every rendered nav path is a page under
 *   `app/[lang]` that no locale's #191 URL-table row redirects, and drives
 *   `DesktopSiteNav`, `MobileSiteNav` and `Footer` through open, close and
 *   keyboard paths.
 * Test: `npx vitest run tests/unit/site-nav-194.test.tsx`.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "../../i18n/dictionaries/en.json";
import ja from "../../i18n/dictionaries/ja.json";

const state = vi.hoisted(() => ({ pathname: "/en", lang: "en", dict: null as unknown }));

vi.mock("next/navigation", () => ({ usePathname: () => state.pathname }));
vi.mock("next/link", () => ({
  default: ({ href, children, onClick, ...rest }: { href: string; children: ReactNode; onClick?: () => void }) => (
    <a
      href={href}
      {...rest}
      onClick={(event) => {
        onClick?.();
        event.preventDefault(); // jsdom cannot navigate
      }}
    >
      {children}
    </a>
  ),
}));
vi.mock("../../i18n/client", () => ({ useI18n: () => ({ dict: state.dict ?? en, lang: state.lang }) }));

import { Footer } from "../../components/layout/footer";
import { DesktopSiteNav, MobileSiteNav } from "../../components/layout/site-nav";
import { type Locale, locales } from "../../i18n/config";
import {
  buildSiteNav,
  currentSection,
  liveNavPaths,
  RANKING_SUB_PAGES,
} from "../../lib/navigation/site-nav";
import { isNoindexToolSlug, resolveTableRedirect, URL_TABLE_ROWS } from "../../lib/seo/url-table";

afterEach(() => {
  cleanup();
  state.dict = null;
});

function show(pathname: string, lang: Locale) {
  state.pathname = pathname;
  state.lang = lang;
}

function hrefs(container: HTMLElement): string[] {
  return [...container.querySelectorAll("a")].map((a) => a.getAttribute("href") ?? "");
}

describe("nav model", () => {
  it("Rankings is a menu of peer links; the other sections are plain links", () => {
    const menus = buildSiteNav("en", en);
    expect(menus.map((m) => m.id)).toEqual(["rankings", "tools", "news", "methodology", "about"]);
    const rankings = menus[0];
    expect(rankings?.href).toBeUndefined();
    expect(rankings?.children?.map((c) => [c.id, c.href, c.label])).toEqual([
      ["overall", "/en/rankings", en.navigation.overallRankings],
      ["historical-trends", "/en/trending", en.sidebar.historicalTrends],
    ]);
    for (const menu of menus.slice(1)) expect(menu.children).toBeUndefined();
  });

  it("D2d: open-weight is a peer Rankings entry, never under Models, and hidden until live", () => {
    const ids = RANKING_SUB_PAGES.map((page) => page.id);
    expect(ids).toContain("open-weight");
    expect(ids).toContain("models");
    // Not live on main yet (#195): nothing links to it.
    expect(buildSiteNav("en", en).flatMap((m) => m.children ?? []).map((c) => c.id)).not.toContain(
      "open-weight"
    );
    // Once live, it renders as a direct child of Rankings beside Models.
    const allLive = RANKING_SUB_PAGES.map((page) => ({ ...page, live: true }));
    const menus = buildSiteNav("de", en, allLive);
    expect(menus.find((m) => m.id === ("models" as never))).toBeUndefined();
    const children = menus.find((m) => m.id === "rankings")?.children ?? [];
    expect(children.map((c) => c.id)).toEqual(ids);
    expect(children.find((c) => c.id === "open-weight")?.href).toBe("/de/rankings/open-weight-models");
    for (const child of children) expect(child).not.toHaveProperty("children");
  });

  it.each([...locales])("every href stays in the /%s/ prefix", (locale) => {
    const all = buildSiteNav(locale, en).flatMap((m) => [m.href, ...(m.children ?? []).map((c) => c.href)]);
    for (const href of all.filter(Boolean)) expect(href?.startsWith(`/${locale}/`), href).toBe(true);
  });

  it.each([
    ["/fr/rankings", "rankings"],
    ["/fr/trending", "rankings"],
    ["/fr/tools/cursor", "tools"],
    ["/fr/news/some-article", "news"],
    ["/fr/methodology/", "methodology"],
    ["/fr", null],
    ["/fr/privacy", null],
    ["/fr/toolsmith", null],
  ])("currentSection(%s) is %s", (pathname, expected) => {
    expect(currentSection(pathname, "fr")).toBe(expected);
  });
});

describe("every nav link points at a live page", () => {
  const appLang = path.join(process.cwd(), "app", "[lang]");

  it.each(liveNavPaths())("%s", (navPath) => {
    const pathOnly = navPath.split("?")[0] as string;
    const page = path.join(appLang, ...pathOnly.split("/").filter(Boolean), "page.tsx");
    expect(existsSync(page), page).toBe(true);
    for (const locale of locales) {
      const url = `/${locale}${pathOnly}`;
      // Not a shipped or a held 308 source, nor a noindex row, in the signed table.
      expect(URL_TABLE_ROWS.filter((row) => row.source.split("?")[0] === url), url).toEqual([]);
      expect(resolveTableRedirect(url), url).toBeNull();
    }
    const [, first, slug] = pathOnly.split("/");
    if (first === "tools" && slug) expect(isNoindexToolSlug(slug)).toBe(false);
  });
});

describe("DesktopSiteNav", () => {
  it("prefixes every href with the locale and marks the current section", () => {
    show("/de/tools/cursor", "de");
    const { container } = render(<DesktopSiteNav />);
    for (const href of hrefs(container)) expect(href.startsWith("/de/"), href).toBe(true);
    const tools = screen.getByRole("link", { name: en.navigation.tools });
    expect(tools.getAttribute("aria-current")).toBe("true");
    expect(screen.getByRole("link", { name: en.navigation.news }).getAttribute("aria-current")).toBeNull();
  });

  it("marks the exact page with aria-current=page", () => {
    show("/ja/methodology", "ja");
    render(<DesktopSiteNav />);
    expect(screen.getByRole("link", { name: en.navigation.methodology }).getAttribute("aria-current")).toBe(
      "page"
    );
  });

  it("opens the Rankings menu, closes it on Escape and returns focus", () => {
    show("/ko/trending", "ko");
    render(<DesktopSiteNav />);
    const button = screen.getByRole("button", { name: en.navigation.rankings });
    expect(button.getAttribute("aria-current")).toBe("true");
    expect(button.getAttribute("aria-expanded")).toBe("false");
    const list = document.getElementById(button.getAttribute("aria-controls") as string) as HTMLElement;
    expect(list.hidden).toBe(true);

    fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(list.hidden).toBe(false);
    const links = within(list).getAllByRole("link");
    expect(links.map((a) => a.getAttribute("href"))).toEqual(["/ko/rankings", "/ko/trending"]);
    expect(links[1]?.getAttribute("aria-current")).toBe("page");

    links[0]?.focus();
    fireEvent.keyDown(links[0] as HTMLElement, { key: "Escape" });
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(button);
  });

  it("closes the Rankings menu on a click outside", () => {
    show("/en", "en");
    render(<DesktopSiteNav />);
    const button = screen.getByRole("button", { name: en.navigation.rankings });
    fireEvent.click(button);
    fireEvent.pointerDown(document.body);
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });
});

describe("MobileSiteNav", () => {
  it("opens and closes from the button, with locale-prefixed links", () => {
    show("/es/news", "es");
    render(<MobileSiteNav />);
    const button = screen.getByRole("button", { name: en.sidebar.navigation });
    const panel = document.getElementById(button.getAttribute("aria-controls") as string) as HTMLElement;
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(panel.hidden).toBe(true);

    fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(panel.hidden).toBe(false);
    expect(panel.getAttribute("aria-label")).toBe(en.sidebar.navigation);
    expect(hrefs(panel)).toEqual([
      "/es",
      "/es/rankings",
      "/es/trending",
      "/es/tools",
      "/es/news",
      "/es/methodology",
      "/es/about",
    ]);
    const rankingsGroup = within(panel).getByRole("list", { name: en.navigation.rankings });
    expect(within(rankingsGroup).getAllByRole("link")).toHaveLength(2);
    expect(within(panel).getByRole("link", { name: en.navigation.news }).getAttribute("aria-current")).toBe(
      "page"
    );

    fireEvent.click(button);
    expect(panel.hidden).toBe(true);
  });

  it("the menu button's accessible name comes from the locale's dictionary", () => {
    show("/ja", "ja");
    state.dict = ja;
    render(<MobileSiteNav />);
    expect(ja.sidebar.navigation).not.toBe(en.sidebar.navigation);
    const button = screen.getByRole("button", { name: ja.sidebar.navigation });
    expect(button.getAttribute("aria-controls")).toBeTruthy();
  });

  it("closes on Escape with focus back on the button, and on a link click", () => {
    show("/en", "en");
    render(<MobileSiteNav />);
    const button = screen.getByRole("button", { name: en.sidebar.navigation });
    fireEvent.click(button);
    const link = screen.getByRole("link", { name: en.navigation.tools });
    link.focus();
    fireEvent.keyDown(link, { key: "Escape" });
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(button);

    fireEvent.click(button);
    fireEvent.click(screen.getByRole("link", { name: en.navigation.about }));
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });
});

describe("Footer", () => {
  it.each([...locales])("nav columns stay in /%s/ and mark the current page", (locale) => {
    show(`/${locale}/news`, locale);
    const { container } = render(<Footer />);
    for (const href of hrefs(container)) expect(href.startsWith(`/${locale}/`), href).toBe(true);
    const rankings = screen.getByRole("navigation", { name: en.navigation.rankings });
    expect(hrefs(rankings)).toEqual([`/${locale}/rankings`, `/${locale}/trending`]);
    const explore = screen.getByRole("navigation", { name: en.common.explore });
    expect(within(explore).getByRole("link", { name: en.navigation.news }).getAttribute("aria-current")).toBe(
      "page"
    );
    expect(screen.getByRole("link", { name: "RSS" }).getAttribute("href")).toBe(`/${locale}/news/rss.xml`);
  });
});
