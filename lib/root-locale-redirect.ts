import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { i18n } from "@/i18n/config";

/**
 * Redirects the bare domain `/` to the default locale home, from middleware.
 *
 * Why: #487 — `app/page.tsx` did this redirect in a `force-dynamic` page, so
 *   every bare-domain visit invoked a serverless function and answered
 *   `private, no-cache, no-store`. Its `headers()` call only forced dynamic
 *   rendering (4e3c127); the target never depended on the request.
 * What: For pathname `/` returns a 307 to `/<defaultLocale>` (`/en`) with no
 *   query string, as `redirect("/en")` in the page did. Any other path returns
 *   null, so the caller continues.
 * Test: `tests/unit/root-locale-redirect-487.test.ts`.
 */
export function rootLocaleRedirect(req: NextRequest): NextResponse | null {
  if (req.nextUrl.pathname !== "/") return null;
  const target = req.nextUrl.clone();
  target.pathname = `/${i18n.defaultLocale}`;
  // #487: the page's redirect("/en") dropped the query; keep that.
  target.search = "";
  // #487: temporary, as before, so no client pins the target.
  return NextResponse.redirect(target, 307);
}
