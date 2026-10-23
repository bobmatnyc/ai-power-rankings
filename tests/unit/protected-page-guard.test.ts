import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";

/**
 * Server-side sign-in check in the admin and dashboard tree layouts.
 *
 * Why: The middleware was the only gate for these pages. The tree layouts
 * now check the session themselves, so a request the middleware did not
 * process still gets a sign-in redirect.
 * What: Renders each layout with Clerk `auth()` mocked as signed out, as
 * throwing (the error Clerk raises when the middleware did not run), and as
 * signed in. Asserts the sign-in redirect, its locale and a same-origin
 * `redirect_url`.
 * Test: `npx vitest run tests/unit/protected-page-guard.test.ts`.
 */

const clerk = vi.hoisted(() => ({ auth: vi.fn(), currentUser: vi.fn() }));
const redirect = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  })
);

vi.mock("@clerk/nextjs/server", () => clerk);
vi.mock("next/navigation", () => ({ redirect }));

import AdminTreeLayout from "../../app/[lang]/(authenticated)/admin/layout";
import DashboardTreeLayout from "../../app/[lang]/(authenticated)/dashboard/layout";

type Layout = (props: { children: string; params: Promise<{ lang: string }> }) => Promise<ReactElement>;

const LAYOUTS: Array<[string, Layout]> = [
  ["admin", AdminTreeLayout as unknown as Layout],
  ["dashboard", DashboardTreeLayout as unknown as Layout],
];

function render(layout: Layout, lang: string) {
  return layout({ children: "page", params: Promise.resolve({ lang }) });
}

beforeEach(() => {
  clerk.auth.mockReset();
  redirect.mockClear();
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("VERCEL_ENV", "");
  vi.stubEnv("NEXT_PUBLIC_DISABLE_AUTH", "");
  vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_x");
  vi.stubEnv("CLERK_SECRET_KEY", "sk_test_x");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("admin and dashboard tree layouts", () => {
  it.each(LAYOUTS)("%s redirects a signed-out request to sign-in", async (tree, layout) => {
    clerk.auth.mockResolvedValue({ userId: null });
    await expect(render(layout, "de")).rejects.toThrow(
      `REDIRECT:/de/sign-in?redirect_url=%2Fde%2F${tree}`
    );
    expect(clerk.auth).toHaveBeenCalledTimes(1);
  });

  it.each(LAYOUTS)("%s redirects to sign-in when auth() fails", async (tree, layout) => {
    clerk.auth.mockRejectedValue(new Error("auth() was called but clerkMiddleware() was not detected"));
    await expect(render(layout, "en")).rejects.toThrow(
      `REDIRECT:/en/sign-in?redirect_url=%2Fen%2F${tree}`
    );
  });

  it.each(LAYOUTS)("%s uses the default locale for an unknown lang segment", async (tree, layout) => {
    clerk.auth.mockResolvedValue({ userId: null });
    await expect(render(layout, "x.png")).rejects.toThrow(
      `REDIRECT:/en/sign-in?redirect_url=%2Fen%2F${tree}`
    );
  });

  it.each(LAYOUTS)("%s renders its page for a signed-in request", async (_tree, layout) => {
    clerk.auth.mockResolvedValue({ userId: "user_1" });
    const element = await render(layout, "en");
    expect(redirect).not.toHaveBeenCalled();
    expect((element.props as { children: string }).children).toBe("page");
  });
});
