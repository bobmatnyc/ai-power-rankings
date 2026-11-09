import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { locales } from "../../i18n/config";

/**
 * D6e: the models page and its links are hidden until the model board has metric rows.
 *
 * Why: owner ruling D6e hides the Model page and every link to it until model metrics land,
 *   and restores both automatically once `/api/rankings?list=model` reports a metric row.
 * What: stubs `fetch` with an `/api/rankings` response whose model `metric_row_count` is set
 *   per test (or a failed read), then checks the helper, the `/rankings/models` route
 *   (metadata and page) in every locale, the list switcher on the other list pages, and the
 *   methodology page links, on both sides of 0 rows and on the error paths.
 * Test: `npx vitest run tests/unit/model-page-visibility-d6e.test.tsx`. No database, no network.
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

/** The model board's metric-row count the stubbed API reports; undefined omits it. */
let modelMetricRows: number | undefined;
const boardFetch = async (input: string | URL | Request) => {
  const url = new URL(String(input instanceof Request ? input.url : input));
  const list = url.searchParams.get("list") ?? "harness";
  const rankings = Array.from({ length: 12 }, (_, i) => ({ rank: i + 1, tool: { id: `t${i}`, name: `Tool ${i}` } }));
  const count = list === "model" ? modelMetricRows : 0;
  return Response.json({
    rankings,
    list,
    list_meta: { list, entry_count: 12, indexable: true, tier_scheme: "standard", ...(count === undefined ? {} : { metric_row_count: count }) },
  });
};
const fetchMock = vi.fn(boardFetch);

const params = (p: Record<string, string>) => ({ params: Promise.resolve(p) }) as never;
let logError: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  vi.stubEnv("VERCEL_URL", "preview.example.test");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockImplementation(boardFetch);
  modelMetricRows = 0;
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const { loggers } = await import("../../lib/logger");
  logError = vi.fn();
  vi.spyOn(loggers.ranking, "error").mockImplementation(logError as never);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
vi.setConfig({ testTimeout: 60_000 });

const failures: Array<[string, () => void]> = [
  ["a thrown read", () => fetchMock.mockImplementation(async () => Promise.reject(new TypeError("fetch failed")))],
  ["a non-OK response", () => fetchMock.mockImplementation(async () => new Response("down", { status: 503 }))],
  ["a missing count", () => void (modelMetricRows = undefined)],
  ["a malformed count", () => fetchMock.mockImplementation(async () => Response.json({ list_meta: { metric_row_count: "3" } }))],
];

describe("isModelPageVisible (D6e)", () => {
  it("is false at 0 model metric rows and true from 1, read from the model board", async () => {
    const { isModelPageVisible } = await import("../../lib/rankings/model-page-visibility");
    expect(await isModelPageVisible()).toBe(false);
    modelMetricRows = 1;
    expect(await isModelPageVisible()).toBe(true);
    modelMetricRows = 51;
    expect(await isModelPageVisible()).toBe(true);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("https://preview.example.test/api/rankings?list=model");
  });

  it.each(failures)("fails closed and logs after %s", async (_label, arrange) => {
    modelMetricRows = 5;
    arrange();
    const { isModelPageVisible } = await import("../../lib/rankings/model-page-visibility");
    expect(await isModelPageVisible()).toBe(false);
    expect(logError).toHaveBeenCalledTimes(1);
  });

  it("gates only the model list: harness and productivity are visible without a read", async () => {
    const { isRankingListVisible, visibleRankingLists } = await import("../../lib/rankings/model-page-visibility");
    expect(await isRankingListVisible("harness")).toBe(true);
    expect(await isRankingListVisible("productivity")).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await visibleRankingLists()).toEqual(["harness", "productivity"]);
    modelMetricRows = 1;
    expect(await visibleRankingLists()).toEqual(["harness", "model", "productivity"]);
  });
});

describe("/rankings/models route (D6e)", () => {
  async function route() {
    return import("../../app/[lang]/rankings/[list]/page");
  }

  it.each([...locales])("is a 404 in %s at 0 metric rows (metadata and page)", async (lang) => {
    const mod = await route();
    await expect(mod.generateMetadata(params({ lang, list: "models" }))).rejects.toBe(NOT_FOUND);
    await expect(mod.default(params({ lang, list: "models" }))).rejects.toBe(NOT_FOUND);
  });

  it.each(failures)("is a 404 after %s", async (_label, arrange) => {
    modelMetricRows = 5;
    arrange();
    const mod = await route();
    await expect(mod.default(params({ lang: "en", list: "models" }))).rejects.toBe(NOT_FOUND);
  });

  it("comes back at 1 metric row with no other change", async () => {
    modelMetricRows = 1;
    const mod = await route();
    await expect(mod.generateMetadata(params({ lang: "en", list: "models" }))).resolves.toBeDefined();
    await expect(mod.default(params({ lang: "en", list: "models" }))).resolves.toBeDefined();
  });

  it("leaves the harness and productivity pages up at 0 metric rows", async () => {
    const mod = await route();
    await expect(mod.default(params({ lang: "en", list: "productivity-tools" }))).resolves.toBeDefined();
    await expect(mod.default(params({ lang: "en", list: "coding-harnesses" }))).resolves.toBeDefined();
  });
});

/** Every href in a rendered server tree. */
function hrefs(node: ReactNode, out: string[] = []): string[] {
  if (Array.isArray(node)) {
    for (const child of node) hrefs(child, out);
    return out;
  }
  if (!isValidElement(node)) return out;
  const props = node.props as Record<string, unknown>;
  if (typeof props["href"] === "string") out.push(props["href"]);
  hrefs(props["children"] as ReactNode, out);
  return out;
}

describe("links to /rankings/models (D6e)", () => {
  async function listSwitcher(lang: string, list: string): Promise<string[]> {
    const mod = await import("../../app/[lang]/rankings/[list]/page");
    return hrefs(await mod.default(params({ lang, list }))).filter((h) => h.startsWith(`/${lang}/rankings`));
  }
  async function methodologyHtml(lang: string): Promise<string> {
    const { default: Page } = (await import("../../app/[lang]/methodology/page")) as unknown as {
      default: (p: { params: Promise<{ lang: string }> }) => Promise<ReactElement>;
    };
    return renderToStaticMarkup(await Page({ params: Promise.resolve({ lang }) }));
  }

  it("the list switcher omits the models link at 0 rows and after a failed read, and shows it at 1", async () => {
    expect(await listSwitcher("de", "productivity-tools")).toEqual(["/de/rankings", "/de/rankings/productivity-tools"]);
    fetchMock.mockImplementation(async (input) =>
      String(input).includes("list=model") ? Promise.reject(new TypeError("fetch failed")) : boardFetch(input)
    );
    expect(await listSwitcher("de", "coding-harnesses")).not.toContain("/de/rankings/models");
    fetchMock.mockImplementation(boardFetch);
    modelMetricRows = 1;
    expect(await listSwitcher("de", "productivity-tools")).toEqual([
      "/de/rankings",
      "/de/rankings/models",
      "/de/rankings/productivity-tools",
    ]);
  });

  it("the default /rankings page omits the models link at 0 rows", async () => {
    const mod = await import("../../app/[lang]/rankings/page");
    const links = hrefs(await mod.default(params({ lang: "en" })));
    expect(links).toContain("/en/rankings/productivity-tools");
    expect(links).not.toContain("/en/rankings/models");
  });

  it("the methodology page omits the models link at 0 rows and after a failed read, and shows it at 1", async () => {
    let html = await methodologyHtml("fr");
    expect(html).toContain('href="/fr/rankings/productivity-tools"');
    expect(html).not.toContain("/rankings/models");
    fetchMock.mockImplementation(async () => new Response("down", { status: 503 }));
    expect(await methodologyHtml("fr")).not.toContain("/rankings/models");
    fetchMock.mockImplementation(boardFetch);
    modelMetricRows = 1;
    html = await methodologyHtml("fr");
    expect(html).toContain('href="/fr/rankings/models"');
  });
});
