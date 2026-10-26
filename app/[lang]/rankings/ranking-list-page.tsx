import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import { Suspense } from "react";
import RankingsGrid from "@/components/ranking/rankings-grid";
import { FAQSection, QuickAnswerBox } from "@/components/seo";
import { generalFAQs } from "@/data/seo-content";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { getUrl } from "@/lib/get-url";
import { loggers } from "@/lib/logger";
import { generateRankingOGImageUrl } from "@/lib/og-utils";
import {
  DEFAULT_RANKING_LIST,
  INDEX_MIN_ENTRIES,
  listHasMetricsPendingNote,
  listHasProvisionalNote,
  NOINDEX_LISTS,
  type RankingList,
  type RankingListMeta,
  RANKING_LISTS,
  rankingListPath,
} from "@/lib/rankings/lists";
import { createJsonLdScript, generateBreadcrumbSchema, generateRankingFAQSchema } from "@/lib/schema";
import { canonicalLocale, localizedAlternates } from "@/lib/seo/alternates";
import { siteOrigin } from "@/lib/site-origin";

/**
 * One list's ranking page: metadata and body (#186).
 *
 * Why: each list (coding harnesses, models, productivity tools) has its own page,
 *   built the same way. `/rankings` and `/rankings/coding-harnesses` show the harness
 *   board (D51); `/rankings/models` and `/rankings/productivity-tools` the others.
 * What: `rankingListMetadata()` builds the title, description, Open Graph image and
 *   the localized canonical and hreflang for the list's canonical path
 *   (`rankingListPath()`), and adds `robots: noindex` when `/api/rankings` reports the
 *   list not indexable: below 10 entries (D53), or the models list at any size. An unknown entry count (a non-OK or thrown read,
 *   or a response without `list_meta`) is noindex as well, on every list including
 *   `/rankings`: a thin list must never render indexable. `RankingListPage`
 *   renders the list navigation, the D54 provisional note for productivity, the
 *   D53 short-list note, and the grid seeded with the list's rows.
 *   The rankings fetch keeps `getUrl()`, which must reach this deployment's own API
 *   on previews (#153); the default list keeps the unqualified `/api/rankings` URL.
 * Test: `tests/unit/ranking-list-pages-186.test.tsx`,
 *   `tests/unit/seo-canonical-origin.test.ts` (the `/rankings` page).
 */

interface ListBoardResponse {
  rankings: Array<{ tool?: { name?: string }; name?: string; updated_at?: string }>;
  meta: RankingListMeta | null;
}

/** #186: `/api/rankings` for a list on this deployment; the default list keeps the bare URL. */
function rankingsApiUrl(list: RankingList, devTimestamp?: number): string {
  const params = new URLSearchParams();
  if (list !== DEFAULT_RANKING_LIST) params.set("list", list);
  if (devTimestamp !== undefined) params.set("_t", String(devTimestamp));
  const query = params.toString();
  return `${getUrl()}/api/rankings${query ? `?${query}` : ""}`;
}

async function fetchListBoard(list: RankingList, purpose: "metadata" | "page"): Promise<ListBoardResponse> {
  const isDev = process.env["NODE_ENV"] === "development";
  try {
    const url = rankingsApiUrl(list, purpose === "page" && isDev ? Date.now() : undefined);
    const response = await fetch(url, {
      next: { revalidate: isDev ? 0 : 300 },
      ...(purpose === "page" ? { cache: isDev ? ("no-store" as const) : ("default" as const) } : {}),
    });
    if (!response.ok) return { rankings: [], meta: null };
    const data = await response.json();
    return { rankings: data.rankings || [], meta: data.list_meta ?? null };
  } catch (error) {
    loggers.ranking.error("Failed to fetch rankings on server", { error, list });
    return { rankings: [], meta: null };
  }
}

const LIST_SEO: Record<RankingList, { heading: string; ogTitle: string; fallbackDescription: string; keywords: string[] }> = {
  harness: {
    heading: "AI Tool Rankings",
    ogTitle: "AI Tool Rankings",
    fallbackDescription:
      "Comprehensive rankings and analysis of leading AI coding tools. Compare performance, features, and adoption metrics.",
    keywords: ["AI tool rankings", "AI assistant comparison", "developer tools", "coding AI", "AI benchmarks"],
  },
  model: {
    heading: "AI Model Rankings",
    ogTitle: "AI Model Rankings",
    fallbackDescription: "Rankings of AI models, compared on capability, adoption and momentum.",
    keywords: ["AI model rankings", "LLM comparison", "AI models", "AI benchmarks"],
  },
  productivity: {
    heading: "AI Productivity Tool Rankings",
    ogTitle: "AI Productivity Tool Rankings",
    fallbackDescription: "Rankings of AI productivity tools, compared on capability, adoption and momentum.",
    keywords: ["AI productivity tools", "AI productivity rankings", "AI assistants"],
  },
};

/** The metadata of one list's page (#186). */
export async function rankingListMetadata(lang: string, list: RankingList): Promise<Metadata> {
  // #153: the rankings fetch keeps getUrl(); SEO URLs come from localizedAlternates().
  const { rankings, meta } = await fetchListBoard(list, "metadata");
  const seo = LIST_SEO[list];

  const topTools = rankings.slice(0, 3).map((tool) => tool.name ?? tool.tool?.name ?? "").filter(Boolean);
  const totalTools = rankings.length;
  let period = "";
  if (rankings[0]?.updated_at) {
    period = new Date(rankings[0].updated_at).toLocaleDateString("en-US", { year: "numeric", month: "long" });
  }

  const ogImageUrl = generateRankingOGImageUrl({
    title: seo.ogTitle,
    period: period || undefined,
    topTools: topTools.length > 0 ? topTools : undefined,
    totalTools: totalTools > 0 ? totalTools : undefined,
  });

  const title = period ? `${seo.heading} - ${period}` : `${seo.heading} - Latest Rankings`;
  const description =
    totalTools > 0
      ? `Latest rankings of ${totalTools} AI tools. See how ${topTools.slice(0, 2).join(", ")} and other leading AI assistants compare.`
      : seo.fallbackDescription;

  // #156: one builder for canonical and og:url, so they cannot disagree.
  // #186: the list's canonical path; /rankings/coding-harnesses canonicalises to /rankings (D51).
  const alternates = localizedAlternates(lang, rankingListPath(list));
  return {
    title,
    description,
    keywords: [...seo.keywords, ...topTools].join(", "),
    openGraph: {
      title,
      description,
      type: "website",
      locale: canonicalLocale(lang), // #156: never an unknown segment
      url: alternates.canonical, // #156: always the canonical
      siteName: "AI Power Rankings",
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: seo.ogTitle }],
    },
    twitter: {
      card: "summary_large_image",
      site: "@aipowerrankings",
      creator: "@aipowerrankings",
      title,
      description,
      images: [ogImageUrl],
    },
    // #155: the helper also keeps the RSS link that replacing the layout's alternates drops.
    // #156: each locale is its own canonical; hreflang lists every locale plus x-default.
    alternates,
    // #186: D53 — a list below 10 entries is noindex. An unknown count (failed or
    // thrown read, or no list_meta) is noindex too: fail closed, for every list.
    // The models list is noindex at any size (NOINDEX_LISTS), whatever the API says.
    ...(meta?.indexable === true && !NOINDEX_LISTS.includes(list) ? {} : { robots: { index: false, follow: true } }),
  };
}

/** One list's ranking page body (#186). */
export async function RankingListPage({ lang, list }: { lang: string; list: RankingList }): Promise<React.JSX.Element> {
  const dict = await getDictionary(lang as Locale);
  const { rankings: initialRankings, meta } = await fetchListBoard(list, "page");
  const listText = dict.rankings.lists;
  const locale = canonicalLocale(lang);

  // Generate structured data
  // #153: JSON-LD names the production origin, never the VERCEL_URL host.
  const structuredDataBaseUrl = siteOrigin();
  const faqSchema = generateRankingFAQSchema();
  const breadcrumbs = [
    { name: "Home", url: "/" },
    { name: "Rankings", url: "/rankings" },
    ...(list === DEFAULT_RANKING_LIST ? [] : [{ name: listText[list].title, url: rankingListPath(list) }]),
  ];
  const breadcrumbSchema = generateBreadcrumbSchema(breadcrumbs, structuredDataBaseUrl);

  return (
    <>
      <Script
        id="faq-schema"
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Safe JSON-LD structured data
        dangerouslySetInnerHTML={{
          __html: createJsonLdScript(faqSchema),
        }}
      />
      <Script
        id="breadcrumb-schema"
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Safe JSON-LD structured data
        dangerouslySetInnerHTML={{
          __html: createJsonLdScript(breadcrumbSchema),
        }}
      />

      <main className="px-3 md:px-6 py-8 max-w-7xl mx-auto">
        {/* #186: one page per list; the navigation names all three. */}
        <nav aria-label={listText.navLabel} className="mb-6 flex flex-wrap gap-2" data-ranking-list={list}>
          {RANKING_LISTS.map((item) => (
            <Link
              key={item}
              href={`/${locale}${rankingListPath(item)}`}
              aria-current={item === list ? "page" : undefined}
              className={`rounded-md border px-3 py-1 text-sm ${
                item === list ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {listText[item].title}
            </Link>
          ))}
        </nav>
        <p className="mb-4 text-muted-foreground">{listText[list].description}</p>

        {/* #186: D54 — the productivity list ships with provisional weights and says so. */}
        {listHasProvisionalNote(list) && (
          <p role="note" data-note="provisional-weights" className="mb-4 rounded-md border px-4 py-3 text-sm">
            {listText.provisionalNote}
          </p>
        )}
        {/* #186: D53 — a short list's tiers are S/A/B by thirds. */}
        {/* The models list has no model metrics yet; it is noindex whatever its size. */}
        {listHasMetricsPendingNote(list) && (
          <p role="note" data-note="metrics-pending" className="mb-4 rounded-md border px-4 py-3 text-sm">
            {listText.modelsMetricsPendingNote}
          </p>
        )}
        {meta && meta.tier_scheme === "thirds" && (
          <p role="note" data-note="short-list" className="mb-4 text-sm text-muted-foreground">
            {listText.smallListNote.replace("{min}", String(INDEX_MIN_ENTRIES))}
          </p>
        )}

        <Suspense
          fallback={
            <div className="flex items-center justify-center h-64">
              <p className="text-muted-foreground">{dict.common.loading}</p>
            </div>
          }
        >
          <RankingsGrid
            lang={lang as Locale}
            dict={dict}
            initialRankings={initialRankings as Parameters<typeof RankingsGrid>[0]["initialRankings"]}
            list={list}
          />
        </Suspense>

        {/* SEO-Optimized Content Sections */}
        <aside className="mt-12 space-y-8" aria-label="Additional information">
          {/* Quick Answer about rankings */}
          <QuickAnswerBox
            question="How are AI tool rankings determined?"
            answer="Our AI tool rankings use <strong>Algorithm v7.6</strong> which evaluates tools across 8 key factors: Agentic Capability, Innovation, Technical Performance, Developer Adoption, Market Traction, Business Sentiment, Development Velocity, and Platform Resilience. Rankings are updated monthly with fresh data from multiple sources."
            type="definition"
          />

          {/* FAQ Section */}
          <FAQSection
            title="AI Tool Rankings FAQ"
            faqs={generalFAQs}
            defaultOpen={["what-are-ai-tool-rankings", "how-are-rankings-calculated"]}
          />
        </aside>
      </main>
    </>
  );
}
