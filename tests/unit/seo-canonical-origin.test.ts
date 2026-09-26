import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { locales } from "../../i18n/config";

/**
 * Regression tests for #153 — SEO URLs must name the production origin.
 *
 * Why: canonical, hreflang, openGraph and JSON-LD URLs were built from
 * `getUrl()`, which returns `https://${VERCEL_URL}`. On Vercel that is the
 * per-deployment host, so every page told search engines that the real domain
 * was a duplicate of `*.vercel.app`.
 * What: Simulates a Vercel production build (`VERCEL_URL` set to a deployment
 * host, `VERCEL_ENV=production`, `NEXT_PUBLIC_BASE_URL` unset), calls the real
 * metadata functions, JSON-LD builders, sitemap and robots, and asserts that
 * every emitted URL is on `https://aipowerranking.com` (or a known third-party
 * host) and that none names `vercel.app`. The fetch-oriented `getUrl()` keeps
 * returning the deployment host, and the server-side fetches still use it.
 * The #155 block checks that every page setting its own `alternates` still
 * carries the locale's `application/rss+xml` link. #156: every page case runs
 * under a non-English locale and asserts a self-referencing canonical, the
 * 10 locales plus `x-default` → `/en${path}`, and `og:url` === canonical.
 * Test: `npx vitest run tests/unit/seo-canonical-origin.test.ts`. No database
 * access, no network: repositories and `fetch` are stubbed.
 */

const ORIGIN = "https://aipowerranking.com";
const PREVIEW_HOST = "ai-power-ranking-xyz-1-m.vercel.app";

/** Hosts a JSON-LD block may legitimately name besides the site itself. */
const THIRD_PARTY = /^https:\/\/(schema\.org|twitter\.com|github\.com|linkedin\.com|hyperdev\.matsuoka\.com|example-tool\.dev)(\/|$)/;

const TOOL_ROW = {
  id: "tool-1",
  slug: "cursor",
  name: "Cursor",
  category: "code-editor",
  status: "active",
  info: { product: { description: "AI editor" } },
  json_info: { links: { website: "https://example-tool.dev" } },
  tags: [],
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-02T00:00:00.000Z",
};

// `server-only` throws outside the react-server export condition that Next.js
// sets; the pages under test are Server Components, so neutralise the guard.
vi.mock("server-only", () => ({}));

vi.mock("../../lib/db/repositories/tools.repository", () => {
  class ToolsRepository {
    findBySlug = async () => TOOL_ROW;
    findAll = async () => [TOOL_ROW];
  }
  return { ToolsRepository, toolsRepository: new ToolsRepository() };
});

vi.mock("../../lib/db/repositories/news", () => {
  class NewsRepository {
    getAll = async () => [{ slug: "big-launch", publishedAt: new Date("2026-09-01") }];
  }
  return { NewsRepository, newsRepository: new NewsRepository() };
});

const fetchMock = vi.fn(async (input: string | URL | Request) => {
  const url = String(input instanceof Request ? input.url : input);
  if (url.includes("/api/news/")) {
    return Response.json({
      article: {
        id: "a1",
        slug: "big-launch",
        title: "Big launch",
        content: "Body",
        summary: "Summary",
        published_date: "2026-09-01",
        created_at: "2026-09-01",
        updated_at: "2026-09-02",
      },
      tool: null,
    });
  }
  if (url.includes("/api/rankings")) {
    return Response.json({ rankings: [{ name: "Cursor", updated_at: "2026-09-01" }] });
  }
  return new Response("not found", { status: 404 });
});

// Importing a page pulls in its whole component tree; the first cold import
// can outlast the 5 s default.
vi.setConfig({ testTimeout: 60_000 });

// Every module is imported inside a test, after this hook, so import-time env
// reads (app/layout.tsx's `metadata`) see the simulated Vercel deployment.
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_BASE_URL", undefined);
  vi.stubEnv("NEXTAUTH_URL", undefined);
  vi.stubEnv("VERCEL_BRANCH_URL", undefined);
  vi.stubEnv("VERCEL_URL", PREVIEW_HOST);
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("DATABASE_URL", "postgres://stub");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockClear();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Every absolute http(s) URL anywhere inside `value` (URL objects included). */
function collectUrls(value: unknown, out: string[] = []): string[] {
  if (value instanceof URL) out.push(value.href);
  else if (typeof value === "string") {
    if (/^https?:\/\//.test(value)) out.push(value);
  } else if (Array.isArray(value)) value.forEach((v) => collectUrls(v, out));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => collectUrls(v, out));
  return out;
}

/** Asserts `value` emits at least one site URL and every URL is on the production origin. */
function expectProductionUrls(value: unknown, where: string): string[] {
  const urls = collectUrls(value);
  const serialized = JSON.stringify(value, (_k, v: unknown) => (v instanceof URL ? v.href : v));
  expect(serialized, `${where} names vercel.app`).not.toContain("vercel.app");
  const own = urls.filter((u) => !THIRD_PARTY.test(u));
  expect(own.length, `${where} emitted no site URLs`).toBeGreaterThan(0);
  for (const url of own) {
    expect(url === ORIGIN || url.startsWith(`${ORIGIN}/`), `${where}: ${url}`).toBe(true);
  }
  return own;
}

type Alternates = {
  canonical?: string;
  languages?: Record<string, string>;
};

/**
 * hreflang names exactly one `${ORIGIN}/${locale}${path}` entry for every
 * locale in `i18n/config.ts`, plus `x-default` → the English URL (#156).
 */
function expectHreflang(
  alternates: Alternates | undefined | null,
  path: string,
  where: string
): void {
  const languages = alternates?.languages ?? {};
  expect(Object.keys(languages).sort(), `${where} hreflang set`).toEqual(
    [...locales, "x-default"].sort()
  );
  for (const locale of locales) {
    expect(languages[locale], `${where} hreflang ${locale}`).toBe(`${ORIGIN}/${locale}${path}`);
  }
  expect(languages["x-default"], `${where} hreflang x-default`).toBe(`${ORIGIN}/en${path}`);
}

/**
 * #156: every locale page is a real translation, so its canonical is its own
 * locale URL, its hreflang set is complete (see `expectHreflang`), and
 * `og:url` equals the canonical.
 */
function expectSelfCanonical(
  metadata: { alternates?: unknown; openGraph?: unknown } | null | undefined,
  lang: string,
  path: string,
  where: string
): void {
  const alternates = metadata?.alternates as Alternates | undefined;
  const canonical = `${ORIGIN}/${lang}${path}`;
  expect(alternates?.canonical, `${where} canonical`).toBe(canonical);
  expectHreflang(alternates, path, where);
  const ogUrl = (metadata?.openGraph as { url?: string | URL } | undefined)?.url;
  expect(ogUrl === undefined ? undefined : String(ogUrl), `${where} og:url`).toBe(canonical);
}

/** JSON-LD payloads rendered anywhere in a React element tree. */
function jsonLdIn(node: unknown, out: unknown[] = []): unknown[] {
  if (Array.isArray(node)) {
    node.forEach((n) => jsonLdIn(n, out));
    return out;
  }
  if (!node || typeof node !== "object" || !("props" in node)) return out;
  const props = (node as { props: Record<string, unknown> }).props ?? {};
  const html = (props["dangerouslySetInnerHTML"] as { __html?: string } | undefined)?.__html;
  if (props["type"] === "application/ld+json" && html) out.push(JSON.parse(html));
  jsonLdIn(props["children"], out);
  return out;
}

const params = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) });

// Pages that build canonical + hreflang from a single path under /[lang].
const LOCALIZED_PAGES = [
  "about",
  "methodology",
  "tools",
  "best-ai-app-builders",
  "best-ai-code-editors",
  "best-ai-coding-tools",
  "best-autonomous-agents",
  "best-code-review-tools",
  "best-devops-assistants",
  "best-ide-assistants",
  "best-open-source-frameworks",
  "best-testing-tools",
] as const;

// #156: dashboard pages built by lib/seo/utils, as [module dir under
// app/[lang], served route path without the locale].
const DASHBOARD_PAGES = [
  ["(authenticated)/dashboard", "/dashboard"],
  ["(authenticated)/dashboard/tools", "/dashboard/tools"],
  ["(authenticated)/dashboard/dashboard", "/dashboard/dashboard"],
  ["(authenticated)/dashboard/rankings", "/dashboard/rankings"],
] as const;

describe("SEO origin on a Vercel deployment (#153)", () => {
  it("root layout metadataBase and site-wide JSON-LD use the production origin", async () => {
    const mod = await import("../../app/layout");
    expectProductionUrls(mod.metadata, "app/layout metadata");
    const blocks = jsonLdIn(mod.default({ children: null }));
    expect(blocks.length).toBe(2);
    expectProductionUrls(blocks, "app/layout JSON-LD");
  });

  it("locale layout metadata uses the production origin", async () => {
    const { generateMetadata } = await import("../../app/[lang]/layout");
    expectProductionUrls(await generateMetadata(params({ lang: "en" })), "[lang]/layout");
  });

  it("home page metadata and JSON-LD use the production origin", async () => {
    const mod = await import("../../app/[lang]/page");
    const metadata = await mod.generateMetadata(params({ lang: "de" }));
    expectProductionUrls(metadata, "home metadata");
    expectSelfCanonical(metadata, "de", "", "home");
    const blocks = jsonLdIn(await mod.default(params({ lang: "de" })));
    expect(blocks.length).toBe(1);
    expectProductionUrls(blocks, "home JSON-LD");
  });

  it("news list metadata uses the production origin", async () => {
    const { generateMetadata } = await import("../../app/[lang]/news/page");
    const metadata = await generateMetadata(params({ lang: "ja" }));
    expectProductionUrls(metadata, "news list");
    expectSelfCanonical(metadata, "ja", "/news", "news list");
  });

  it("news article metadata uses the production origin while the fetch keeps the deployment host", async () => {
    const { generateMetadata } = await import("../../app/[lang]/news/[slug]/page");
    const metadata = await generateMetadata(params({ lang: "fr", slug: "big-launch" }));
    expectProductionUrls(metadata, "news article");
    expectSelfCanonical(metadata, "fr", "/news/big-launch", "news article");
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(`https://${PREVIEW_HOST}/api/news/big-launch`);
  });

  it("rankings metadata and JSON-LD use the production origin while the fetch keeps the deployment host", async () => {
    const mod = await import("../../app/[lang]/rankings/page");
    const metadata = await mod.generateMetadata(params({ lang: "de" }));
    expectProductionUrls(metadata, "rankings metadata");
    expectSelfCanonical(metadata, "de", "/rankings", "rankings");
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(`https://${PREVIEW_HOST}/api/rankings`);

    fetchMock.mockClear();
    const blocks = jsonLdIn(await mod.default(params({ lang: "de" })));
    expect(blocks.length).toBeGreaterThan(0);
    expectProductionUrls(blocks, "rankings JSON-LD");
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(`https://${PREVIEW_HOST}/api/rankings`);
  });

  it("trending metadata emits absolute production canonical and hreflang", async () => {
    const { generateMetadata } = await import("../../app/[lang]/trending/page");
    const metadata = await generateMetadata(params({ lang: "es" }));
    expectProductionUrls(metadata, "trending");
    expectSelfCanonical(metadata, "es", "/trending", "trending");
  });

  it("tool detail metadata and JSON-LD use the production origin", async () => {
    const mod = await import("../../app/[lang]/tools/[slug]/page");
    const metadata = await mod.generateMetadata(params({ lang: "it", slug: "cursor" }) as never);
    expectProductionUrls(metadata, "tool detail metadata");
    expectSelfCanonical(metadata, "it", "/tools/cursor", "tool detail");
    const blocks = jsonLdIn(await mod.default(params({ lang: "it", slug: "cursor" }) as never));
    expect(blocks.length).toBeGreaterThan(0);
    expectProductionUrls(blocks, "tool detail JSON-LD");
  });

  it.each(LOCALIZED_PAGES)("%s metadata uses the production origin", async (page) => {
    const { generateMetadata } = await import(`../../app/[lang]/${page}/page.tsx`);
    const metadata = await generateMetadata(params({ lang: "ko" }));
    expectProductionUrls(metadata, page);
    expectSelfCanonical(metadata, "ko", `/${page}`, page);
  });

  it.each(DASHBOARD_PAGES)(
    "%s metadata is noindex, self-canonical under its locale, with no hreflang (#156)",
    async (dir, route) => {
      const mod = await import(/* @vite-ignore */ `../../app/[lang]/${dir}/page.tsx`);
      // A static `metadata` export cannot know the locale; read it anyway so a
      // regression fails on the URLs rather than on a missing export.
      const metadata = mod.generateMetadata
        ? await mod.generateMetadata(params({ lang: "zh" }))
        : mod.metadata;
      expectProductionUrls(metadata, dir);
      const canonical = `${ORIGIN}/zh${route}`;
      expect(metadata.alternates?.canonical, `${dir} canonical`).toBe(canonical);
      // A noindex page offers no translations to index, so it lists none.
      expect(metadata.alternates?.languages, `${dir} hreflang`).toBeUndefined();
      expect(metadata.robots?.index, `${dir} robots.index`).toBe(false);
      expect(String(metadata.openGraph?.url), `${dir} og:url`).toBe(canonical);
    }
  );

  it("lib/seo/schema JSON-LD builders use the production origin", async () => {
    const schema = await import("../../lib/seo/schema");
    const tool = { ...TOOL_ROW, info: { links: { website: "https://example-tool.dev" } } } as never;
    expectProductionUrls(
      [
        schema.createOrganizationSchema(),
        schema.createWebsiteSchema(),
        schema.createRankingSchema(
          [{ name: "Cursor", slug: "cursor", ranking: { position: 1 } }] as never,
          "2026-09"
        ),
        schema.createBreadcrumbSchema([{ name: "Tools", url: "/en/tools" }]),
        schema.createComparisonSchema(tool, tool),
      ],
      "lib/seo/schema"
    );
  });

  it("lib/seo/utils metadata uses the production origin", async () => {
    const utils = await import("../../lib/seo/utils");
    const metadata = utils.generateMetadata({
      title: "t",
      description: "d",
      lang: "hr",
      path: "/dashboard",
    });
    expectProductionUrls(metadata, "lib/seo/utils");
    // #156: locale-prefixed canonical and og:url, the 10 real locales (no pt-BR).
    expectSelfCanonical(metadata, "hr", "/dashboard", "lib/seo/utils");
    // og:locale follows the page locale, as on the home and trending pages.
    expect((metadata.openGraph as { locale?: string } | undefined)?.locale).toBe("hr");
  });

  it("OG image URL helpers default to the production origin", async () => {
    const og = await import("../../lib/og-utils");
    expectProductionUrls(
      [
        og.generateToolOGImageUrl({ name: "Cursor", category: "editor" }),
        og.generateRankingOGImageUrl({ title: "Rankings" }),
        og.generateGeneralOGImageUrl({ title: "General" }),
        og.getFallbackOGImageUrl(),
      ],
      "lib/og-utils"
    );
  });

  it("sitemap URLs use the production origin", async () => {
    const { default: sitemap } = await import("../../app/sitemap");
    const entries = await sitemap();
    expect(entries.some((e) => e.url.endsWith("/tools/cursor"))).toBe(true);
    expect(entries.some((e) => e.url.endsWith("/news/big-launch"))).toBe(true);
    expectProductionUrls(entries, "sitemap");
  });

  it("robots sitemap URL uses the production origin", async () => {
    const { default: robots } = await import("../../app/robots");
    expect(robots().sitemap).toBe(`${ORIGIN}/sitemap.xml`);
  });

  it("an explicit NEXT_PUBLIC_BASE_URL still wins for SEO URLs", async () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://staging.example.com/");
    const { generateMetadata } = await import("../../app/[lang]/news/page");
    const metadata = await generateMetadata(params({ lang: "en" }));
    expect((metadata.alternates as Alternates).canonical).toBe("https://staging.example.com/en/news");
  });
});

describe("localizedAlternates() (#153, #155, #156)", () => {
  const RSS = (lang: string) => ({
    "application/rss+xml": [
      { title: "AI Power Rankings - News & Updates", url: `${ORIGIN}/${lang}/news/rss.xml` },
    ],
  });

  it("canonicalises to the page's own locale and lists every locale plus x-default", async () => {
    const { localizedAlternates } = await import("../../lib/seo/alternates");
    const alternates = localizedAlternates("ko", "/news/big-launch");
    expect(alternates.canonical).toBe(`${ORIGIN}/ko/news/big-launch`);
    expectHreflang(alternates as Alternates, "/news/big-launch", "ko");
    expect(alternates.types).toEqual(RSS("ko"));
  });

  it.each([...locales])("x-default names the English URL on the %s page", async (lang) => {
    const { localizedAlternates } = await import("../../lib/seo/alternates");
    const alternates = localizedAlternates(lang, "/rankings");
    expect(alternates.canonical).toBe(`${ORIGIN}/${lang}/rankings`);
    expect((alternates as Alternates).languages?.["x-default"]).toBe(`${ORIGIN}/en/rankings`);
  });

  it("ignores a leftover canonicalLang option, so no page can canonicalise cross-language", async () => {
    const { localizedAlternates } = await import("../../lib/seo/alternates");
    const call = localizedAlternates as unknown as (lang: string, path: string, opts: object) => Alternates;
    expect(call("fr", "/about", { canonicalLang: "en" }).canonical).toBe(`${ORIGIN}/fr/about`);
  });

  it.each([
    ["xx", "/news"],
    ["EN", "/tools/cursor"],
  ])("canonicalises an unknown locale segment %s to the English URL", async (lang, path) => {
    const { localizedAlternates } = await import("../../lib/seo/alternates");
    const alternates = localizedAlternates(lang, path);
    // /xx/news renders English content; a self-canonical would make it an
    // indexable duplicate of /en/news.
    expect(alternates.canonical).toBe(`${ORIGIN}/en${path}`);
    expectHreflang(alternates as Alternates, path, lang);
  });

  it("emits no trailing slash for the empty home path, x-default included", async () => {
    const { localizedAlternates } = await import("../../lib/seo/alternates");
    const alternates = localizedAlternates("de", "");
    expect(alternates.canonical).toBe(`${ORIGIN}/de`);
    expect((alternates as Alternates).languages?.["en"]).toBe(`${ORIGIN}/en`);
    expect((alternates as Alternates).languages?.["x-default"]).toBe(`${ORIGIN}/en`);
    expectHreflang(alternates as Alternates, "", "home");
  });

  it("never doubles the slash when NEXT_PUBLIC_BASE_URL ends in one", async () => {
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://staging.example.com/");
    const { localizedAlternates } = await import("../../lib/seo/alternates");
    const alternates = localizedAlternates("en", "/about");
    expect(alternates.canonical).toBe("https://staging.example.com/en/about");
    expect((alternates as Alternates).languages?.["ja"]).toBe("https://staging.example.com/ja/about");
    expect((alternates as Alternates).languages?.["x-default"]).toBe(
      "https://staging.example.com/en/about"
    );
    expect(alternates.types).toEqual({
      "application/rss+xml": [
        {
          title: "AI Power Rankings - News & Updates",
          url: "https://staging.example.com/en/news/rss.xml",
        },
      ],
    });
  });
});

describe("getUrl() for server-side fetches (#153)", () => {
  it("keeps returning the deployment host so preview fetches stay on the preview", async () => {
    const { getUrl } = await import("../../lib/get-url");
    expect(getUrl()).toBe(`https://${PREVIEW_HOST}`);
  });

  it("falls back to the correctly spelled production domain", async () => {
    vi.stubEnv("VERCEL_URL", undefined);
    vi.stubEnv("VERCEL_ENV", undefined);
    vi.stubEnv("NODE_ENV", "production");
    const { getUrl } = await import("../../lib/get-url");
    expect(getUrl()).toBe(ORIGIN);
  });
});

/**
 * #155: Next.js replaces the layout's whole `alternates` object when a page
 * sets its own, so every page with a canonical must re-add the RSS link.
 */
describe("RSS discovery link survives page alternates (#155)", () => {
  type Loader = (lang: string) => Promise<{ alternates?: unknown } | null | undefined>;
  const page = (path: string, extra: Record<string, string> = {}): Loader => async (lang) => {
    const mod = await import(/* @vite-ignore */ `../../app/[lang]/${path}`);
    return mod.generateMetadata(params({ lang, ...extra }));
  };

  const LOADERS: Array<[string, Loader]> = [
    ["[lang]/layout", page("layout.tsx")],
    ["news list", page("news/page.tsx")],
    ["news article", page("news/[slug]/page.tsx", { slug: "big-launch" })],
    ["home", page("page.tsx")],
    ["rankings", page("rankings/page.tsx")],
    ["trending", page("trending/page.tsx")],
    ["tool detail", page("tools/[slug]/page.tsx", { slug: "cursor" })],
    ...LOCALIZED_PAGES.map((p): [string, Loader] => [p, page(`${p}/page.tsx`)]),
  ];

  it.each(LOADERS)("%s advertises the locale's news RSS feed", async (_name, load) => {
    const metadata = await load("ja");
    const alternates = metadata?.alternates as { types?: Record<string, unknown> } | undefined;
    expect(alternates?.types?.["application/rss+xml"]).toEqual([
      { title: "AI Power Rankings - News & Updates", url: `${ORIGIN}/ja/news/rss.xml` },
    ]);
  });
});
