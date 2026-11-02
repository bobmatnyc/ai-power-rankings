import type { NextFetchEvent, NextRequest } from "next/server";

/**
 * Drives the real `middleware.ts` with a fake Clerk session lookup.
 *
 * Why: #368 — the default export is a plain middleware that calls Clerk's
 *   wrapper only for `needsClerk()` paths, so a test can no longer call the
 *   inner `(auth, req)` handler as the default export.
 * What: `fakeClerkMiddleware` stands in for `clerkMiddleware` (wire it through
 *   `vi.mock("@clerk/nextjs/server", ...)`); the wrapped handler reads the
 *   session from `clerkTestAuth.current`. `runMiddleware(auth, req)` sets that
 *   lookup and runs the real default export, so a path that skips Clerk never
 *   calls `auth`.
 */

export type FakeAuth = () => Promise<{ userId: string | null; sessionId: string | null }>;

type ClerkHandler = (auth: FakeAuth, req: NextRequest) => Promise<Response> | Response;

export const clerkTestAuth: { current: FakeAuth } = {
  current: async () => ({ userId: null, sessionId: null }),
};

/** Stand-in for Clerk's `clerkMiddleware(handler)`. */
export function fakeClerkMiddleware(handler: ClerkHandler) {
  return (req: NextRequest) => handler(() => clerkTestAuth.current(), req);
}

/** The real middleware's response for `req`, with `auth` as Clerk's session lookup. */
export async function runMiddleware(auth: FakeAuth, req: NextRequest): Promise<Response> {
  clerkTestAuth.current = auth;
  const { default: middleware } = await import("../../../middleware");
  return (await middleware(req, {} as NextFetchEvent)) as Response;
}
