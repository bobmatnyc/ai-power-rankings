import { isValidElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * #368: the news article page reads the database, not its own `/api/news/<slug>`.
 *
 * Why: the page fetched the API over HTTP twice per render (metadata and
 *   body), two extra function invocations, and the self-fetch kept it dynamic.
 *   As ISR, a database error must fail the render (the last good page stays
 *   cached), never become a cached 404.
 * What: runs the real `NewsRepository` over a fake Drizzle client (only the tool
 *   catalogue is stubbed). The page hands the detail component the same
 *   `article` and `tool` that `GET /api/news/[slug]` returns, with no `fetch`.
 *   No row is a 404 on the page and the API. A rejecting query rejects the page
 *   with that error and gives the API a 500, not a 404.
 * Test: `npx vitest run tests/unit/news-article-page-368.test.ts`. No network.
 */

const NOT_FOUND = new Error("NEXT_NOT_FOUND");
// The fake client: `select().from().where().limit()` resolves `rows`, or rejects with `failure`.
const { db, findNewsCatalogueRows } = vi.hoisted(() => ({
  db: { rows: [] as unknown[], failure: null as Error | null, queries: 0 },
  findNewsCatalogueRows: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw NOT_FOUND;
  },
}));
vi.mock("@/components/news/news-detail-content", () => ({ default: () => null }));
vi.mock("../../lib/db/connection", () => ({
  getDb: () => {
    const chain = {
      from: () => chain,
      where: () => chain,
      limit: async () => {
        db.queries += 1;
        if (db.failure) throw db.failure;
        return db.rows;
      },
    };
    return { select: () => chain };
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

/** An `articles` row as Drizzle returns it. */
const ROW = {
  id: "a1",
  slug: "cursor-launch",
  title: "Cursor ships a launch",
  summary: null,
  content: "Body text about Cursor.",
  sourceName: null,
  sourceUrl: null,
  publishedDate: new Date("2026-09-01T00:00:00.000Z"),
  createdAt: new Date("2026-08-31T00:00:00.000Z"),
  toolMentions: ["t-cursor"],
  importanceScore: 5,
  tags: ["launch"],
  category: null,
  status: "active",
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

async function apiGet(slug: string): Promise<Response> {
  const route = await import("../../app/api/news/[slug]/route");
  return route.GET({} as never, { params: Promise.resolve({ slug }) });
}

beforeEach(() => {
  Object.assign(db, { rows: [], failure: null, queries: 0 });
  findNewsCatalogueRows.mockReset().mockResolvedValue(CATALOGUE);
  fetchSpy.mockClear();
  vi.stubGlobal("fetch", fetchSpy);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("news article page data (#368)", () => {
  it("renders the article and tool the API returns, with no fetch", async () => {
    db.rows = [ROW];
    const page = await import("../../app/[lang]/news/[slug]/page");
    const props = detailProps(await page.default(params("cursor-launch")));
    const res = await apiGet("cursor-launch");
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(props?.["article"]).toEqual(body.article);
    expect(props?.["tool"]).toEqual(body.tool);
    expect(body.tool).toMatchObject({ slug: "cursor", name: "Cursor" });
    expect(body.article.summary).toBeNull(); // the API's JSON keeps the null, as before
    expect(body.article.published_date).toBe("2026-09-01T00:00:00.000Z");
    expect(db.queries).toBeGreaterThan(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("is a 404 for a slug with no row, on the page and on the API", async () => {
    const page = await import("../../app/[lang]/news/[slug]/page");
    await expect(page.default(params("no-such-article"))).rejects.toBe(NOT_FOUND);
    expect((await apiGet("no-such-article")).status).toBe(404);
  });

  // #368 fix round: getBySlug used to swallow the error and return null, a cached 404.
  it("rejects the page with the query error, not a 404, when the database read fails", async () => {
    const failure = new Error("connection refused");
    db.failure = failure;
    const page = await import("../../app/[lang]/news/[slug]/page");
    await expect(page.default(params("cursor-launch"))).rejects.toBe(failure);
  });

  it("answers the API's existing 500, not a 404, when the database read fails", async () => {
    db.failure = new Error("connection refused");
    const res = await apiGet("cursor-launch");
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: "Internal server error" });
  });

  it("is ISR with the 60-second window and on-demand slugs", async () => {
    const page = await import("../../app/[lang]/news/[slug]/page");
    expect(page.revalidate).toBe(60);
    expect(page.generateStaticParams()).toEqual([]);
    expect("dynamic" in page).toBe(false);
    expect("dynamicParams" in page).toBe(false); // default true: unbuilt slugs render on demand
  });
});
