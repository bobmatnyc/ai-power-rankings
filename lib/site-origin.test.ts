import { afterEach, describe, expect, it, vi } from "vitest";
import { siteOrigin } from "./site-origin";

/**
 * #150: the canonical origin never comes from the per-deployment Vercel host.
 * Test: `npx vitest run lib/site-origin.test.ts`.
 */
describe("siteOrigin (#150)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("falls back to https://aipowerranking.com when NEXT_PUBLIC_BASE_URL is unset, ignoring VERCEL_URL", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", undefined);
    vi.stubEnv("VERCEL_URL", "foo.vercel.app");

    expect(siteOrigin()).toBe("https://aipowerranking.com");
  });

  it("uses NEXT_PUBLIC_BASE_URL when set, without a trailing slash", () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://staging.example.com/");
    vi.stubEnv("VERCEL_URL", "foo.vercel.app");

    expect(siteOrigin()).toBe("https://staging.example.com");
  });
});
