import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The weekly Insights preview, slice 1 of #198.
 *
 * Why: #198 ships `/insights` and `/insights/weekly/<week>` behind a flag that
 * is off by default, `noindex`, outside the sitemap and unlinked, so the #191
 * redirects stay held. A failed digest read must not look like "no insights yet".
 * What: renders the real hub and permalink pages and their `generateMetadata`
 * with the #181 digest readers replaced by in-memory fixtures, and builds the
 * real sitemap with its database reads stubbed.
 * Test: `npx vitest run tests/unit/insights-weekly-198.test.tsx`. No database, no network.
 */

const NOT_FOUND = { digest: "NEXT_HTTP_ERROR_FALLBACK;404" };
const ORIGIN = "https://aipowerranking.com";

const repo = vi.hoisted(() => ({
  getStoredDigest: vi.fn(),
  listDigests: vi.fn(),
  listDigestWeeks: vi.fn(),
}));
vi.mock("../../lib/services/weekly-digest.repository", () => repo);
vi.mock("../../lib/services/whats-new-summary.service", () => ({ listPeriods: vi.fn(async () => []) }));
vi.mock("../../lib/db/repositories/news", () => ({
  newsRepository: { getPublishedSlugs: vi.fn(async () => []) },
}));
vi.mock("../../lib/db/repositories/tools.repository", () => ({
  toolsRepository: { findAll: vi.fn(async () => []) },
}));

const FULL_CONTENT = [
  "# AI coding tools: week of Oct 26 to Nov 1, 2026",
  "",
  "Two agents shipped terminal modes this week. Editor vendors answered with pricing changes.",
  "",
  "## The week in short",
  "- [Alpha ships a CLI](/en/news/alpha-cli)",
  "- Beta adds a review bot",
  "- Gamma cuts its team price",
  "",
  "## What mattered",
  "Terminal-first agents are now the default shape.",
  "",
  "## New and changed",
  "- Delta joined the directory.",
  "",
  "## Worth watching",
  "Whether editors follow the CLI move.",
  "",
  "## Sources",
  "",
  "- [Alpha ships a CLI](/en/news/alpha-cli)",
  "",
  "<script>alert('xss')</script>",
].join("\n");

function digest(week: string, content = FULL_CONTENT) {
  return {
    id: `id-${week}`,
    week,
    windowStart: new Date("2026-10-26T00:00:00.000Z"),
    windowEnd: new Date("2026-11-01T23:59:59.999Z"),
    content,
    dataHash: "hash",
    metadata: { tier: "full", article_count: 5 },
    generatedAt: new Date("2026-11-02T07:31:00.000Z"),
    createdAt: new Date("2026-11-02T07:31:00.000Z"),
    updatedAt: new Date("2026-11-02T07:31:00.000Z"),
  };
}

const params = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) });

async function hubModule() {
  return import("../../app/[lang]/insights/page");
}
async function weekModule() {
  return import("../../app/[lang]/insights/weekly/[week]/page");
}
async function renderHub(lang = "en"): Promise<string> {
  const { default: Page } = await hubModule();
  return renderToStaticMarkup((await Page(params({ lang }))) as ReactElement);
}
async function renderWeek(week: string, lang = "en"): Promise<string> {
  const { default: Page } = await weekModule();
  return renderToStaticMarkup((await Page(params({ lang, week }))) as ReactElement);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_BASE_URL", undefined);
  vi.stubEnv("INSIGHTS_PREVIEW", "true");
  repo.getStoredDigest.mockImplementation(async (w: string) => (w === "2026-W44" ? digest("2026-W44") : null));
  repo.listDigests.mockResolvedValue([digest("2026-W44"), digest("2026-W43")]);
  repo.listDigestWeeks.mockResolvedValue([
    { week: "2026-W44", updatedAt: new Date("2026-11-02T07:31:00.000Z") },
  ]);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("INSIGHTS_PREVIEW flag (#198)", () => {
  it.each([
    [{}, false],
    [{ INSIGHTS_PREVIEW: "" }, false],
    [{ INSIGHTS_PREVIEW: "1" }, false],
    [{ INSIGHTS_PREVIEW: "false" }, false],
    [{ NODE_ENV: "development" }, false],
    [{ INSIGHTS_PREVIEW: "true" }, true],
  ])("insightsPreviewEnabled(%j) is %s", async (env, expected) => {
    const { insightsPreviewEnabled } = await import("../../app/[lang]/insights/preview-gate");
    expect(insightsPreviewEnabled(env)).toBe(expected);
  });

  it("answers 404 on every route and metadata call, before any read, when the flag is off", async () => {
    vi.stubEnv("INSIGHTS_PREVIEW", "");
    const hub = await hubModule();
    const week = await weekModule();
    await expect(renderHub()).rejects.toMatchObject(NOT_FOUND);
    await expect(hub.generateMetadata(params({ lang: "en" }))).rejects.toMatchObject(NOT_FOUND);
    await expect(renderWeek("2026-W44")).rejects.toMatchObject(NOT_FOUND);
    await expect(week.generateMetadata(params({ lang: "en", week: "2026-W44" }))).rejects.toMatchObject(NOT_FOUND);
    expect(repo.listDigests).not.toHaveBeenCalled();
    expect(repo.getStoredDigest).not.toHaveBeenCalled();
  });
});

describe("/insights/weekly/<week> (#198)", () => {
  it("renders the digest in the Insight template: one h1, the opening, each section labelled in order", async () => {
    const html = await renderWeek("2026-W44");
    expect(html).toContain('data-template="insight-weekly"');
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toMatch(/<h1[^>]*>Oct 26 to Nov 1, 2026<\/h1>/);
    expect(html).toContain('<time dateTime="2026-11-02T07:31:00.000Z">November 2, 2026</time>');
    expect(html).toMatch(/data-part="opening"[^>]*><p>Two agents shipped terminal modes/);
    const headings = [...html.matchAll(/<h2 id="([^"]+)"[^>]*>([^<]+)<\/h2>/g)].map((m) => [m[1], m[2]]);
    expect(headings).toEqual([
      ["insight-the-week-in-short", "The week in short"],
      ["insight-what-mattered", "What mattered"],
      ["insight-new-and-changed", "New and changed"],
      ["insight-worth-watching", "Worth watching"],
      ["insight-sources", "Sources"],
    ]);
    for (const [id] of headings) expect(html).toContain(`aria-labelledby="${id}"`);
    expect(html).toContain('href="/en/news/alpha-cli"');
    expect(html).not.toContain("AI coding tools: week of");
    expect(html).not.toContain("<script>alert");
  });

  it("renders a short digest (no model sections) as its opening and Sources", async () => {
    const { insightParts } = await import("../../components/insights/weekly-insight");
    const parts = insightParts("# Title\n\nOne article this week.\n\n## Sources\n\n- [A](/en/news/a)\n");
    expect(parts).toEqual({
      opening: "One article this week.",
      sections: [{ id: "insight-sources", title: "Sources", body: "- [A](/en/news/a)" }],
    });
  });

  it.each([
    ["a malformed week", "2026-44"],
    ["a week that is not an ISO week", "2025-W53"],
    ["a week with no stored digest", "2026-W10"],
  ])("answers 404 for %s", async (_name, week) => {
    await expect(renderWeek(week)).rejects.toMatchObject(NOT_FOUND);
  });

  it("throws, not 404, when the read fails", async () => {
    repo.getStoredDigest.mockRejectedValue(new Error("connection reset"));
    await expect(renderWeek("2026-W44")).rejects.toThrow("connection reset");
  });

  it("is noindex with an /en canonical, no hreflang and the first sentence as description", async () => {
    const { generateMetadata } = await weekModule();
    const meta = await generateMetadata(params({ lang: "ko", week: "2026-W44" }));
    expect(meta.robots).toMatchObject({ index: false, follow: false, googleBot: { index: false, follow: false } });
    expect(meta.alternates?.canonical).toBe(`${ORIGIN}/en/insights/weekly/2026-W44`);
    expect(meta.alternates?.languages).toBeUndefined();
    expect(meta.description).toBe("Two agents shipped terminal modes this week.");
  });
});

describe("/insights hub (#198)", () => {
  it("shows the latest week and lists every stored week, newest first", async () => {
    const html = await renderHub("de");
    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain("Latest week");
    expect(html).toContain("Two agents shipped terminal modes this week.");
    const links = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    expect(links).toEqual([
      "/de/insights/weekly/2026-W44",
      "/de/insights/weekly/2026-W44",
      "/de/insights/weekly/2026-W43",
    ]);
    expect(repo.listDigests).toHaveBeenCalledWith(52);
    expect(html).not.toContain('data-state="empty"');
  });

  it("shows the empty state when no digest is stored", async () => {
    repo.listDigests.mockResolvedValue([]);
    const html = await renderHub();
    expect(html).toContain('data-state="empty"');
    expect(html).toContain("No weekly insights yet");
    expect(html).not.toContain("Latest week");
  });

  it("throws the read error instead of rendering the empty state", async () => {
    repo.listDigests.mockRejectedValue(new Error("connection reset"));
    // A swallowed error would resolve to the empty-state HTML; it must reject.
    const outcome = await renderHub().then(
      (html) => ({ html }),
      (error: unknown) => ({ error })
    );
    expect(outcome).not.toHaveProperty("html");
    expect(outcome).toMatchObject({ error: expect.objectContaining({ message: "connection reset" }) });
  });

  it("is noindex with an /en canonical and no hreflang", async () => {
    const { generateMetadata } = await hubModule();
    const meta = await generateMetadata(params({ lang: "ja" }));
    expect(meta.robots).toMatchObject({ index: false, follow: false, googleBot: { index: false, follow: false } });
    expect(meta.alternates?.canonical).toBe(`${ORIGIN}/en/insights`);
    expect(meta.alternates?.languages).toBeUndefined();
    expect(repo.listDigests).not.toHaveBeenCalled();
  });
});

describe("Insights stays out of discovery while it is a preview (#198)", () => {
  it("is absent from the sitemap with the flag on and a digest stored", async () => {
    const { buildSitemapEntries } = await import("../../lib/sitemap");
    const entries = await buildSitemapEntries(ORIGIN);
    expect(entries.length).toBeGreaterThan(0);
    // The stored week is listed under its #181 permalink, never under /insights.
    expect(entries.map(({ url }) => url)).toContain(`${ORIGIN}/en/whats-new/weekly/2026-W44`);
    expect(entries.filter(({ url }) => /\/insights(?:[/?#]|$)/.test(url))).toEqual([]);
  });

  it("has no link from any source outside the Insights route and template", () => {
    const root = join(__dirname, "..", "..");
    // A quoted "/insights..." path, or one after a template `${...}` segment.
    const link = /(?:["'`]|\})\/insights(?:["'`/?#])/;
    const sources = ["app", "components", "lib", "i18n", "contexts", "hooks", "src"].flatMap((dir) =>
      walk(root, join(root, dir))
    );
    expect(sources.length).toBeGreaterThan(0);
    const linking = sources.filter(
      (file) =>
        !file.startsWith("app/[lang]/insights/") &&
        !file.startsWith("components/insights/") &&
        link.test(readFileSync(join(root, file), "utf8"))
    );
    expect(linking).toEqual([]);
  });
});

function walk(root: string, dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name.startsWith(".") || name === "node_modules") continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(root, path, out);
    else if (/\.(ts|tsx|js|jsx|mjs|md|mdx|json)$/.test(name)) out.push(relative(root, path).split(sep).join("/"));
  }
  return out;
}
