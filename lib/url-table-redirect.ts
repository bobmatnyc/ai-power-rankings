import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { routeAccess } from "@/lib/route-access";
import { resolveTableRedirect } from "@/lib/seo/url-table";

/**
 * Answers a page request for a #191 table source with one 308 to its destination.
 *
 * Why: #191 — the signed URL table moves pages permanently; each source must
 *   reach its destination in one hop, ahead of the #233 search-key strip.
 * What: For GET and HEAD, returns a 308 to `resolveTableRedirect(pathname)`
 *   with the destination's own query only. The source's query is dropped, so a
 *   search key in it never costs a second (#233) hop. A protected path (raw or
 *   once-decoded, #228) is never redirected; it keeps its sign-in or 401 answer.
 *   Returns null otherwise.
 * Test: `tests/unit/url-table-191.test.ts` ("middleware").
 */
export function urlTableRedirect(req: NextRequest): NextResponse | null {
  if (req.method !== "GET" && req.method !== "HEAD") return null;
  const destination = resolveTableRedirect(req.nextUrl.pathname);
  if (!destination || routeAccess(req) === "protected") return null;
  return NextResponse.redirect(new URL(destination, req.url), 308);
}
