import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Interim display of the weekly digest on `/whats-new` and in RSS (#181).
 *
 * Why: the owner wants weekly digests visible on the site and in a feed before
 * the Insights pages (#198) exist. A permalink must name exactly one stored week,
 * a failed read must not look like "no digests", and the feed must escape what
 * it carries.
 * What: renders the real index and permalink pages, `generateMetadata`, and the
 * RSS route handler with the digest readers and the monthly readers replaced by
 * in-memory fixtures; nothing else is stubbed.
 * Test: `npx vitest run tests/unit/weekly-digest-display-181.test.tsx`. No
 * database, no network.
 */

const NOT_FOUND = { digest: "NEXT_HTTP_ERROR_FALLBACK;404" };
const ORIGIN = "https://aipowerranking.com";

const repo = vi.hoisted(() => ({
  getStoredDigest: vi.fn(),
  listDigests: vi.fn(),
  listDigestWeeks: vi.fn(),
}));
const monthly = vi.hoisted(() => ({
  getLatestStoredSummary: vi.fn(),
  getStoredSummary: vi.fn(),
  listPeriods: vi.fn(),
}));

vi.mock("../../lib/services/weekly-digest.repository", () => repo);
vi.mock("../../lib/services/whats-new-summary.service", () => monthly);

function digest(week: string, over: Record<string, unknown> = {}) {
  return {
    id: `id-${week}`,
    week,
    windowStart: new Date("2026-10-19T00:00:00.000Z"),
    windowEnd: new Date("2026-10-25T23:59:59.999Z"),
    content: [
      "# AI coding tools: week of Oct 19 to Oct 25, 2026",
      "",
      "Three agents shipped editor integrations this week. The largest was a new CLI release.",
      "",
      "## The week in short",
      "- [Alpha ships a CLI](/en/news/alpha-cli)",
      "",
      "## Sources",
      "",
      "- [Alpha ships a CLI](/en/news/alpha-cli)",
      "",
      "<script>alert('xss')</script>",
    ].join("\n"),
    dataHash: "hash",
    metadata: { tier: "full", article_count: 5, model: "fixture-model" },
    generatedAt: new Date("2026-10-26T07:31:00.000Z"),
    createdAt: new Date("2026-10-26T07:31:00.000Z"),
    updatedAt: new Date("2026-10-26T07:31:00.000Z"),
    ...over,
  };
}

const MONTH = {
  id: "m1",
  period: "2026-09",
  content: "September summary sentence. More.",
  dataHash: "h",
  metadata: { article_count: 30 },
  generatedAt: new Date("2026-10-02T06:00:00.000Z"),
  createdAt: new Date("2026-09-30T06:00:00.000Z"),
  updatedAt: new Date("2026-10-02T06:00:00.000Z"),
};

const params = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_BASE_URL", undefined);
  repo.getStoredDigest.mockImplementation(async (w: string) => (w === "2026-W43" ? digest("2026-W43") : null));
  repo.listDigests.mockResolvedValue([
    digest("2026-W43"),
    digest("2026-W42", {
      windowStart: new Date("2026-10-12T00:00:00.000Z"),
      createdAt: new Date("2026-10-19T07:31:00.000Z"),
    }),
  ]);
  repo.listDigestWeeks.mockResolvedValue([]);
  monthly.getLatestStoredSummary.mockResolvedValue(MONTH);
  monthly.getStoredSummary.mockResolvedValue(MONTH);
  monthly.listPeriods.mockResolvedValue([{ period: "2026-09", updatedAt: MONTH.updatedAt }]);
});

async function renderIndex(lang = "en"): Promise<string> {
  const { default: Page } = await import("../../app/[lang]/whats-new/page");
  return renderToStaticMarkup((await Page(params({ lang }))) as ReactElement);
}

async function renderWeek(week: string, lang = "en"): Promise<string> {
  const { default: Page } = await import("../../app/[lang]/whats-new/weekly/[week]/page");
  return renderToStaticMarkup((await Page(params({ lang, week }))) as ReactElement);
}

describe("/whats-new weekly list (#181)", () => {
  it("lists the newest digests under the monthly report, linking each permalink", async () => {
    const html = await renderIndex("ko");
    expect(html).toContain("September 2026");
    expect(html).toContain("Weekly digests");
    expect(html).toContain('href="/ko/whats-new/weekly/2026-W43"');
    expect(html).toContain('href="/ko/whats-new/weekly/2026-W42"');
    expect(html.indexOf("September 2026")).toBeLessThan(html.indexOf("Weekly digests"));
    expect(repo.listDigests).toHaveBeenCalledWith(8);
  });

  it("shows the list even when no monthly report is stored, and omits it when no digest is", async () => {
    monthly.getLatestStoredSummary.mockResolvedValue(null);
    const withList = await renderIndex();
    expect(withList).toContain("No Monthly Summary Available");
    expect(withList).toContain("Weekly digests");

    repo.listDigests.mockResolvedValue([]);
    expect(await renderIndex()).not.toContain("Weekly digests");
  });

  it("keeps the monthly report and drops only the list when the digest read fails", async () => {
    const { loggers } = await import("../../lib/logger");
    const logged = vi.spyOn(loggers.api, "error").mockImplementation(() => undefined);
    repo.listDigests.mockRejectedValue(new Error("connection reset"));
    const html = await renderIndex();
    expect(html).toContain("September 2026");
    expect(html).not.toContain("Weekly digests");
    expect(logged).toHaveBeenCalledWith(
      expect.stringContaining("weekly digest list"),
      expect.objectContaining({ error: "connection reset" }),
    );
    logged.mockRestore();
  });

  it("still fails the page when the monthly read fails", async () => {
    monthly.getLatestStoredSummary.mockRejectedValue(new Error("monthly down"));
    await expect(renderIndex()).rejects.toThrow("monthly down");
  });
});

describe("/whats-new/weekly/<week> (#181)", () => {
  it("renders one digest with a single h1, no duplicated title, and no executable HTML", async () => {
    const html = await renderWeek("2026-W43");
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain("Oct 19 to Oct 25, 2026");
    expect(html).toContain("Three agents shipped editor integrations");
    expect(html).toContain('href="/en/news/alpha-cli"');
    expect(html).not.toContain("AI coding tools: week of");
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });

  it("emits a self-canonical /en permalink and the first sentence as the description", async () => {
    const { generateMetadata } = await import("../../app/[lang]/whats-new/weekly/[week]/page");
    const meta = await generateMetadata(params({ lang: "ko", week: "2026-W43" }));
    expect(meta.alternates?.canonical).toBe(`${ORIGIN}/en/whats-new/weekly/2026-W43`);
    expect(String(meta.openGraph?.url)).toBe(`${ORIGIN}/en/whats-new/weekly/2026-W43`);
    expect(meta.description).toBe("Three agents shipped editor integrations this week.");
  });

  it.each([
    ["a malformed week", "2026-43"],
    ["a week that is not an ISO week", "2025-W53"],
    ["a week with no stored digest", "2026-W10"],
  ])("answers 404 for %s", async (_name, week) => {
    await expect(renderWeek(week)).rejects.toMatchObject(NOT_FOUND);
  });

  it("throws, not 404, when the read fails", async () => {
    repo.getStoredDigest.mockRejectedValue(new Error("connection reset"));
    await expect(renderWeek("2026-W43")).rejects.toThrow("connection reset");
  });
});

describe("/[lang]/whats-new/rss.xml (#181)", () => {
  async function feed(lang = "en"): Promise<Response> {
    const { GET } = await import("../../app/[lang]/whats-new/rss.xml/route");
    return GET(new Request(`${ORIGIN}/${lang}/whats-new/rss.xml`), params({ lang }));
  }

  it("carries weekly digests and monthly reports, newest first, with canonical links", async () => {
    const response = await feed("ko");
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("application/rss+xml");
    expect(response.headers.get("Cache-Control")).toContain("s-maxage=300");
    const xml = await response.text();
    const titles = [...xml.matchAll(/<item>[\s\S]*?<title>([^<]*)<\/title>/g)].map((m) => m[1]);
    expect(titles).toEqual([
      "Weekly digest: Oct 19 to Oct 25, 2026",
      "Weekly digest: Oct 12 to Oct 18, 2026",
      "What&apos;s New: September 2026",
    ]);
    expect(xml).toContain(`<guid isPermaLink="true">${ORIGIN}/en/whats-new/weekly/2026-W43</guid>`);
    expect(xml).toContain(`<link>${ORIGIN}/en/whats-new/2026-09</link>`);
    expect(xml).toContain(`href="${ORIGIN}/ko/whats-new/rss.xml" rel="self"`);
    expect(xml).not.toContain("<script>");
  });

  it("answers 404 for an unknown locale and 503 no-store when a read fails", async () => {
    expect((await feed("xx")).status).toBe(404);
    repo.listDigests.mockRejectedValue(new Error("connection reset"));
    const failed = await feed();
    expect(failed.status).toBe(503);
    expect(failed.headers.get("Cache-Control")).toBe("no-store");
  });
});
