import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isLocale } from "@/i18n/config";
import { rankingListPath } from "@/lib/rankings/lists";

/** #195: the route segment under `/rankings/models` that serves the `?open=1` board. */
export const OPEN_WEIGHT_SEGMENT = "open-weight";

/**
 * #195: serves `/<locale>/rankings/models?open=1` from the static open-weight route.
 *
 * Why: the page reads no `searchParams`, so `/rankings/models` stays ISR (#368); the
 *   filter is chosen by path instead, with the public URL kept as `?open=1`.
 * What: for GET and HEAD on a locale's models page with `open=1` exactly, a rewrite to
 *   `/<locale>/rankings/models/open-weight` (the query is kept, so sort and filter links
 *   keep `open=1`). A request for that internal path answers a 308 to the `?open=1` URL,
 *   so only one public URL serves the view. Null for anything else: no `open`, any other
 *   value, another list, or a segment that is not a locale.
 * Test: `tests/unit/rankings-open-weight-195.test.ts`.
 */
export function openWeightRewrite(req: NextRequest): NextResponse | null {
  if (req.method !== "GET" && req.method !== "HEAD") return null;
  const { pathname, searchParams } = req.nextUrl;
  const locale = pathname.split("/")[1];
  if (!locale || !isLocale(locale)) return null;
  const boardPath = `/${locale}${rankingListPath("model")}`;
  const viewPath = `${boardPath}/${OPEN_WEIGHT_SEGMENT}`;

  if (pathname === viewPath) {
    const target = req.nextUrl.clone();
    target.pathname = boardPath;
    target.searchParams.set("open", "1");
    return NextResponse.redirect(target, 308);
  }
  if (pathname !== boardPath || searchParams.get("open") !== "1") return null;
  const target = req.nextUrl.clone();
  target.pathname = viewPath;
  return NextResponse.rewrite(target);
}
