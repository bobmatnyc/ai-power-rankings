import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * #233: search terms stay out of page URLs, so GA4 never sees them.
 *
 * Why: a term in the URL reaches GA4 as `page_location` and, for GA4's
 *   site-search keys, as `view_search_results.search_term`.
 * What: drives the real middleware handler (Clerk's wrapper replaced by an
 *   identity function) and checks the 308 strip, then checks that no JSON-LD
 *   builder or source file under app/ and lib/ still declares a search action.
 * Test: `npx vitest run tests/unit/search-term-redaction-233.test.ts`.
 */

vi.mock("@clerk/nextjs/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@clerk/nextjs/server")>();
  return { ...actual, clerkMiddleware: (handler: unknown) => handler };
});

type Handler = (
  auth: () => Promise<{ userId: string | null; sessionId: string | null }>,
  req: NextRequest
) => Promise<Response>;

const anonymousAuth = vi.fn(async () => ({ userId: null, sessionId: null }));

async function run(path: string, method = "GET"): Promise<Response> {
  const { default: middleware } = await import("../../middleware");
  return (middleware as unknown as Handler)(
    anonymousAuth,
    new NextRequest(`http://localhost${path}`, { method })
  );
}

function location(res: Response): string | null {
  const value = res.headers.get("location");
  return value ? value.replace(/^http:\/\/localhost/, "") : null;
}

beforeEach(() => {
  anonymousAuth.mockClear();
  vi.stubEnv("NEXT_PUBLIC_DISABLE_AUTH", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("middleware strips search-term keys from page URLs", () => {
  it.each(["term", "search", "q", "s", "query", "keyword"])(
    "answers ?%s= with a 308 to the URL without it",
    async (key) => {
      const res = await run(`/en/rankings?${key}=sentinel`);
      expect(res.status).toBe(308);
      expect(location(res)).toBe("/en/rankings");
      expect(anonymousAuth).not.toHaveBeenCalled();
    }
  );

  it("keeps the other params in order and drops repeated and upper-case keys", async () => {
    const res = await run("/en/rankings?sort=score&Term=a&category=code-editor&term=b&tags=x%2Cy&Q=c");
    expect(res.status).toBe(308);
    expect(location(res)).toBe("/en/rankings?sort=score&category=code-editor&tags=x%2Cy");
  });

  it("strips the key on the home page and on /tools", async () => {
    expect(location(await run("/?term=sentinel"))).toBe("/");
    expect(location(await run("/en/tools?search=sentinel&sort=name"))).toBe("/en/tools?sort=name");
  });

  it("answers HEAD with the same 308", async () => {
    const res = await run("/en/rankings?search=sentinel&sort=score", "HEAD");
    expect(res.status).toBe(308);
    expect(location(res)).toBe("/en/rankings?sort=score");
  });

  it("strips the key while auth is disabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_DISABLE_AUTH", "true");
    const res = await run("/en/rankings?term=sentinel");
    expect(res.status).toBe(308);
    expect(location(res)).toBe("/en/rankings");
  });

  it.each([
    ["/api/companies?search=acme", "GET"],
    ["/API/companies?search=acme", "GET"],
    ["/_next/data/build/en.json?q=x", "GET"],
    ["/en/rankings?term=sentinel", "POST"],
    ["/en/rankings?sort=score&terms=x", "GET"],
  ])("does not redirect %s (%s)", async (path, method) => {
    const res = await run(path, method);
    expect(res.status).not.toBe(308);
    expect(res.headers.get("location")).toBeNull();
  });
});

describe("no schema.org search action", () => {
  it("the JSON-LD builders declare no potentialAction", async () => {
    const { generateWebsiteSchema } = await import("../../lib/schema");
    const { createWebsiteSchema } = await import("../../lib/seo/schema");
    for (const block of [generateWebsiteSchema("https://example.test"), createWebsiteSchema()]) {
      expect(JSON.stringify(block)).not.toMatch(/SearchAction|urlTemplate|search_term_string/);
    }
  });

  it("no source file under app/ or lib/ names a SearchAction", () => {
    const root = join(__dirname, "../..");
    const hits: string[] = [];
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.(ts|tsx)$/.test(name) && readFileSync(path, "utf8").includes("SearchAction")) {
          hits.push(path.slice(root.length + 1));
        }
      }
    };
    walk(join(root, "app"));
    walk(join(root, "lib"));
    expect(hits).toEqual([]);
  });
});
