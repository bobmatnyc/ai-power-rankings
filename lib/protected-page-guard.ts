import { redirect } from "next/navigation";
import { i18n, locales } from "@/i18n/config";
import { requireAuth } from "@/lib/api-auth";

/**
 * Server-side sign-in check for the admin and dashboard page trees.
 *
 * Why: `middleware.ts` was the only gate for these pages; the route-group
 * layout is a client component. A request the middleware does not process
 * reached the page unchecked.
 * What: The tree layouts call `requireSignedInPage()`, which checks the
 * session through `requireAuth()` (Clerk `auth()`). Any refusal, including an
 * `auth()` failure when the middleware did not run, redirects to the locale's
 * sign-in page. Local development with auth bypassed passes, as it does for
 * `requireAuth()`.
 * Test: `tests/unit/protected-page-guard.test.ts`.
 */

export type ProtectedTree = "admin" | "dashboard";

/**
 * Sign-in URL for a tree. The locale falls back to the default when `lang` is
 * not a configured locale, and `redirect_url` is always the tree root, so it
 * stays a same-origin path built from known values.
 */
export function signInRedirectPath(lang: string, tree: ProtectedTree): string {
  const locale = (locales as readonly string[]).includes(lang) ? lang : i18n.defaultLocale;
  const query = new URLSearchParams({ redirect_url: `/${locale}/${tree}` });
  return `/${locale}/sign-in?${query.toString()}`;
}

/** Redirects to sign-in unless the request has a signed-in session. */
export async function requireSignedInPage(lang: string, tree: ProtectedTree): Promise<void> {
  const result = await requireAuth();
  if (result.error) redirect(signInRedirectPath(lang, tree));
}
