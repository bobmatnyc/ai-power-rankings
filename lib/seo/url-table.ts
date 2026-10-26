/**
 * The signed #191 URL table: which old URLs 308 and which pages carry noindex.
 *
 * Why: #191 — the owner signed the URL table (ruling D89). Its `308` and
 * `noindex` rows live in `data/url-table-191.json` as path-only rows (source,
 * destination, action); `keep` and `new` rows need no code and are not listed.
 * What: `resolveTableRedirect` answers the one 308 target for a path, through
 * the literal rows or the Q-A85-1 pattern rule; `isTableRedirectSource` and
 * `isNoindexToolSlug` feed the sitemap and the tool-page robots tag. A row whose
 * destination page does not exist yet (`PENDING_TARGETS`) is held: its source
 * is served exactly as before until that page ships.
 * Test: `tests/unit/url-table-191.test.ts`.
 */
import rows from "@/data/url-table-191.json";
import { locales } from "@/i18n/config";

export type UrlTableAction = "308" | "noindex";

export interface UrlTableRow {
  source: string;
  destination: string;
  action: UrlTableAction;
}

/** Every 308 and noindex row of the signed table, in file order. */
export const URL_TABLE_ROWS: readonly UrlTableRow[] = rows as UrlTableRow[];

/**
 * Destination pages that do not exist on main yet. A 308 to a 404 would drop
 * the page from search, so a row whose destination path matches one of these is
 * held. Remove an entry in the change that ships its page.
 */
export const PENDING_TARGETS: readonly RegExp[] = [
  /^\/en\/rankings\/coding-harnesses$/, // #196: the harness ranking page and its category filter
  // #197: the model family pages shipped with D91 (migrations 0018, 0019); their 70 rows now 308. See #191
  /^\/en\/insights$/, // #198: the Insights hub (the 20 /whats-new rows)
];

const LOCALE_SET: ReadonlySet<string> = new Set(locales);

/**
 * First segments the Q-A85-1 rule never touches: routes and files outside
 * `app/[lang]` (`app/` and `public/` top level, Clerk's pages). A segment that
 * starts with `_` or `.`, or holds a dot or a percent escape, is skipped as well.
 */
export const RESERVED_FIRST_SEGMENTS: ReadonlySet<string> = new Set([
  "api",
  "trpc",
  "design",
  "sign-in",
  "sign-up",
  "data",
  "fonts",
  "logos",
  "old-favicons",
  "partytown",
  "tool-icons",
  "uploads",
]);

function pathOf(url: string): string {
  const q = url.indexOf("?");
  return q === -1 ? url : url.slice(0, q);
}

/** True when the destination page of a row does not exist yet. */
export function isPendingTarget(destination: string): boolean {
  const path = pathOf(destination);
  return PENDING_TARGETS.some((pattern) => pattern.test(path));
}

function isLocaleFirst(source: string): boolean {
  return LOCALE_SET.has(source.split("/")[1] ?? "");
}

const redirectRows = URL_TABLE_ROWS.filter((row) => row.action === "308");

/** Literal 308 rows (locale first segment) that ship: source path -> destination. */
const LITERAL_REDIRECTS: ReadonlyMap<string, string> = new Map(
  redirectRows
    .filter((row) => isLocaleFirst(row.source) && !isPendingTarget(row.destination))
    .map((row) => [row.source, row.destination])
);

/** Literal 308 sources held back because their destination is pending. */
const HELD_SOURCES: ReadonlySet<string> = new Set(
  redirectRows
    .filter((row) => isLocaleFirst(row.source) && isPendingTarget(row.destination))
    .map((row) => row.source)
);

/**
 * Tool slugs whose pages carry noindex in every locale (Q-A85-3 included).
 * #197: exported so tests read the one set instead of copying the slug list.
 */
export const NOINDEX_TOOL_SLUGS: ReadonlySet<string> = new Set(
  URL_TABLE_ROWS.filter((row) => row.action === "noindex").map(
    (row) => row.source.split("/")[3] ?? ""
  )
);

function trimTrailingSlash(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") || "/" : pathname;
}

/**
 * The one 308 destination for `pathname` under the signed table, or null.
 *
 * Why: #191 — every table source must reach its destination in a single hop.
 * What: a literal row answers its destination. Otherwise the Q-A85-1 rule: a
 * path of two or more segments whose first segment is not a locale (and not
 * reserved) goes to `/en/<rest>`, or straight on to that path's own table
 * destination, so no source needs two table hops (D31). A path that lands on a
 * held row answers null. The caller drops the query string: the table lists
 * each destination in full.
 * Test: `tests/unit/url-table-191.test.ts`.
 */
export function resolveTableRedirect(pathname: string): string | null {
  const path = trimTrailingSlash(pathname);
  const literal = LITERAL_REDIRECTS.get(path);
  if (literal) return literal;

  const segments = path.split("/").slice(1);
  const first = segments[0] ?? "";
  if (segments.length < 2 || LOCALE_SET.has(first)) return null;
  if (RESERVED_FIRST_SEGMENTS.has(first.toLowerCase()) || /^[._]|[.%]/.test(first)) return null;

  // #191 Q-A85-1: one pattern rule for every non-locale first segment.
  const english = `/en/${segments.slice(1).join("/")}`;
  if (HELD_SOURCES.has(english)) return null;
  return LITERAL_REDIRECTS.get(english) ?? english;
}

/** True when `path` 308s under a shipped literal row; such a URL leaves the sitemap. */
export function isTableRedirectSource(path: string): boolean {
  return LITERAL_REDIRECTS.has(trimTrailingSlash(path));
}

/** True when the table marks this tool's pages noindex. */
export function isNoindexToolSlug(slug: string): boolean {
  return NOINDEX_TOOL_SLUGS.has(slug);
}
