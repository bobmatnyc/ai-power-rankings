import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../i18n/dictionaries/en.json";

/**
 * The Insights launch surfaces of #198: indexable metadata, the nav link and the home card.
 *
 * Why: #198 adds Insights to the site nav and a "This week" card to the home
 * page, and gives the weekly and monthly pages the metadata an indexable page
 * needs. All of it ships behind `INSIGHTS_PREVIEW`; with the flag off every
 * existing page must render exactly as before.
 * What: renders the real pages, `generateMetadata`, nav model, header nav,
 * footer, `[lang]` layout and home slot with the digest and report readers
 * replaced by in-memory fixtures, once with the flag off and once on.
 * Test: `npx vitest run tests/unit/insights-launch-198.test.tsx`. No database, no network.
 */

const ORIGIN = "https://aipowerranking.com";

const weekly = vi.hoisted(() => ({ getStoredDigest: vi.fn(), listDigests: vi.fn(), listDigestWeeks: vi.fn() }));
const monthly = vi.hoisted(() => ({ getStoredSummary: vi.fn(), listPeriods: vi.fn() }));
const nav = vi.hoisted(() => ({ pathname: "/en" }));

vi.mock("../../lib/services/weekly-digest.repository", () => weekly);
vi.mock("../../lib/services/whats-new-summary.service", () => monthly);
vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("../../i18n/client", () => ({ useI18n: () => ({ dict: en, lang: "fr" }) }));
vi.mock("../../components/layout/client-layout", () => ({ ClientLayout: () => null }));
vi.mock("../../components/analytics/GoogleAnalytics", () => ({ GoogleAnalytics: () => null }));
vi.mock("server-only", () => ({}));

const CREATED = new Date("2026-11-02T07:31:00.000Z");
const GENERATED = new Date("2026-11-03T09:00:00.000Z");
const CONTENT = "# Title\n\nTwo agents shipped 3<4 terminal modes. More text.\n\n## What mattered\n\nCLIs.";

const digest = (week: string) => ({ week, content: CONTENT, createdAt: CREATED, generatedAt: GENERATED });
const report = (period: string) => ({ period, content: CONTENT, metadata: {}, createdAt: CREATED, generatedAt: GENERATED });
const params = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) });
const OFF_VALUES = [undefined, "", "false", "1", "TRUE"];

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_BASE_URL", undefined);
  vi.stubEnv("INSIGHTS_PREVIEW", "true");
  weekly.getStoredDigest.mockImplementation(async (w: string) => digest(w));
  weekly.listDigests.mockResolvedValue([digest("2026-W44")]);
  monthly.getStoredSummary.mockImplementation(async (p: string) => report(p));
  nav.pathname = "/fr";
});

afterEach(() => {
  vi.unstubAllEnvs();
});

/** The parsed JSON-LD block of a rendered page. */
function jsonLd(html: string): Record<string, unknown> {
  const body = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)?.[1];
  expect(body, "page has a JSON-LD block").toBeDefined();
  expect(body).not.toContain("<");
  return JSON.parse(body as string);
}

describe("indexable metadata of the Insight pages (#198)", () => {
  it.each([
    ["weekly", "weekly/[week]", { week: "2026-W44" }, "/en/insights/weekly/2026-W44", "Weekly insight: Oct 26 to Nov 1, 2026"],
    ["monthly", "monthly/[month]", { month: "2026-10" }, "/en/insights/monthly/2026-10", "Monthly insight: October 2026"],
  ])("%s: an article Open Graph and Twitter card, still noindex", async (_c, route, p, path, headline) => {
    const page = await import(`../../app/[lang]/insights/${route}/page`);
    const meta = await page.generateMetadata(params({ lang: "ko", ...p }));
    expect(meta.robots).toMatchObject({ index: false, follow: false });
    expect(meta.alternates?.canonical).toBe(`${ORIGIN}${path}`);
    expect(meta.openGraph).toMatchObject({
      type: "article",
      url: `${ORIGIN}${path}`,
      locale: "en",
      siteName: "AI Power Rankings",
      publishedTime: CREATED.toISOString(),
      modifiedTime: GENERATED.toISOString(),
    });
    expect(meta.twitter).toMatchObject({ card: "summary", title: `${headline} | Insights | AI Power Rankings` });
  });

  it.each([
    ["weekly", "weekly/[week]", { week: "2026-W44" }, "/en/insights/weekly/2026-W44", "Weekly insight: Oct 26 to Nov 1, 2026"],
    ["monthly", "monthly/[month]", { month: "2026-10" }, "/en/insights/monthly/2026-10", "Monthly insight: October 2026"],
  ])("%s: one JSON-LD Article naming the canonical, with `<` escaped", async (_c, route, p, path, headline) => {
    const page = await import(`../../app/[lang]/insights/${route}/page`);
    const html = renderToStaticMarkup((await page.default(params({ lang: "de", ...p }))) as ReactElement);
    const schema = jsonLd(html);
    expect(schema).toMatchObject({
      "@type": "Article",
      headline,
      description: "Two agents shipped 3<4 terminal modes.",
      mainEntityOfPage: `${ORIGIN}${path}`,
      inLanguage: "en",
      datePublished: CREATED.toISOString(),
      dateModified: GENERATED.toISOString(),
    });
  });

  it("dateModified is never before datePublished", async () => {
    weekly.getStoredDigest.mockResolvedValue({ ...digest("2026-W44"), generatedAt: new Date("2026-01-01T00:00:00Z") });
    const page = await import("../../app/[lang]/insights/weekly/[week]/page");
    const meta = await page.generateMetadata(params({ lang: "en", week: "2026-W44" }));
    expect(meta.openGraph).toMatchObject({ modifiedTime: CREATED.toISOString() });
  });

  it("the hub is a website Open Graph, still noindex", async () => {
    const hub = await import("../../app/[lang]/insights/page");
    const meta = await hub.generateMetadata(params({ lang: "en" }));
    expect(meta.robots).toMatchObject({ index: false, follow: false });
    expect(meta.openGraph).toMatchObject({ type: "website", url: `${ORIGIN}/en/insights` });
  });
});

describe("the Insights nav link (#198)", () => {
  it("buildSiteNav adds Insights after Tools only with { insights: true }", async () => {
    const { buildSiteNav } = await import("../../lib/navigation/site-nav");
    const before = buildSiteNav("fr", en);
    expect(buildSiteNav("fr", en, undefined, { insights: false })).toEqual(before);
    expect(before.map((m) => m.id)).not.toContain("insights");
    const on = buildSiteNav("fr", en, undefined, { insights: true });
    expect(on.map((m) => m.id)).toEqual(["rankings", "tools", "insights", "news", "methodology", "about"]);
    expect(on.find((m) => m.id === "insights")).toEqual({ id: "insights", label: "Insights", href: "/fr/insights" });
    expect(on.filter((m) => m.id !== "insights")).toEqual(before);
  });

  it("an Insights page is the Insights section", async () => {
    const { currentSection } = await import("../../lib/navigation/site-nav");
    expect(currentSection("/fr/insights/weekly/2026-W44", "fr")).toBe("insights");
    expect(currentSection("/fr/insightsx", "fr")).toBeNull();
  });

  it("the header nav, phone menu and footer show the link only when told the flag is on", async () => {
    const { DesktopSiteNav, MobileSiteNav } = await import("../../components/layout/site-nav");
    const { Footer } = await import("../../components/layout/footer");
    for (const Component of [DesktopSiteNav, MobileSiteNav, Footer]) {
      const off = renderToStaticMarkup(<Component />);
      expect(renderToStaticMarkup(<Component insights={false} />)).toBe(off);
      expect(off).not.toContain("/insights");
      const on = renderToStaticMarkup(<Component insights />);
      expect(on).toContain('href="/fr/insights"');
    }
  });

  it.each(OFF_VALUES)("INSIGHTS_PREVIEW=%j: the layout passes ClientLayout no insightsNav prop", async (flag) => {
    vi.stubEnv("INSIGHTS_PREVIEW", flag);
    const { default: LanguageLayout } = await import("../../app/[lang]/layout");
    const props = clientLayoutProps(await LanguageLayout({ children: <p />, params: Promise.resolve({ lang: "fr" }) }));
    expect(Object.keys(props ?? {}).sort()).toEqual(["categories", "children", "dict", "lang"]);
  });

  it("INSIGHTS_PREVIEW=true: the layout passes ClientLayout insightsNav", async () => {
    const { default: LanguageLayout } = await import("../../app/[lang]/layout");
    const props = clientLayoutProps(await LanguageLayout({ children: <p />, params: Promise.resolve({ lang: "fr" }) }));
    expect(props).toMatchObject({ insightsNav: true, lang: "fr" });
  });
});

/** The props of the `ClientLayout` element in the layout's tree. */
function clientLayoutProps(node: ReactNode): Record<string, unknown> | undefined {
  if (Array.isArray(node)) return node.map(clientLayoutProps).find(Boolean);
  if (!isValidElement(node)) return undefined;
  const props = node.props as Record<string, unknown>;
  if ("categories" in props) return props;
  return clientLayoutProps(props["children"] as ReactNode);
}

describe("the home 'This week' card (#198)", () => {
  it.each(OFF_VALUES)("INSIGHTS_PREVIEW=%j: the slot returns its children unchanged and reads nothing", async (flag) => {
    vi.stubEnv("INSIGHTS_PREVIEW", flag);
    const { HomeInsightSlot } = await import("../../components/insights/home-insight-card");
    const hero = <section>hero</section>;
    expect(await HomeInsightSlot({ lang: "en", children: hero })).toBe(hero);
    expect(weekly.listDigests).not.toHaveBeenCalled();
  });

  it("flag on: the hero, then the card linking the latest week and the hub", async () => {
    const { HomeInsightSlot } = await import("../../components/insights/home-insight-card");
    const html = renderToStaticMarkup(
      (await HomeInsightSlot({ lang: "de", children: <section>hero</section> })) as ReactElement
    );
    expect(weekly.listDigests).toHaveBeenCalledWith(1);
    expect(html.startsWith("<section>hero</section>")).toBe(true);
    expect(html).toContain('data-card="this-week"');
    expect(html).toContain("This week");
    expect(html).toMatch(/<h2 id="home-this-week"[^>]*><a href="\/de\/insights\/weekly\/2026-W44"[^>]*>Oct 26 to Nov 1, 2026<\/a><\/h2>/);
    expect(html).toContain("Two agents shipped 3&lt;4 terminal modes.");
    expect(html).toContain('href="/de/insights"');
  });

  it("flag on, no digest stored: no card", async () => {
    weekly.listDigests.mockResolvedValue([]);
    const { HomeInsightSlot } = await import("../../components/insights/home-insight-card");
    const hero = <section>hero</section>;
    expect(await HomeInsightSlot({ lang: "en", children: hero })).toBe(hero);
  });

  it("flag on: a failed read fails the render (#368), never an empty card", async () => {
    weekly.listDigests.mockRejectedValue(new Error("connection reset"));
    const { HomeInsightSlot } = await import("../../components/insights/home-insight-card");
    await expect(HomeInsightSlot({ lang: "en", children: null })).rejects.toThrow("connection reset");
  });
});
