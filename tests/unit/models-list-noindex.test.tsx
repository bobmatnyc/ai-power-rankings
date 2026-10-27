import { readFileSync } from "node:fs";
import { isValidElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { locales } from "../../i18n/config";

/**
 * The models list is noindex and says its order is provisional until 10 or more active rows
 * carry coding metrics (#329: D63 amends D80, which kept it noindex at any size).
 *
 * Why: a models list ordered without metrics is not a ranking of quality. Search engines
 *   must not index it, and a reader must be told.
 * What: stubs `/api/rankings` (claiming the list indexable at 10 or more entries, so the page
 *   must enforce the metric rule itself), calls the real models-page `generateMetadata` and
 *   page component, and checks `robots`, the rendered note in every locale against its
 *   dictionary, `rankingListMeta()`, and the sitemap, on both sides of the 10-row metric
 *   boundary. The harness and productivity pages keep the D53 rule (10 or more entries are indexed).
 * Test: `npx vitest run tests/unit/models-list-noindex.test.tsx`. No network.
 */

const NOT_FOUND = new Error("NEXT_NOT_FOUND");
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw NOT_FOUND;
  },
  useRouter: () => ({ push: () => {} }),
  useSearchParams: () => new URLSearchParams(),
}));

const { findAll } = vi.hoisted(() => ({ findAll: vi.fn() }));
vi.mock("../../lib/services/whats-new-summary.service", () => ({ listPeriods: async () => [] }));
vi.mock("../../lib/db/repositories/news", () => ({ newsRepository: { getPublishedSlugs: async () => [] } }));
vi.mock("../../lib/db/repositories/tools.repository", () => {
  class ToolsRepository {
    findAll = findAll;
  }
  return { ToolsRepository, toolsRepository: new ToolsRepository() };
});

const counts: Record<string, number> = {};
// #329: the API's count of active rows with metrics per list; absent means the API sent none.
const metricRows: Record<string, number | undefined> = {};
const fetchStub = async (input: string | URL | Request) => {
  const url = new URL(String(input instanceof Request ? input.url : input));
  const list = url.searchParams.get("list") ?? "harness";
  const n = counts[list] ?? 0;
  const rankings = Array.from({ length: n }, (_, i) => ({ rank: i + 1, tool: { id: `t${i}`, name: `Tool ${i}` } }));
  // Always claims indexable at 10 or more, so the models rule must come from the page.
  const m = metricRows[list];
  return Response.json({
    rankings,
    list,
    list_meta: {
      list,
      entry_count: n,
      indexable: n >= 10,
      tier_scheme: n >= 10 ? "standard" : "thirds",
      ...(m === undefined ? {} : { metric_row_count: m }),
    },
  });
};

const params = (p: Record<string, string>) => ({ params: Promise.resolve(p) }) as never;
const NOINDEX = { index: false, follow: true };

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_BASE_URL", undefined);
  vi.stubEnv("NEXTAUTH_URL", undefined);
  vi.stubEnv("VERCEL_BRANCH_URL", undefined);
  vi.stubEnv("VERCEL_URL", "preview.example.test");
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubGlobal("fetch", fetchStub);
  Object.assign(counts, { harness: 40, model: 12, productivity: 10 });
  for (const key of Object.keys(metricRows)) delete metricRows[key];
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
vi.setConfig({ testTimeout: 60_000 });

async function robotsOf(slug: string): Promise<unknown> {
  const mod = await import("../../app/[lang]/rankings/[list]/page");
  return ((await mod.generateMetadata(params({ lang: "en", list: slug }))) as { robots?: unknown }).robots;
}

function findAll_(node: ReactNode, test: (props: Record<string, any>) => boolean, out: Record<string, any>[] = []) {
  if (Array.isArray(node)) {
    for (const child of node) findAll_(child, test, out);
    return out;
  }
  if (!isValidElement(node)) return out;
  const props = node.props as Record<string, any>;
  if (test(props)) out.push(props);
  findAll_(props.children, test, out);
  return out;
}

async function metricsNotes(slug: string, lang: string) {
  const mod = await import("../../app/[lang]/rankings/[list]/page");
  const tree = await mod.default(params({ lang, list: slug }));
  return findAll_(tree, (p) => p["data-note"] === "metrics-pending");
}

describe("models list robots", () => {
  it.each([0, 9, 12, 50])("is noindex with %i entries when the API reports no metric-row count", async (n) => {
    counts["model"] = n;
    expect(await robotsOf("models")).toEqual(NOINDEX);
  });

  // #329: D63 — the boundary is 10 active rows with metrics.
  it("is noindex with the note at 9 metric rows, indexed without the note at 10", async () => {
    metricRows["model"] = 9;
    expect(await robotsOf("models")).toEqual(NOINDEX);
    expect(await metricsNotes("models", "en")).toHaveLength(1);
    metricRows["model"] = 10;
    expect(await robotsOf("models")).toBeUndefined();
    expect(await metricsNotes("models", "en")).toHaveLength(0);
  });

  it("stays noindex under 10 entries (D53) even with 10 metric rows reported", async () => {
    counts["model"] = 9;
    metricRows["model"] = 10;
    expect(await robotsOf("models")).toEqual(NOINDEX);
  });

  it("keeps the D53 rule for the other lists: 10 or more entries are indexed", async () => {
    expect(await robotsOf("productivity-tools")).toBeUndefined();
    counts["productivity"] = 9;
    expect(await robotsOf("productivity-tools")).toEqual(NOINDEX);
    const mod = await import("../../app/[lang]/rankings/page");
    expect(((await mod.generateMetadata(params({ lang: "en" }))) as { robots?: unknown }).robots).toBeUndefined();
  });

  it("rankingListMeta reports the models list not indexable without 10 metric rows, others by the D53 rule", async () => {
    const { rankingListMeta } = await import("../../lib/rankings/lists");
    expect(rankingListMeta("model", 50).indexable).toBe(false);
    expect(rankingListMeta("model", 50, 9).indexable).toBe(false);
    expect(rankingListMeta("model", 50, 10).indexable).toBe(true);
    expect(rankingListMeta("harness", 10).indexable).toBe(true);
    expect(rankingListMeta("harness", 9).indexable).toBe(false);
    expect(rankingListMeta("productivity", 10).indexable).toBe(true);
  });
});

describe("models list note", () => {
  const dictionary = (lang: string) => JSON.parse(readFileSync(`i18n/dictionaries/${lang}.json`, "utf8"));
  const english = dictionary("en").rankings.lists.modelsMetricsPendingNote as string;

  it("English text is plain and says the order is provisional", () => {
    expect(english).toBe("Provisional: model metrics are not collected yet, so this order is not a ranking of quality.");
  });

  it.each(locales)("renders in %s with that locale's dictionary text", async (lang) => {
    const expected = dictionary(lang).rankings.lists.modelsMetricsPendingNote as string;
    expect(expected.length).toBeGreaterThan(10);
    if (lang !== "en") expect(expected).not.toBe(english);
    const notes = await metricsNotes("models", lang);
    expect(notes).toHaveLength(1);
    expect(String(notes[0]!["children"])).toBe(expected);
  });

  it("is absent from the harness and productivity pages", async () => {
    expect(await metricsNotes("coding-harnesses", "en")).toHaveLength(0);
    expect(await metricsNotes("productivity-tools", "en")).toHaveLength(0);
  });
});

describe("sitemap", () => {
  it("lists no /rankings/models page at 12 active models, and still lists a 10-tool productivity list", async () => {
    const tool = (i: number, kind: string) => ({ id: `${kind}${i}`, slug: `${kind}-${i}`, status: "active", kind, updated_at: "2026-01-02" });
    findAll.mockResolvedValue([
      ...Array.from({ length: 12 }, (_, i) => tool(i, "model")),
      ...Array.from({ length: 10 }, (_, i) => tool(i, "productivity")),
    ]);
    const { buildSitemapEntries } = await import("../../lib/sitemap");
    const paths = (await buildSitemapEntries("https://example.test")).map((e) => new URL(e.url).pathname);
    expect(paths.some((p) => p.endsWith("/rankings/models"))).toBe(false);
    expect(paths.filter((p) => p.endsWith("/rankings/productivity-tools"))).toHaveLength(locales.length);
  });

  // #329: D63 — only active models with a sourced metric count; 9 is out, 10 is in.
  it.each([
    [9, false],
    [10, true],
  ])("with %i active models carrying a Vals TB 4.0 metric, lists /rankings/models: %s", async (n, listed) => {
    const { MODEL_TERMINAL_BENCH_SOURCE } = await import("../../lib/rankings/lists");
    const metric = { metrics: { terminal_bench: 50 }, metrics_provenance: { terminal_bench: { source: MODEL_TERMINAL_BENCH_SOURCE } } };
    const tool = (i: number, status: string, extra: Record<string, unknown>) => ({
      id: `m${status}${i}`,
      slug: `m-${status}-${i}`,
      status,
      kind: "model",
      updated_at: "2026-01-02",
      ...extra,
    });
    findAll.mockResolvedValue([
      ...Array.from({ length: n }, (_, i) => tool(i, "active", metric)),
      ...Array.from({ length: 3 }, (_, i) => tool(i, "inactive", metric)),
      ...Array.from({ length: 3 }, (_, i) => tool(100 + i, "active", {})),
    ]);
    const { buildSitemapEntries } = await import("../../lib/sitemap");
    const paths = (await buildSitemapEntries("https://example.test")).map((e) => new URL(e.url).pathname);
    expect(paths.filter((p) => p.endsWith("/rankings/models"))).toHaveLength(listed ? locales.length : 0);
  });
});
