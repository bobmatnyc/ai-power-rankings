import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Route-level regression tests for #109 — news tool attribution in
 * `/api/news` and `/api/news/[slug]`.
 *
 * Why: the list route read `mention.tool` while stored mentions carry `name`
 * and `toolId`, so every item showed "Various Tools"; the detail route ignored
 * `toolId` and guessed a slug from the name, so a "Google Gemini Code Assist"
 * mention gave `tool: null`.
 * What: the news and tools repositories are replaced by fixtures. The cases pin
 * that both routes attribute through the catalogue, and that a failed tools
 * read leaves a 200 with no attribution and exactly one warning.
 * Modules are re-imported per test so the in-memory catalogue cache starts empty.
 * Test: `npx vitest run tests/unit/news-route-tools-109.test.ts`. No database
 * access, no network.
 */

const { getPaginatedFiltered, getBySlug, findAll, findBySlug } = vi.hoisted(() => ({
  getPaginatedFiltered: vi.fn(),
  getBySlug: vi.fn(),
  findAll: vi.fn(),
  findBySlug: vi.fn(),
}));

vi.mock("../../lib/db/connection", () => ({
  getDb: () => ({}),
}));

vi.mock("../../lib/db/repositories/news", () => ({
  NewsRepository: class {
    getPaginatedFiltered = getPaginatedFiltered;
    getBySlug = getBySlug;
  },
}));

vi.mock("../../lib/db/repositories/tools.repository", () => ({
  ToolsRepository: class {
    findAll = findAll;
    findBySlug = findBySlug;
  },
}));

const CATALOGUE = [
  { id: "t-copilot", slug: "github-copilot", name: "GitHub Copilot", description: "d", category: "ide-assistant", info: {} },
  { id: "t-claude-code", slug: "claude-code", name: "Claude Code", description: "d", category: "autonomous-agent", info: {} },
  { id: "t-gemini", slug: "gemini-code-assist", name: "Gemini Code Assist", description: "Google", category: "ide-assistant", info: { a: 1 } },
];

function article(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    slug: `article-${id}`,
    title: `Article ${id}`,
    summary: "A summary.",
    content: "Body text.",
    source: "AI News",
    sourceUrl: `https://example.com/${id}`,
    publishedAt: new Date("2026-09-01T00:00:00.000Z"),
    toolMentions: [],
    importanceScore: 5,
    tags: [],
    category: null,
    eventType: "update",
    ...overrides,
  };
}

function request(url: string): any {
  return { nextUrl: new URL(url), headers: new Headers() };
}

async function loadRoutes() {
  const { loggers } = await import("../../lib/logger");
  const warn = vi.spyOn(loggers.api, "warn").mockImplementation(() => {});
  const list = await import("../../app/api/news/route");
  const detail = await import("../../app/api/news/[slug]/route");
  return {
    warn,
    getList: async () => {
      const res = await list.GET(request("https://example.test/api/news?limit=100"));
      return { status: res.status, body: await res.json() };
    },
    getDetail: async (slug: string) => {
      const res = await detail.GET(request(`https://example.test/api/news/${slug}`), {
        params: Promise.resolve({ slug }),
      });
      return { status: res.status, body: await res.json() };
    },
  };
}

beforeEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  getPaginatedFiltered.mockReset();
  getBySlug.mockReset();
  findAll.mockReset().mockResolvedValue(CATALOGUE);
  findBySlug.mockReset().mockImplementation(async (slug: string) =>
    CATALOGUE.find((t) => t.slug === slug) ?? null
  );
});

describe("GET /api/news tool attribution (#109)", () => {
  it("attributes a stored {name, toolId} mention to its catalogue tool", async () => {
    getPaginatedFiltered.mockResolvedValue({
      articles: [
        article("1", {
          title: "Customising your assistant",
          toolMentions: [{ name: "GitHub Copilot", toolId: "t-copilot", relevance: 1 }],
        }),
      ],
      total: 1,
      hasMore: false,
    });
    const { getList } = await loadRoutes();

    const { status, body } = await getList();

    expect(status).toBe(200);
    expect(body.news[0].tool_slug).toBe("github-copilot");
    expect(body.news[0].tool_name).toBe("GitHub Copilot");
  });

  it("attributes a title-only article to the catalogue slug, not a coarse one", async () => {
    getPaginatedFiltered.mockResolvedValue({
      articles: [article("2", { title: "Using Claude Code daily" })],
      total: 1,
      hasMore: false,
    });
    const { getList } = await loadRoutes();

    const { body } = await getList();

    expect(body.news[0].tool_slug).toBe("claude-code");
    expect(body.news[0].tool_name).toBe("Claude Code");
  });

  it("gives no attribution for a mention that is not in the catalogue", async () => {
    getPaginatedFiltered.mockResolvedValue({
      articles: [article("3", { title: "Artcraft raises a round", toolMentions: ["Artcraft"] })],
      total: 1,
      hasMore: false,
    });
    const { getList } = await loadRoutes();

    const { body } = await getList();

    expect(body.news[0].tool_slug).toBeUndefined();
    expect(body.news[0].tool_name).toBe("Various Tools");
  });

  it("reads the catalogue once for a page of articles", async () => {
    getPaginatedFiltered.mockResolvedValue({
      articles: [article("4", { title: "Claude Code" }), article("5", { title: "GitHub Copilot" })],
      total: 2,
      hasMore: false,
    });
    const { getList } = await loadRoutes();

    await getList();
    await getList();

    expect(findAll).toHaveBeenCalledTimes(1);
  });

  it("serves 200 with no attribution and one warning when the tools read fails", async () => {
    findAll.mockRejectedValue(new Error("tools read failed"));
    findBySlug.mockRejectedValue(new Error("tools read failed"));
    getPaginatedFiltered.mockResolvedValue({
      articles: [
        article("6", { title: "Using Claude Code daily" }),
        article("7", { toolMentions: [{ name: "GitHub Copilot", toolId: "t-copilot" }] }),
      ],
      total: 2,
      hasMore: false,
    });
    const { getList, warn } = await loadRoutes();

    const { status, body } = await getList();

    expect(status).toBe(200);
    expect(body.news).toHaveLength(2);
    for (const item of body.news) {
      expect(item.tool_slug).toBeUndefined();
      expect(item.tool_name).toBe("Various Tools");
    }
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe("GET /api/news/[slug] tool attribution (#109)", () => {
  it("returns the tool named by the mention's toolId", async () => {
    getBySlug.mockResolvedValue(
      article("8", {
        title: "Google's IDE assistant adds agent mode",
        toolMentions: [{ name: "Google Gemini Code Assist", toolId: "t-gemini" }],
      })
    );
    const { getDetail } = await loadRoutes();

    const { status, body } = await getDetail("article-8");

    expect(status).toBe(200);
    expect(body.tool).toEqual({
      id: "t-gemini",
      slug: "gemini-code-assist",
      name: "Gemini Code Assist",
      description: "Google",
      category: "ide-assistant",
      info: { a: 1 },
    });
  });

  it("serves 200 with tool null and one warning when the tools read fails", async () => {
    findAll.mockRejectedValue(new Error("tools read failed"));
    findBySlug.mockRejectedValue(new Error("tools read failed"));
    getBySlug.mockResolvedValue(
      article("9", { title: "Claude Code ships hooks", toolMentions: [{ name: "Claude Code" }] })
    );
    const { getDetail, warn } = await loadRoutes();

    const { status, body } = await getDetail("article-9");

    expect(status).toBe(200);
    expect(body.article.slug).toBe("article-9");
    expect(body.tool).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
