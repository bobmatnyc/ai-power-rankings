import { JSDOM } from "jsdom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { insightsLinksOutsideInsights } from "./insights-198-links";

/**
 * The Insights RSS feeds, slice 3 of #198.
 *
 * Why: #198 adds one RSS 2.0 feed per cadence behind the slice 1 flag. With the
 * flag off they 404; with it on they carry `X-Robots-Tag: noindex` (the page-head
 * links are in `tests/unit/insights-sitemap-198.test.ts`), and a failed read is a 5xx, never an empty feed.
 * What: calls the real route handlers with the #181 and #182 readers replaced
 * by in-memory fixtures, and parses each feed as XML with jsdom's XML parser,
 * which throws on a document that is not well-formed.
 * Test: `npx vitest run tests/unit/insights-rss-198.test.ts`. No database, no network.
 */

const ORIGIN = "https://aipowerranking.com";

const monthly = vi.hoisted(() => ({ getStoredSummary: vi.fn(), listPeriods: vi.fn() }));
const weekly = vi.hoisted(() => ({
  getStoredDigest: vi.fn(),
  listDigests: vi.fn(),
  listDigestWeeks: vi.fn(),
}));
vi.mock("../../lib/services/whats-new-summary.service", () => monthly);
vi.mock("../../lib/services/weekly-digest.repository", () => weekly);
vi.mock("../../lib/db/repositories/news", () => ({
  newsRepository: { getPublishedSlugs: vi.fn(async () => []) },
}));
vi.mock("../../lib/db/repositories/tools.repository", () => ({
  toolsRepository: { findAll: vi.fn(async () => []) },
}));

// `firstSentence` drops `<tag>` text, so the route-level fixture carries every other XML special.
const SPECIAL = `R&D teams pick "agents" 3 > 2, it's ]]> done.`;

function digest(week: string, createdAt: string, opening = "Two agents shipped terminal modes this week.") {
  return {
    id: `id-${week}`,
    week,
    content: `# Title\n\n${opening}\n\n## Sources\n\n- [A](/en/news/a)\n`,
    generatedAt: new Date(createdAt),
    createdAt: new Date(createdAt),
    updatedAt: new Date(createdAt),
  };
}

type Cadence = "weekly" | "monthly";
const params = (lang: string) => ({ params: Promise.resolve({ lang }) });

async function feed(cadence: Cadence, lang = "en"): Promise<Response> {
  const { GET } =
    cadence === "weekly"
      ? await import("../../app/[lang]/insights/weekly/rss.xml/route")
      : await import("../../app/[lang]/insights/monthly/rss.xml/route");
  // A preview host in the request must never reach the feed's URLs.
  return GET(new Request(`https://preview-abc.vercel.app/${lang}/insights/${cadence}/rss.xml`), params(lang));
}

/** Parses `xml` as XML; throws when it is not well-formed. */
function parse(xml: string): Document {
  return new JSDOM(xml, { contentType: "application/xml" }).window.document;
}

function items(doc: Document) {
  return [...doc.querySelectorAll("channel > item")].map((item) => ({
    title: item.querySelector("title")?.textContent,
    link: item.querySelector("link")?.textContent ?? "",
    guid: item.querySelector("guid")?.textContent,
    description: item.querySelector("description")?.textContent,
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_BASE_URL", undefined);
  vi.stubEnv("VERCEL_URL", "preview-abc.vercel.app");
  vi.stubEnv("INSIGHTS_PREVIEW", "true");
  weekly.listDigests.mockResolvedValue([
    digest("2026-W43", "2026-10-26T07:31:00.000Z"),
    digest("2026-W44", "2026-11-02T07:31:00.000Z", SPECIAL),
  ]);
  monthly.listPeriods.mockResolvedValue([
    { period: "2026-10", updatedAt: new Date("2026-11-01T08:05:00.000Z") },
    { period: "2026-09", updatedAt: new Date("2026-10-01T08:05:00.000Z") },
  ]);
  weekly.listDigestWeeks.mockResolvedValue([]);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Insights RSS flag gate (#198)", () => {
  it.each<Cadence>(["weekly", "monthly"])("answers 404 for the %s feed, before any read, when the flag is off", async (cadence) => {
    vi.stubEnv("INSIGHTS_PREVIEW", "");
    const response = await feed(cadence);
    expect(response.status).toBe(404);
    expect(response.headers.get("Content-Type")).not.toContain("rss");
    expect(weekly.listDigests).not.toHaveBeenCalled();
    expect(monthly.listPeriods).not.toHaveBeenCalled();
  });

  it.each<Cadence>(["weekly", "monthly"])("answers 404 for the %s feed under an unknown locale", async (cadence) => {
    const response = await feed(cadence, "xx");
    expect(response.status).toBe(404);
    expect(weekly.listDigests).not.toHaveBeenCalled();
    expect(monthly.listPeriods).not.toHaveBeenCalled();
  });
});

describe("/[lang]/insights/weekly/rss.xml (#198)", () => {
  it("is valid noindex RSS 2.0 with absolute /en permalinks on the canonical origin, newest first", async () => {
    const response = await feed("weekly", "ko");
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/rss+xml; charset=utf-8");
    expect(response.headers.get("X-Robots-Tag")).toContain("noindex");
    const xml = await response.text();
    const doc = parse(xml);
    expect(doc.documentElement.nodeName).toBe("rss");
    expect(doc.documentElement.getAttribute("version")).toBe("2.0");
    expect(doc.querySelector("channel > link")?.textContent).toBe(`${ORIGIN}/en/insights`);
    expect(xml).toContain(`href="${ORIGIN}/ko/insights/weekly/rss.xml" rel="self"`);
    const listed = items(doc);
    expect(listed.map((i) => i.title)).toEqual(["Weekly insight: Oct 26 to Nov 1, 2026", "Weekly insight: Oct 19 to Oct 25, 2026"]);
    for (const item of listed) {
      const url = new URL(item.link);
      expect(url.origin).toBe(ORIGIN);
      expect(url.pathname).toMatch(/^\/en\/insights\/weekly\/\d{4}-W\d{2}$/);
      expect(item.guid).toBe(item.link);
    }
    expect(xml).not.toContain("vercel.app");
  });

  it("escapes special characters so the parsed text round-trips", async () => {
    const xml = await (await feed("weekly")).text();
    const listed = items(parse(xml));
    expect(listed[0]?.description).toBe(SPECIAL);
    expect(xml).toContain("R&amp;D teams pick &quot;agents&quot; 3 &gt; 2, it&apos;s ]]&gt; done.");
  });

  it("escapes `<` and markup in titles and descriptions built by `buildInsightsRssFeed`", async () => {
    const { buildInsightsRssFeed } = await import("../../app/[lang]/insights/insights-rss");
    const raw = `<script>alert("x")</script> & <![CDATA[ ]]>`;
    const xml = buildInsightsRssFeed({
      cadence: "weekly",
      lang: "en",
      baseUrl: `${ORIGIN}/`,
      items: [{ title: raw, path: "/insights/weekly/2026-W44", description: raw, date: new Date("2026-11-02T07:31:00Z") }],
      now: new Date("2026-11-03T00:00:00Z"),
    });
    const [item] = items(parse(xml));
    expect(item).toEqual({
      title: raw,
      link: `${ORIGIN}/en/insights/weekly/2026-W44`,
      guid: `${ORIGIN}/en/insights/weekly/2026-W44`,
      description: raw,
    });
    expect(xml).not.toContain("<script>");
    expect(xml).not.toContain("<![CDATA[");
  });

  it("is a valid feed with no items only when no digest is stored", async () => {
    weekly.listDigests.mockResolvedValue([]);
    const response = await feed("weekly");
    expect(response.status).toBe(200);
    expect(items(parse(await response.text()))).toEqual([]);
  });

  it("answers 503, not an empty feed, when the read fails", async () => {
    weekly.listDigests.mockRejectedValue(new Error("connection reset"));
    const response = await feed("weekly");
    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.text()).not.toContain("<rss");
  });
});

describe("/[lang]/insights/monthly/rss.xml (#198)", () => {
  it("is valid noindex RSS 2.0 with absolute /en permalinks on the canonical origin, newest first", async () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://example.org/");
    const response = await feed("monthly", "de");
    expect(response.status).toBe(200);
    expect(response.headers.get("X-Robots-Tag")).toContain("noindex");
    const doc = parse(await response.text());
    expect(doc.documentElement.getAttribute("version")).toBe("2.0");
    expect(items(doc)).toEqual([
      {
        title: "Monthly insight: October 2026",
        link: "https://example.org/en/insights/monthly/2026-10",
        guid: "https://example.org/en/insights/monthly/2026-10",
        description: "Monthly insight for October 2026.",
      },
      {
        title: "Monthly insight: September 2026",
        link: "https://example.org/en/insights/monthly/2026-09",
        guid: "https://example.org/en/insights/monthly/2026-09",
        description: "Monthly insight for September 2026.",
      },
    ]);
  });

  it("is a valid feed with no items only when no report is stored", async () => {
    monthly.listPeriods.mockResolvedValue([]);
    const response = await feed("monthly");
    expect(response.status).toBe(200);
    expect(items(parse(await response.text()))).toEqual([]);
  });

  it("answers 503, not an empty feed, when the read fails", async () => {
    monthly.listPeriods.mockRejectedValue(new Error("connection reset"));
    const response = await feed("monthly");
    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.text()).not.toContain("<rss");
  });
});

describe("Insights feeds are linked from no other page while they are a preview (#198)", () => {
  it("has no link from any source outside the Insights route and template", () => {
    const { scanned, linking } = insightsLinksOutsideInsights();
    expect(scanned).toBeGreaterThan(0);
    expect(linking).toEqual([]);
  });
});
