import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isLocale } from "@/i18n/config";
import { harnessCategory } from "@/lib/rankings/harness-category";
import { LIST_SLUGS } from "@/lib/rankings/lists";

/** #196: the route segment under `/rankings/coding-harnesses` that serves a `?category=` board. */
export const CATEGORY_SEGMENT = "category";

/**
 * #196: serves `/<locale>/rankings/coding-harnesses?category=<known>` from the static category route.
 *
 * Why: the page reads no `searchParams`, so the board stays ISR (#368); the filter is
 *   chosen by path, with the public URL kept as `?category=`, as #195 does for `?open=1`.
 * What: for GET and HEAD on a locale's harness board with a known `category`
 *   (`harnessCategory`), a rewrite to `/<locale>/rankings/coding-harnesses/category/<value>`
 *   (the query is kept). A request for an internal category path answers a 308 to the
 *   `?category=` URL, so one public URL serves each view. Null for anything else: no,
 *   empty or unknown `category` (the unfiltered board), another list, or a non-locale segment.
 * Test: `tests/unit/rankings-category-196.test.ts`.
 */
export function harnessCategoryRewrite(req: NextRequest): NextResponse | null {
  if (req.method !== "GET" && req.method !== "HEAD") return null;
  const { pathname, searchParams } = req.nextUrl;
  const locale = pathname.split("/")[1];
  if (!locale || !isLocale(locale)) return null;
  const boardPath = `/${locale}/rankings/${LIST_SLUGS.harness}`;
  const viewPrefix = `${boardPath}/${CATEGORY_SEGMENT}/`;

  if (pathname.startsWith(viewPrefix)) {
    const target = req.nextUrl.clone();
    target.pathname = boardPath;
    target.searchParams.set("category", pathname.slice(viewPrefix.length));
    return NextResponse.redirect(target, 308);
  }
  const category = harnessCategory(searchParams.get("category"));
  if (pathname !== boardPath || !category) return null;
  const target = req.nextUrl.clone();
  target.pathname = `${viewPrefix}${category}`;
  return NextResponse.rewrite(target);
}
