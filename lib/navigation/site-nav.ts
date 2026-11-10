/**
 * The site navigation model shared by the header nav, the phone menu and the footer.
 *
 * Why: #194 (M5-2) — one source for the menu structure, so the header, the
 *   phone menu and the footer cannot drift, and every link stays inside the
 *   visitor's `/{lang}/` prefix. Owner ruling D2d (2026-10-24): the open-weight
 *   ranking is a peer entry in the Rankings menu, beside the other ranking
 *   sub-pages, never a child of Models.
 * What: `RANKING_SUB_PAGES` lists the Rankings menu entries in order. An entry
 *   with `live: false` names a page that does not exist on main yet (#195); it
 *   is never rendered, so no link points at a missing page or a placeholder.
 *   Flip `live` in the change that ships the page. `buildSiteNav` turns the
 *   model into locale-prefixed links; `currentSection` and `isCurrentPath`
 *   decide what gets `aria-current`.
 * Test: `tests/unit/site-nav-194.test.tsx`.
 */
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";

export type NavSectionId = "rankings" | "tools" | "insights" | "news" | "methodology" | "about";

/** A rendered link: `href` already carries the locale prefix. */
export interface NavLink {
  id: string;
  href: string;
  label: string;
}

export interface NavMenu {
  id: NavSectionId;
  label: string;
  /** Present for a plain link; absent when the entry opens a sub-menu. */
  href?: string;
  /** Present for a menu; every child is a peer at the same depth. */
  children?: NavLink[];
}

/** A Rankings menu entry. `path` is locale-free and may carry a query. */
export interface RankingSubPage {
  id: string;
  path: string;
  live: boolean;
  label: (dict: Dictionary) => string;
}

/**
 * The Rankings menu, in display order. All entries are peers (D2d).
 * #195 ships `/rankings/models`, `/rankings/coding-harnesses` and `/rankings/open-weight-models`.
 */
export const RANKING_SUB_PAGES: readonly RankingSubPage[] = [
  {
    id: "overall",
    path: "/rankings",
    live: true,
    label: (dict) => dict.navigation.overallRankings,
  },
  { id: "models", path: "/rankings/models", live: false, label: () => "Models" },
  {
    id: "coding-harnesses",
    path: "/rankings/coding-harnesses",
    live: false,
    label: () => "Coding harnesses",
  },
  {
    id: "open-weight",
    path: "/rankings/open-weight-models",
    live: false,
    label: () => "Open-weight models",
  },
  {
    id: "historical-trends",
    path: "/trending",
    live: true,
    label: (dict) => dict.sidebar.historicalTrends,
  },
];

/** Locale-free paths of the top-level plain links, in display order. */
const TOP_LEVEL_LINKS: readonly { id: Exclude<NavSectionId, "rankings" | "insights">; path: string }[] = [
  { id: "tools", path: "/tools" },
  { id: "news", path: "/news" },
  { id: "methodology", path: "/methodology" },
  { id: "about", path: "/about" },
];

/**
 * #198: the Insights hub link. Proposal M5-7's nav puts it between Tools and
 * News. Its label is English in every locale, as the Insights body is (#156).
 */
const INSIGHTS_LINK = { id: "insights", path: "/insights", label: "Insights", after: "tools" } as const;

/** Options for `buildSiteNav`. */
export interface SiteNavOptions {
  /**
   * #198: true only when the server read `INSIGHTS_PREVIEW` as on. The
   * Insights pages 404 while it is off, so the link is absent by default.
   */
  insights?: boolean;
}

/** Every locale-free path the nav renders; the live-route test checks each one. */
export function liveNavPaths(): string[] {
  return [
    ...RANKING_SUB_PAGES.filter((page) => page.live).map((page) => page.path),
    ...TOP_LEVEL_LINKS.map((link) => link.path),
  ];
}

/** Prefixes a locale-free path with `/{lang}`. */
export function localizedHref(lang: Locale, path: string): string {
  return `/${lang}${path}`;
}

/**
 * The menus in display order, with locale-prefixed hrefs.
 * `rankingPages` defaults to `RANKING_SUB_PAGES`; tests pass a variant.
 * #198: `options.insights` adds the Insights link after Tools; without it the
 * menus are exactly the #194 menus.
 * Postcondition: every `href` starts with `/${lang}/`; no `live: false` entry appears.
 * Test: `tests/unit/site-nav-194.test.tsx`, `tests/unit/insights-launch-198.test.tsx`.
 */
export function buildSiteNav(
  lang: Locale,
  dict: Dictionary,
  rankingPages: readonly RankingSubPage[] = RANKING_SUB_PAGES,
  options: SiteNavOptions = {}
): NavMenu[] {
  const rankings: NavMenu = {
    id: "rankings",
    label: dict.navigation.rankings,
    children: rankingPages.filter((page) => page.live).map((page) => ({
      id: page.id,
      href: localizedHref(lang, page.path),
      label: page.label(dict),
    })),
  };
  const menus: NavMenu[] = [
    rankings,
    ...TOP_LEVEL_LINKS.map((link) => ({
      id: link.id,
      label: dict.navigation[link.id],
      href: localizedHref(lang, link.path),
    })),
  ];
  if (options.insights) {
    const at = menus.findIndex((menu) => menu.id === INSIGHTS_LINK.after) + 1;
    menus.splice(at, 0, {
      id: INSIGHTS_LINK.id,
      label: INSIGHTS_LINK.label,
      href: localizedHref(lang, INSIGHTS_LINK.path),
    });
  }
  return menus;
}

function stripLocale(pathname: string, lang: Locale): string {
  const prefix = `/${lang}`;
  if (pathname === prefix) return "/";
  return pathname.startsWith(`${prefix}/`) ? pathname.slice(prefix.length) : pathname;
}

function trimTrailingSlash(path: string): string {
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}

/** The section the current page belongs to, or null (home, legal pages). */
export function currentSection(pathname: string, lang: Locale): NavSectionId | null {
  const path = trimTrailingSlash(stripLocale(pathname, lang));
  const within = (base: string) => path === base || path.startsWith(`${base}/`);
  if (within("/rankings") || within("/trending")) return "rankings";
  // #198: matches only a link that is rendered; with the flag off no menu has this id.
  if (within(INSIGHTS_LINK.path)) return INSIGHTS_LINK.id;
  for (const link of TOP_LEVEL_LINKS) {
    if (within(link.path)) return link.id;
  }
  return null;
}

/** True when `href` is the page at `pathname` (path only; the query is ignored). */
export function isCurrentPath(pathname: string, href: string): boolean {
  const path = href.split("?")[0] ?? href;
  return trimTrailingSlash(pathname) === trimTrailingSlash(path);
}
