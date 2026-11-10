import type { Metadata } from "next";
import Link from "next/link";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { INDEX_MIN_ENTRIES, listHasProvisionalNote, RANKING_LISTS, rankingListPath } from "@/lib/rankings/lists";
import { FACTOR_KEYS, loadCheckedInScoringProfiles } from "@/lib/scoring-profiles";
import { isModelPageVisible, visibleRankingLists } from "@/lib/rankings/model-page-visibility";
import { canonicalLocale, localizedAlternates } from "@/lib/seo/alternates";

/**
 * `/<locale>/methodology`: how the v8 rankings work (#185).
 *
 * Why: #185 activates v8: one ranking per list (#186) and one scoring profile per kind.
 *   The methodology page must say so in every locale and publish the factor tables,
 *   the productivity provisional-weights note and the open-weight rule.
 *   It replaces the English-only v7.6 markdown page.
 * What: the text comes from the `methodologyV8` dictionary block and the list names
 *   from `rankings.lists`; the list links omit the models page while it is hidden, or when
 *   the visibility read throws (D6e). The weight tables are read from the checked-in
 *   `config/scoring-profiles.json` (set `METHODOLOGY_PROFILE_SET`), one table per list
 *   in `FACTOR_KEYS` order, so the page cannot drift from the published weights. It
 *   names no tool and shows no rank or score. Metadata: a self canonical and one
 *   hreflang per locale plus x-default (`localizedAlternates()`), `og:locale` the page
 *   locale.
 * Test: `tests/unit/methodology-v8-185.test.tsx`, `tests/unit/seo-canonical-origin.test.ts`,
 *   `tests/unit/model-page-visibility-d6e.test.tsx`.
 */

/** #185: the profile set this page explains. Not exported: a page module exports only Next.js names. */
const METHODOLOGY_PROFILE_SET = "v8.0";

// #368: no force-dynamic; Clerk no longer runs on this page, and the body is repo content.

interface PageProps {
  params: Promise<{ lang: string }>;
}

// D6e (#401): the models link reads the model-visibility gate from the database, which is
// unavailable at build, so the page is ISR: no prerendered locale, regenerated every 300 s.
export const revalidate = 300;
export function generateStaticParams(): Array<{ lang: string }> {
  return [];
}

const version = (): string => METHODOLOGY_PROFILE_SET.replace(/^v/, "");

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { lang } = await params;
  const text = (await getDictionary(canonicalLocale(lang) as Locale)).methodologyV8;
  // #185: a translated page: self canonical and hreflang for every locale.
  const alternates = localizedAlternates(lang, "/methodology");
  const title = text.metaTitle.replace("{version}", version());
  // D6e: the meta and OG description must not say models are ranked while the page is hidden.
  const description = (await isModelPageVisible()) ? text.metaDescription : text.metaDescriptionModelsPending;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      url: alternates.canonical,
      locale: canonicalLocale(lang),
      siteName: "AI Power Rankings",
    },
    alternates,
  };
}

/** A weight as a percentage in the page's locale, e.g. 0.17 -> "17%". */
function percent(weight: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 2 }).format(weight);
}

export default async function MethodologyPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { lang } = await params;
  const locale = canonicalLocale(lang);
  const dict = await getDictionary(locale as Locale);
  const text = dict.methodologyV8;
  const lists = dict.rankings.lists;
  const set = loadCheckedInScoringProfiles().profileSets[METHODOLOGY_PROFILE_SET];
  if (!set) throw new Error(`methodology: no profile set ${METHODOLOGY_PROFILE_SET}`);
  // D6e: hide model page until model metrics land
  const linkedLists = await visibleRankingLists();

  return (
    <main className="container mx-auto p-4 md:p-8 max-w-4xl" data-methodology-version={version()}>
      <article className="prose prose-lg dark:prose-invert max-w-none">
        <h1>{text.title}</h1>
        <p>{text.intro.replace("{version}", version())}</p>

        <h2>{linkedLists.includes("model") ? text.listsHeading : text.listsHeadingModelsPending}</h2>
        {/* D6e: do not say models are ranked while the models page is hidden. */}
        <p>{linkedLists.includes("model") ? text.listsBody : text.listsBodyModelsPending}</p>
        <ul>
          {linkedLists.map((list) => (
            <li key={list}>
              <Link href={`/${locale}${rankingListPath(list)}`}>{lists[list].title}</Link>
            </li>
          ))}
        </ul>
        <p>{text.listsDefault}</p>
        <p>{text.listsExcluded}</p>
        <p>{text.smallLists.replace("{min}", String(INDEX_MIN_ENTRIES))}</p>

        <h2>{text.profilesHeading}</h2>
        <p>{text.profilesBody}</p>
        {RANKING_LISTS.map((list) => {
          const profile = set.profiles[list];
          if (!profile) throw new Error(`methodology: set ${METHODOLOGY_PROFILE_SET} has no ${list} profile`);
          return (
            <section key={list} data-profile={list}>
              <h3>{lists[list].title}</h3>
              {/* #185: the productivity profile is provisional and says so. */}
              {listHasProvisionalNote(list) && (
                <p role="note" data-note="provisional-weights">
                  {text.provisionalNote}
                </p>
              )}
              <table>
                <thead>
                  <tr>
                    <th scope="col">{text.factorHeader}</th>
                    <th scope="col">{text.weightHeader}</th>
                  </tr>
                </thead>
                <tbody>
                  {FACTOR_KEYS.map((factor) => (
                    <tr key={factor} data-factor={factor}>
                      <td>{text.factors[factor]}</td>
                      <td>{percent(profile.weights[factor], locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          );
        })}
        <p>{text.openWeight}</p>

        <h2>{text.tiesHeading}</h2>
        <p>{text.tiesBody.replace("{version}", version())}</p>

        <h2>{text.dataHeading}</h2>
        <p>{text.dataBody}</p>
      </article>
    </main>
  );
}
