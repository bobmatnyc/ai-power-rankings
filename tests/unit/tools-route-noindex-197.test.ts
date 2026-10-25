import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Route-level regression tests for #197 (b) — `/api/tools` leaves the noindex
 * non-AI entities of the #191 URL table out of the tools index.
 *
 * Why: the 31 noindex tool slugs are `status: active`, so `/api/tools` returned
 * them, and `/en/tools` plus its client-side search listed them.
 * What: the tools, companies and scoring reads are replaced by fixtures. The
 * active-tool fixture holds every slug of the real `NOINDEX_TOOL_SLUGS` set, one
 * synthetic slug marked noindex through a wrapped `isNoindexToolSlug` (so the
 * test does not depend on the table's contents), and two listed tools. Modules
 * are re-imported per test so the in-memory cache starts empty.
 * Test: `npx vitest run tests/unit/tools-route-noindex-197.test.ts`. No
 * database access, no network.
 */

const SYNTHETIC_UNLISTED = "synthetic-unlisted-entity-197";
const LISTED = ["claude-code", "github-copilot"];

const { findByStatus } = vi.hoisted(() => ({ findByStatus: vi.fn() }));

vi.mock("../../lib/db/connection", () => ({ getDb: () => ({}) }));

vi.mock("../../lib/db/repositories/tools.repository", () => ({
  ToolsRepository: class {
    findByStatus = findByStatus;
  },
}));

vi.mock("../../lib/db/repositories/companies.repository", () => ({
  companiesRepository: { findByIds: async () => [] },
}));

vi.mock("../../lib/services/tool-scoring.service", () => ({
  toolScoringService: {
    getToolScoring: async () => null,
    calculateCurrentScore: () => ({}),
  },
}));

// The real set stays in force; one synthetic slug is added on top of it.
vi.mock("../../lib/seo/url-table", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/seo/url-table")>();
  return {
    ...actual,
    isNoindexToolSlug: (slug: string) =>
      slug === SYNTHETIC_UNLISTED || actual.isNoindexToolSlug(slug),
  };
});

function tool(slug: string) {
  return {
    id: `id-${slug}`,
    slug,
    name: slug,
    category: "ide-assistant",
    status: "active",
    company_id: null,
    info: { description: "d" },
  };
}

async function realNoindexSlugs(): Promise<string[]> {
  const actual = await vi.importActual<typeof import("../../lib/seo/url-table")>(
    "../../lib/seo/url-table"
  );
  return [...actual.NOINDEX_TOOL_SLUGS];
}

async function getTools(): Promise<{ status: number; body: { tools: Array<{ slug: string }> } }> {
  const { GET } = await import("../../app/api/tools/route");
  const res = await GET();
  return { status: res.status, body: await res.json() };
}

describe("#197 /api/tools leaves noindex tool slugs out", () => {
  beforeEach(async () => {
    vi.resetModules();
    findByStatus.mockReset();
    const unlisted = await realNoindexSlugs();
    findByStatus.mockResolvedValue(
      [...unlisted, SYNTHETIC_UNLISTED, ...LISTED].map(tool)
    );
  });

  it("returns no slug of the real NOINDEX_TOOL_SLUGS set, nor the synthetic one", async () => {
    const unlisted = await realNoindexSlugs();
    expect(unlisted.length).toBeGreaterThan(0);

    const { status, body } = await getTools();
    expect(status).toBe(200);
    const slugs = body.tools.map((t) => t.slug);
    for (const slug of [...unlisted, SYNTHETIC_UNLISTED]) {
      expect(slugs, `noindex slug ${slug} is listed`).not.toContain(slug);
    }
  });

  it("still returns a normal tool", async () => {
    const unlisted = new Set(await realNoindexSlugs());
    for (const slug of LISTED) expect(unlisted.has(slug)).toBe(false);

    const { body } = await getTools();
    expect(body.tools.map((t) => t.slug)).toEqual(expect.arrayContaining(LISTED));
  });

  it("counts only the listed tools", async () => {
    const { body } = await getTools();
    expect(body.tools).toHaveLength(LISTED.length);
  });

  it("serves the filtered list from cache on the next request", async () => {
    const { GET } = await import("../../app/api/tools/route");
    await GET();
    const second = await (await GET()).json();
    expect(findByStatus).toHaveBeenCalledTimes(1);
    expect(second.tools.map((t: { slug: string }) => t.slug).sort()).toEqual([...LISTED].sort());
  });
});
