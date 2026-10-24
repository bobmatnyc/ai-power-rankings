import type { ReactElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * #193 slice 1: an unknown tool slug answers 404 with a useful not-found page.
 *
 * Why: `/en/tools/<unknown>` rendered the tool page with a client-side "not
 * found" text and answered 200, so search engines indexed dead tool URLs.
 * What: Runs the real tool page, metadata, `[slug]` layout and not-found
 * boundary with `ToolsRepository` replaced by an in-memory catalogue. Next.js
 * answers HTTP 404 for exactly the error `notFound()` throws (digest
 * `NEXT_HTTP_ERROR_FALLBACK;404`), so a rejection with that digest is the
 * 404; any other rejection is a 5xx through the error boundary. Covers: the
 * 404 in several locales, unchanged rendering for an active and a
 * pending_review tool, a lookup failure that is neither 404 nor 200, the
 * boundary's search box, nearest matches and rankings link, and
 * `nearestTools()` ordering, cap and status filter.
 * React `cache()` memoises only under the react-server condition Next.js
 * sets, so it is replaced with a memo whose scope `beforeEach` resets: one
 * test is one request.
 * Test: `npx vitest run tests/unit/tool-not-found-193.test.tsx`. No database,
 * no network.
 */

const ORIGIN = "https://aipowerranking.com";
const NOT_FOUND = { digest: "NEXT_HTTP_ERROR_FALLBACK;404" };

interface Row {
  id: string;
  slug: string;
  name: string;
  category: string;
  status: string;
  info: Record<string, unknown>;
  json_info?: Record<string, unknown>;
  tags: string[];
  created_at: string;
  updated_at: string;
}

function row(slug: string, name: string, status = "active"): Row {
  return {
    id: `tool-${slug}`,
    slug,
    name,
    category: "code-editor",
    status,
    info: { product: { description: `${name} description` } },
    json_info: { links: { website: "https://example-tool.dev" } },
    tags: [],
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-02T00:00:00.000Z",
  };
}

const CATALOGUE: Row[] = [
  row("cursor", "Cursor"),
  row("claude-code", "Claude Code"),
  row("github-copilot", "GitHub Copilot"),
  row("windsurf", "Windsurf"),
  row("cline", "Cline"),
  row("stealth-editor", "Stealth Editor", "pending_review"),
  row("cursory", "Cursory", "inactive"),
];

const db = vi.hoisted(() => ({
  rows: [] as Array<{ slug: string; status: string }>,
  lookupError: null as Error | null,
  catalogueError: null as Error | null,
  statusQueries: 0,
}));

// `server-only` throws outside the react-server condition; the page is a Server Component.
vi.mock("server-only", () => ({}));

vi.mock("../../lib/db/repositories/tools.repository", () => {
  class ToolsRepository {
    findBySlug = async (slug: string) => {
      if (db.lookupError) throw db.lookupError;
      return db.rows.find((r) => r.slug === slug) ?? null;
    };
    findByStatus = async (status: string) => {
      db.statusQueries++;
      if (db.catalogueError) throw db.catalogueError;
      return db.rows.filter((r) => r.status === status);
    };
  }
  return { ToolsRepository, toolsRepository: new ToolsRepository() };
});

// One test is one server request: `cache()` memoises until the next `beforeEach`.
const request = vi.hoisted(() => ({ memo: new Map<unknown, Map<string, unknown>>() }));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  const cache =
    <A extends unknown[], R>(fn: (...args: A) => R) =>
    (...args: A): R => {
      const calls = request.memo.get(fn) ?? new Map<string, unknown>();
      request.memo.set(fn, calls);
      const key = JSON.stringify(args);
      if (!calls.has(key)) calls.set(key, fn(...args));
      return calls.get(key) as R;
    };
  return { ...actual, cache };
});

vi.setConfig({ testTimeout: 60_000 });

beforeEach(() => {
  db.rows = CATALOGUE;
  db.lookupError = null;
  db.catalogueError = null;
  db.statusQueries = 0;
  request.memo = new Map();
  vi.stubEnv("NEXT_PUBLIC_BASE_URL", undefined);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

type Params = { lang: string; slug: string };
const params = (lang: string, slug: string) => ({ params: Promise.resolve({ lang, slug } as Params) as never });

async function page() {
  return (await import("../../app/[lang]/tools/[slug]/page")) as unknown as {
    default: (p: { params: Promise<Params> }) => Promise<ReactElement>;
    generateMetadata: (p: { params: Promise<Params> }) => Promise<Record<string, unknown>>;
  };
}

/** Renders the not-found boundary as Next.js does: the `[slug]` layout first, then the boundary. */
async function renderBoundary(lang: string, slug: string): Promise<string> {
  const { default: Layout } = await import("../../app/[lang]/tools/[slug]/layout");
  const { default: ToolNotFound } = await import("../../app/[lang]/tools/[slug]/not-found");
  await Layout({ children: null as ReactNode, params: Promise.resolve({ lang, slug }) });
  return renderToStaticMarkup(await ToolNotFound());
}

const toolLinks = (html: string) => [...html.matchAll(/href="(\/[a-z]{2}\/tools\/[^"]+)"/g)].map((m) => m[1]);

describe("tool page answers 404 only for a slug not in the catalogue (#193)", () => {
  it.each(["en", "de", "ja"])("/%s/tools/<unknown> throws Next.js's 404", async (lang) => {
    const { default: Page } = await page();
    await expect(Page(params(lang, "no-such-tool-xyz"))).rejects.toMatchObject(NOT_FOUND);
  });

  it("an active tool renders with JSON-LD, a self canonical and index,follow", async () => {
    const { default: Page, generateMetadata } = await page();
    const html = renderToStaticMarkup(await Page(params("en", "cursor")));
    expect(html).toContain('type="application/ld+json"');
    expect(html).toMatch(/"name":\s*"Cursor"/);

    const metadata = (await generateMetadata(params("en", "cursor"))) as {
      alternates?: { canonical?: string };
      robots?: { index?: boolean; follow?: boolean };
    };
    expect(metadata.alternates?.canonical).toBe(`${ORIGIN}/en/tools/cursor`);
    expect(metadata.robots).toMatchObject({ index: true, follow: true });
  });

  // A catalogue row in any status keeps today's page: the guard keys on "no row", never on status.
  it.each([
    ["stealth-editor", "Stealth Editor"],
    ["cursory", "Cursory"],
  ])("a non-active tool (%s) renders as before, not 404", async (slug, name) => {
    const { default: Page, generateMetadata } = await page();
    const html = renderToStaticMarkup(await Page(params("en", slug)));
    expect(html).toContain(`"name": "${name}"`);
    const metadata = (await generateMetadata(params("en", slug))) as {
      title?: unknown;
      alternates?: { canonical?: string };
    };
    expect(JSON.stringify(metadata.title)).toContain(name);
    expect(metadata.alternates?.canonical).toBe(`${ORIGIN}/en/tools/${slug}`);
  });

  it("a failed lookup rejects with the database error: a 5xx, neither 404 nor 200", async () => {
    db.lookupError = new Error("fixture: connection refused");
    const { default: Page } = await page();
    const result = Page(params("en", "cursor"));
    await expect(result).rejects.toThrow("fixture: connection refused");
    const error = await result.catch((e: unknown) => e);
    expect((error as { digest?: string }).digest).toBeUndefined();
  });

  it("the metadata for an unknown slug is noindex", async () => {
    const { generateMetadata } = await page();
    const metadata = (await generateMetadata(params("en", "no-such-tool-xyz"))) as {
      robots?: { index?: boolean };
    };
    expect(metadata.robots?.index).toBe(false);
  });
});

describe("tool not-found boundary (#193)", () => {
  it("offers a search box, nearest tools and the rankings for a near miss", async () => {
    const html = await renderBoundary("en", "cursr");
    const links = toolLinks(html);
    expect(links).toContain("/en/tools/cursor");
    expect(links.length).toBeLessThanOrEqual(5);
    expect(links).not.toContain("/en/tools/cursory"); // inactive
    expect(html).toContain('href="/en/rankings"');
    // #233: client state only: a search input with no name and no form to submit it.
    expect(html).toMatch(/<input[^>]*type="search"/);
    expect(html).not.toMatch(/<input[^>]*\bname=/);
    expect(html).not.toContain("<form");
  });

  it("links in the request's locale", async () => {
    const html = await renderBoundary("de", "cursr");
    expect(toolLinks(html)).toContain("/de/tools/cursor");
    expect(html).toContain('href="/de/rankings"');
  });

  it("a nonsense slug renders the search and rankings link with no matches", async () => {
    const html = await renderBoundary("en", "zzqx-0000-qqqq");
    expect(toolLinks(html)).toEqual([]);
    expect(html).toMatch(/<input[^>]*type="search"/);
    expect(html).toContain('href="/en/rankings"');
  });

  it("a known slug reads no catalogue: Next.js renders the boundary with every tool page", async () => {
    const html = await renderBoundary("en", "cursor");
    expect(db.statusQueries).toBe(0);
    expect(toolLinks(html)).toEqual([]);
  });

  it.each([
    ["the lookup", () => (db.lookupError = new Error("fixture: lookup down"))],
    ["the catalogue read", () => (db.catalogueError = new Error("fixture: catalogue down"))],
  ])("renders without suggestions when %s fails", async (_, fail) => {
    fail();
    const html = await renderBoundary("en", "cursr");
    expect(toolLinks(html)).toEqual([]);
    expect(html).toContain('href="/en/rankings"');
  });
});

describe("nearestTools (#193)", () => {
  const tools = (names: string[], status = "active") =>
    names.map((name) => ({ slug: name.toLowerCase().replace(/\s+/g, "-"), name, status }));

  it("orders by closeness, then slug", async () => {
    const { nearestTools } = await import("../../lib/tools/nearest-tools");
    const catalogue = tools(["Cursor", "Cursor Pro", "Curso", "Cline"]);
    expect(nearestTools("cursr", catalogue).map((t) => t.slug)).toEqual(["cursor", "curso"]);
    expect(nearestTools("cursor", catalogue).map((t) => t.slug)).toEqual(["cursor", "curso", "cursor-pro"]);
  });

  it("returns at most five", async () => {
    const { MAX_TOOL_SUGGESTIONS, nearestTools } = await import("../../lib/tools/nearest-tools");
    const catalogue = tools(["Codex", "Codey", "Coder", "Codea", "Codeb", "Codec", "Coded"]);
    expect(MAX_TOOL_SUGGESTIONS).toBe(5);
    expect(nearestTools("code", catalogue)).toHaveLength(5);
  });

  it("suggests active tools only", async () => {
    const { nearestTools } = await import("../../lib/tools/nearest-tools");
    const catalogue = [...tools(["Cursr"], "pending_review"), ...tools(["Cursrr"], "inactive"), ...tools(["Cursor"])];
    expect(nearestTools("cursr", catalogue).map((t) => t.slug)).toEqual(["cursor"]);
  });

  it("matches a name that contains the slug, and nothing for nonsense or an empty slug", async () => {
    const { nearestTools } = await import("../../lib/tools/nearest-tools");
    const catalogue = tools(["Claude Code", "GitHub Copilot", "Windsurf"]);
    expect(nearestTools("claude", catalogue).map((t) => t.slug)).toEqual(["claude-code"]);
    expect(nearestTools("copilot", catalogue).map((t) => t.slug)).toEqual(["github-copilot"]);
    expect(nearestTools("zzqx-0000-qqqq", catalogue)).toEqual([]);
    expect(nearestTools("---", catalogue)).toEqual([]);
  });
});
