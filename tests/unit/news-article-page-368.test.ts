import { isValidElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * #368: the news article page reads the database, not its own `/api/news/<slug>`.
 *
 * Why: the page fetched the API over HTTP twice per render (metadata and
 *   body), two extra function invocations, and the self-fetch kept it dynamic.
 * What: over a stubbed `NewsRepository` and tool catalogue, the page hands the
 *   detail component the same `article` and `tool` that `GET /api/news/[slug]`
 *   returns, with no `fetch`. An unknown slug is a 404 on the page and the API;
 *   a failed read rejects the page with that error (not a 404), so ISR keeps
 *   the cached article.
 * Test: `npx vitest run tests/unit/news-article-page-368.test.ts`. No network.
 */

const NOT_FOUND = new Error("NEXT_NOT_FOUND");
const { getBySlug, findNewsCatalogueRows } = vi.hoisted(() => ({
  getBySlug: vi.fn(),
  findNewsCatalogueRows: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw NOT_FOUND;
  },
}));
vi.mock("@/components/news/news-detail-content", () => ({ default: () => null }));
vi.mock("../../lib/db/connection", () => ({ getDb: () => ({}) }));
vi.mock("../../lib/db/repositories/news", () => ({
  NewsRepository: class {
    getBySlug = getBySlug;
  },
}));
vi.mock("../../lib/db/repositories/tools.repository", () => ({
  ToolsRepository: class {
    findNewsCatalogueRows = findNewsCatalogueRows;
  },
}));

const CATALOGUE = [
  { id: "t-cursor", slug: "cursor", name: "Cursor", kind: "harness", status: "active", description: "d", category: "code-editor", info: { website: "https://cursor.example" } },
];

const ROW = {
  id: "a1",
  slug: "cursor-launch",
  title: "Cursor ships a launch",
  summary: null,
  content: "Body text about Cursor.",
  source: null,
  sourceUrl: null,
  publishedAt: new Date("2026-09-01T00:00:00.000Z"),
  toolMentions: ["t-cursor"],
  importanceScore: 5,
  tags: ["launch"],
  category: null,
  eventType: "update",
};

const fetchSpy = vi.fn(async () => {
  throw new Error("the article page must not fetch");
});
const params = (slug: string) => ({ params: Promise.resolve({ lang: "en", slug }) });

/** The props of the first element in a server tree that carries `article`. */
function detailProps(node: ReactNode): Record<string, unknown> | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = detailProps(child);
      if (found) return found;
    }
    return undefined;
  }
  if (!isValidElement(node)) return undefined;
  const props = node.props as Record<string, unknown>;
  if ("article" in props) return props;
  return detailProps(props["children"] as ReactNode);
}

beforeEach(() => {
  getBySlug.mockReset();
  findNewsCatalogueRows.mockReset().mockResolvedValue(CATALOGUE);
  fetchSpy.mockClear();
  vi.stubGlobal("fetch", fetchSpy);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("news article page data (#368)", () => {
  it("renders the article and tool the API returns, with no fetch", async () => {
    getBySlug.mockResolvedValue(ROW);
    const page = await import("../../app/[lang]/news/[slug]/page");
    const route = await import("../../app/api/news/[slug]/route");

    const props = detailProps(await page.default(params("cursor-launch")));
    const res = await route.GET({ nextUrl: new URL("https://x.test/api/news/cursor-launch") } as never, {
      params: Promise.resolve({ slug: "cursor-launch" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(props?.["article"]).toEqual(body.article);
    expect(props?.["tool"]).toEqual(body.tool);
    expect(body.tool).toMatchObject({ slug: "cursor", name: "Cursor" });
    expect(body.article.summary).toBeNull(); // the API's JSON keeps the null, as before
    expect(getBySlug).toHaveBeenCalledWith("cursor-launch");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("is a 404 for an unknown slug on the page, and on the API", async () => {
    getBySlug.mockResolvedValue(null);
    const page = await import("../../app/[lang]/news/[slug]/page");
    await expect(page.default(params("no-such-article"))).rejects.toBe(NOT_FOUND);
    const route = await import("../../app/api/news/[slug]/route");
    const res = await route.GET({} as never, { params: Promise.resolve({ slug: "no-such-article" }) });
    expect(res.status).toBe(404);
  });

  it("rejects with the read error, not a 404, when the database read fails", async () => {
    const failure = new Error("connection refused");
    getBySlug.mockRejectedValue(failure);
    const page = await import("../../app/[lang]/news/[slug]/page");
    await expect(page.default(params("cursor-launch"))).rejects.toBe(failure);
  });

  it("is ISR with the 60-second window and on-demand slugs", async () => {
    const page = await import("../../app/[lang]/news/[slug]/page");
    expect(page.revalidate).toBe(60);
    expect(page.generateStaticParams()).toEqual([]);
    expect("dynamic" in page).toBe(false);
    expect("dynamicParams" in page).toBe(false); // default true: unbuilt slugs render on demand
  });
});
