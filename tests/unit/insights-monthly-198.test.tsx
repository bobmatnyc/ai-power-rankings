import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { insightsLinksOutsideInsights } from "./insights-198-links";

/**
 * The monthly Insights preview, slice 2 of #198.
 *
 * Why: #198 adds `/insights/monthly/<yyyy-mm>` and the hub's monthly list
 * behind the slice 1 flag: off by default, `noindex` and
 * unlinked, so the #191 redirects stay held. A failed report read must not look
 * like "no insights yet" or a 404.
 * What: renders the real monthly and hub pages and their `generateMetadata`
 * with the #182 readers (`whats-new-summary.service`) and the #181 digest
 * readers replaced by in-memory fixtures. The sitemap entries are in
 * `tests/unit/insights-sitemap-198.test.ts`.
 * Test: `npx vitest run tests/unit/insights-monthly-198.test.tsx`. No database, no network.
 */

const NOT_FOUND = { digest: "NEXT_HTTP_ERROR_FALLBACK;404" };
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

// The #182 prompt's stored shape: a `# ` title, then four labelled parts.
const REPORT_CONTENT = [
  "# AI coding tools in October 2026",
  "",
  "Agents moved into the terminal in October. Two editors cut prices.",
  "",
  "## The month in brief",
  "Terminal agents led the month.",
  "",
  "## Key developments",
  "- [Alpha ships a CLI](https://example.com/alpha)",
  "",
  "## New tools and ranking updates",
  "- **Delta** joined the directory.",
  "",
  "## What to watch",
  "Whether editors follow.",
  "",
  "<script>alert('xss')</script>",
].join("\n");

function report(period: string, version = 3) {
  return {
    id: `id-${period}-${version}`,
    period,
    content: REPORT_CONTENT,
    dataHash: "hash",
    metadata: { article_count: 40 },
    generatedAt: new Date("2026-11-01T08:05:00.000Z"),
    createdAt: new Date("2026-10-31T08:00:00.000Z"),
    updatedAt: new Date("2026-11-01T08:05:00.000Z"),
    version,
    generatedBy: "cron-monthly-summary",
  };
}

const params = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) });

async function monthModule() {
  return import("../../app/[lang]/insights/monthly/[month]/page");
}
async function hubModule() {
  return import("../../app/[lang]/insights/page");
}
async function renderMonth(month: string, lang = "en"): Promise<string> {
  const { default: Page } = await monthModule();
  return renderToStaticMarkup((await Page(params({ lang, month }))) as ReactElement);
}
async function renderHub(lang = "en"): Promise<string> {
  const { default: Page } = await hubModule();
  return renderToStaticMarkup((await Page(params({ lang }))) as ReactElement);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_BASE_URL", undefined);
  vi.stubEnv("INSIGHTS_PREVIEW", "true");
  monthly.getStoredSummary.mockImplementation(async (p: string) => (p === "2026-10" ? report("2026-10") : null));
  monthly.listPeriods.mockResolvedValue([
    { period: "2026-10", updatedAt: new Date("2026-11-01T08:05:00.000Z") },
    { period: "2026-09", updatedAt: new Date("2026-10-01T08:05:00.000Z") },
  ]);
  weekly.listDigests.mockResolvedValue([]);
  weekly.listDigestWeeks.mockResolvedValue([]);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("/insights/monthly/<month> (#198)", () => {
  it("answers 404 on the route and its metadata, before any read, when the flag is off", async () => {
    vi.stubEnv("INSIGHTS_PREVIEW", "");
    const month = await monthModule();
    const hub = await hubModule();
    await expect(renderMonth("2026-10")).rejects.toMatchObject(NOT_FOUND);
    await expect(month.generateMetadata(params({ lang: "en", month: "2026-10" }))).rejects.toMatchObject(NOT_FOUND);
    await expect(renderHub()).rejects.toMatchObject(NOT_FOUND);
    expect(monthly.getStoredSummary).not.toHaveBeenCalled();
    expect(monthly.listPeriods).not.toHaveBeenCalled();
  });

  it("renders the current report version in the Insight template: one h1, the opening, each part labelled", async () => {
    const html = await renderMonth("2026-10");
    expect(monthly.getStoredSummary).toHaveBeenCalledWith("2026-10");
    expect(html).toContain('data-template="insight-monthly"');
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toMatch(/<h1[^>]*>October 2026<\/h1>/);
    expect(html).toContain('<time dateTime="2026-11-01T08:05:00.000Z">November 1, 2026</time>');
    expect(html).toMatch(/data-part="opening"[^>]*><p>Agents moved into the terminal/);
    const headings = [...html.matchAll(/<h2 id="([^"]+)"[^>]*>([^<]+)<\/h2>/g)].map((m) => m[2]);
    expect(headings).toEqual(["The month in brief", "Key developments", "New tools and ranking updates", "What to watch"]);
    expect(html).toContain('href="https://example.com/alpha"');
    expect(html).not.toContain("AI coding tools in October 2026");
    // Untrusted markdown: raw HTML is shown as text, never emitted as a tag.
    expect(html).not.toContain("<script>alert");
  });

  it.each([
    ["a malformed month", "2026-1"],
    ["month 13", "2026-13"],
    ["a weekly key", "2026-W44"],
    ["a month with no stored report", "2026-08"],
  ])("answers 404, not 500, for %s", async (_name, month) => {
    await expect(renderMonth(month)).rejects.toMatchObject(NOT_FOUND);
  });

  it("throws, not 404, when the read fails", async () => {
    monthly.getStoredSummary.mockRejectedValue(new Error("connection reset"));
    const outcome = await renderMonth("2026-10").then(
      (html) => ({ html }),
      (error: unknown) => ({ error })
    );
    expect(outcome).not.toHaveProperty("html");
    expect(outcome).toMatchObject({ error: expect.objectContaining({ message: "connection reset" }) });
    expect(outcome).not.toMatchObject({ error: NOT_FOUND });
  });

  it("is indexable with the flag on (noindex with it off), an /en canonical, no hreflang and the first sentence as description", async () => {
    const { generateMetadata } = await monthModule();
    const meta = await generateMetadata(params({ lang: "fr", month: "2026-10" }));
    // #198: the flag lifts the noindex; with it off the helper keeps it (the page itself 404s).
    expect(meta.robots).toBeUndefined();
    vi.stubEnv("INSIGHTS_PREVIEW", "");
    const { insightsPreviewMetadata } = await import("../../app/[lang]/insights/preview-gate");
    expect(insightsPreviewMetadata("fr", "/insights/monthly/2026-10", "t", "d").robots).toMatchObject({ index: false, follow: false, googleBot: { index: false, follow: false } });
    expect(meta.alternates?.canonical).toBe(`${ORIGIN}/en/insights/monthly/2026-10`);
    expect(meta.alternates?.languages).toBeUndefined();
    expect(meta.title).toEqual({ absolute: "Monthly insight: October 2026 | Insights | AI Power Rankings" });
    expect(meta.description).toBe("Agents moved into the terminal in October.");
  });
});

describe("/insights hub, monthly list (#198)", () => {
  it("lists every stored month, newest first, with no weekly digest stored", async () => {
    const html = await renderHub("de");
    expect(html).toContain("Monthly insights");
    expect(html).not.toContain('data-state="empty"');
    expect(html).not.toContain("Latest week");
    const links = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    expect(links).toEqual(["/de/insights/monthly/2026-10", "/de/insights/monthly/2026-09"]);
  });

  it("shows the empty state only when no week and no month is stored", async () => {
    monthly.listPeriods.mockResolvedValue([]);
    const html = await renderHub();
    expect(html).toContain('data-state="empty"');
    expect(html).not.toContain("Monthly insights");
  });

  it("throws the monthly read error instead of rendering the empty state", async () => {
    monthly.listPeriods.mockRejectedValue(new Error("connection reset"));
    const outcome = await renderHub().then(
      (html) => ({ html }),
      (error: unknown) => ({ error })
    );
    expect(outcome).not.toHaveProperty("html");
    expect(outcome).toMatchObject({ error: expect.objectContaining({ message: "connection reset" }) });
  });
});

describe("Monthly Insights is linked from no other page while it is a preview (#198)", () => {
  it("has no link from any source outside the Insights route and template", () => {
    const { scanned, linking } = insightsLinksOutsideInsights();
    expect(scanned).toBeGreaterThan(0);
    expect(linking).toEqual([]);
  });
});
