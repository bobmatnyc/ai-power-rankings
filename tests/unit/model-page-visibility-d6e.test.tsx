import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { locales } from "../../i18n/config";
import { rankingListMeta } from "../../lib/rankings/lists";

/**
 * D6e: the models page and its links are hidden until the model board has metric rows.
 *
 * Why: owner ruling D6e hides the Model page and every link to it until model metrics land,
 *   and restores both automatically once the model board carries a metric row.
 * What: stubs the database read `loadListBoard()` with a board whose model
 *   `metric_row_count` is set per test (or missing, malformed, or a thrown read), then
 *   checks the helper, the `/rankings/models` route (metadata and page) in every locale,
 *   the list switcher on the list pages, and the methodology page links, on both sides of
 *   0 rows and on the error paths. A thrown read hides the links but fails the route's
 *   render (#369), so ISR keeps the last good page. Any `fetch` fails the test.
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

/** The model board's metric-row count the stubbed read reports; undefined omits it. */
let modelMetricRows: unknown;
const { loadListBoard } = vi.hoisted(() => ({ loadListBoard: vi.fn() }));
vi.mock("../../lib/rankings/list-board", () => ({ loadListBoard }));
const boardFor = async (list: "harness" | "model" | "productivity") => {
  const rankings = Array.from({ length: 12 }, (_, i) => ({ rank: i + 1, tool: { id: `t${i}`, name: `Tool ${i}` } }));
  const meta: Record<string, unknown> = { ...rankingListMeta(list, 12, 0) };
  if (list === "model") {
    if (modelMetricRows === undefined) delete meta["metric_row_count"];
    else meta["metric_row_count"] = modelMetricRows;
  }
  return { rankings, meta, header: { version: "8.0", publishedAt: "2026-10-01T00:00:00.000Z" } };
};
const DB_ERROR = new TypeError("connection failed");
/** The model board read throws; the other lists still read. */
const modelReadThrows = () =>
  loadListBoard.mockImplementation(async (list: "harness" | "model" | "productivity") => {
    if (list === "model") throw DB_ERROR;
    return boardFor(list);
  });
const fetchMock = vi.fn(async () => {
  throw new Error("the D6e gate must not fetch");
});

const params = (p: Record<string, string>) => ({ params: Promise.resolve(p) }) as never;
let logError: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockClear();
  loadListBoard.mockReset();
  loadListBoard.mockImplementation(boardFor);
  modelMetricRows = 0;
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const { loggers } = await import("../../lib/logger");
  logError = vi.fn();
  vi.spyOn(loggers.ranking, "error").mockImplementation(logError as never);
});
afterEach(() => {
  expect(fetchMock).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
vi.setConfig({ testTimeout: 60_000 });

/** Reads that answer, but with no usable count: the gate hides the page. */
const badCounts: Array<[string, unknown]> = [
  ["a missing count", undefined],
  ["a malformed count", "3"],
  ["a negative count", -1],
  ["a non-integer count", 1.5],
];

describe("isModelPageVisible (D6e)", () => {
  it("is false at 0 model metric rows and true from 1, read from the model board", async () => {
    const { isModelPageVisible } = await import("../../lib/rankings/model-page-visibility");
    expect(await isModelPageVisible()).toBe(false);
    modelMetricRows = 1;
    expect(await isModelPageVisible()).toBe(true);
    modelMetricRows = 51;
    expect(await isModelPageVisible()).toBe(true);
    expect(loadListBoard.mock.calls.every(([list]) => list === "model")).toBe(true);
    expect(logError).not.toHaveBeenCalled();
  });

  it.each([["a thrown read", null] as [string, unknown], ...badCounts])(
    "fails closed and logs once after %s",
    async (label, count) => {
      if (label === "a thrown read") {
        modelMetricRows = 5;
        modelReadThrows();
      } else {
        modelMetricRows = count;
      }
      const { isModelPageVisible } = await import("../../lib/rankings/model-page-visibility");
      expect(await isModelPageVisible()).toBe(false);
      expect(logError).toHaveBeenCalledTimes(1);
    }
  );

  it("gates only the model list: harness and productivity are visible without a read", async () => {
    const { isRankingListVisible, visibleRankingLists } = await import("../../lib/rankings/model-page-visibility");
    expect(await isRankingListVisible("harness")).toBe(true);
    expect(await isRankingListVisible("productivity")).toBe(true);
    expect(loadListBoard).not.toHaveBeenCalled();
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

  it.each(badCounts)("is a 404 in every locale after %s (metadata and page)", async (_label, count) => {
    modelMetricRows = count;
    const mod = await route();
    for (const lang of locales) {
      await expect(mod.generateMetadata(params({ lang, list: "models" }))).rejects.toBe(NOT_FOUND);
      await expect(mod.default(params({ lang, list: "models" }))).rejects.toBe(NOT_FOUND);
    }
  });

  // #369: a 404 would replace the last good page; a failed render lets ISR keep it.
  it("fails the render with the database error after a thrown read, not a 404 (metadata and page)", async () => {
    modelMetricRows = 5;
    modelReadThrows();
    const mod = await route();
    await expect(mod.generateMetadata(params({ lang: "en", list: "models" }))).rejects.toBe(DB_ERROR);
    await expect(mod.default(params({ lang: "en", list: "models" }))).rejects.toBe(DB_ERROR);
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

  it("the list switcher omits the models link at 0 rows and after a thrown read, and shows it at 1", async () => {
    expect(await listSwitcher("de", "productivity-tools")).toEqual(["/de/rankings", "/de/rankings/productivity-tools"]);
    modelReadThrows();
    expect(await listSwitcher("de", "coding-harnesses")).toEqual(["/de/rankings", "/de/rankings/productivity-tools"]);
    loadListBoard.mockImplementation(boardFor);
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

  it("the methodology page omits the models link at 0 rows and after a thrown read, and shows it at 1", async () => {
    let html = await methodologyHtml("fr");
    expect(html).toContain('href="/fr/rankings/productivity-tools"');
    expect(html).not.toContain("/rankings/models");
    modelReadThrows();
    html = await methodologyHtml("fr");
    expect(html).toContain('href="/fr/rankings/productivity-tools"');
    expect(html).not.toContain("/rankings/models");
    loadListBoard.mockImplementation(boardFor);
    modelMetricRows = 1;
    html = await methodologyHtml("fr");
    expect(html).toContain('href="/fr/rankings/models"');
  });
});
