import type { ReactNode } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import type { ToolChange, ToolProfile } from "@/lib/tools/tool-profile";
import { cn } from "@/lib/utils";

/**
 * The tool page's server-rendered profile block (#193).
 *
 * Why: the rest of the tool page renders in the browser, so crawlers and
 * no-JS visitors saw only "Loading". This block is in the server HTML.
 * What: four sections, always present and in this order: Verdict, Score and
 * rank, Change since last month, Alternatives. Missing data renders a fixed
 * English sentence, never an empty or absent section. Design tokens only.
 * Test: `tests/unit/tool-profile-193.test.tsx`.
 */

export const PROFILE_HEADINGS = ["Verdict", "Score and rank", "Change since last month", "Alternatives"] as const;

export const PROFILE_TEXT = {
  noVerdict: (name: string) => `${name} has no published description yet, so there is no verdict to show.`,
  unavailable: "Ranking data is unavailable right now. Try again later.",
  unranked: (name: string) => `${name} is not in the current rankings.`,
  unrankedChange: "Not in the current rankings, so there is no change to show.",
  noHistory: (period: string) => `No earlier ranking period to compare with ${period} yet.`,
  newEntry: (previousPeriod: string) => `New this month: not ranked in ${previousPeriod}.`,
  scoreHidden: (from: string, to: string) =>
    `Score change not shown: the ${from} and ${to} algorithm versions score differently.`,
  noAlternatives: "No other active tools in this category are ranked yet.",
} as const;

interface ToolProfileSectionsProps {
  name: string;
  lang: string;
  profile: ToolProfile;
}

/** "2026-10" → "October 2026"; any other period string is shown as stored. */
export function formatPeriod(period: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) return period;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

const score1 = (score: number): string => score.toFixed(1);
const places = (n: number): string => `${n} ${n === 1 ? "place" : "places"}`;
const signed = (n: number): string => (n > 0 ? `+${score1(n)}` : score1(n));

function Section({ id, heading, children }: { id: string; heading: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} data-profile-section={heading} className="space-y-1">
      <h2 id={id} className="text-lg font-semibold text-foreground">
        {heading}
      </h2>
      {children}
    </section>
  );
}

const Muted = ({ children }: { children: ReactNode }) => <p className="text-muted-foreground">{children}</p>;

function ChangeBody({ change }: { change: ToolChange }) {
  switch (change.kind) {
    case "unavailable":
      return <Muted>{PROFILE_TEXT.unavailable}</Muted>;
    case "unranked":
      return <Muted>{PROFILE_TEXT.unrankedChange}</Muted>;
    case "no-history":
      return <Muted>{PROFILE_TEXT.noHistory(formatPeriod(change.period))}</Muted>;
    case "new":
      return <Muted>{PROFILE_TEXT.newEntry(formatPeriod(change.previousPeriod))}</Muted>;
    case "moved": {
      const { rankDelta, scoreDelta } = change;
      const tone = rankDelta > 0 ? "text-ds-rank-up" : rankDelta < 0 ? "text-ds-rank-down" : "text-ds-rank-steady";
      const rankText =
        rankDelta > 0
          ? `Up ${places(rankDelta)}`
          : rankDelta < 0
            ? `Down ${places(-rankDelta)}`
            : "No change in rank";
      return (
        <>
          <p data-profile-rank-delta={rankDelta}>
            <span className={cn("font-medium", tone)}>{rankText}</span>{" "}
            <span className="text-muted-foreground">
              (#{change.previousRank} in {formatPeriod(change.previousPeriod)}, #{change.rank} in{" "}
              {formatPeriod(change.period)})
            </span>
          </p>
          {scoreDelta === null ? (
            <Muted>{PROFILE_TEXT.scoreHidden(change.previousAlgorithmVersion, change.algorithmVersion)}</Muted>
          ) : (
            <p data-profile-score-delta={scoreDelta} className="text-muted-foreground">
              Score {signed(scoreDelta)} since {formatPeriod(change.previousPeriod)}.
            </p>
          )}
        </>
      );
    }
  }
}

export function ToolProfileSections({ name, lang, profile }: ToolProfileSectionsProps) {
  const { verdict, standing, change, alternatives } = profile;
  return (
    // #193: static block; the Card's hover lift is for clickable cards.
    <Card data-tool-profile className="mb-8 hover:translate-y-0 hover:shadow-sm">
      <CardContent className="space-y-6 p-6">
        <Section id="tool-profile-verdict" heading={PROFILE_HEADINGS[0]}>
          {verdict ? <p className="text-foreground">{verdict}</p> : <Muted>{PROFILE_TEXT.noVerdict(name)}</Muted>}
        </Section>

        <Section id="tool-profile-score" heading={PROFILE_HEADINGS[1]}>
          {standing.kind === "ranked" ? (
            <p className="text-foreground">
              <span className="font-medium text-primary">#{standing.rank}</span> of {standing.total} with a score of{" "}
              <span className="font-medium">{score1(standing.score)}</span>{" "}
              <span className="text-muted-foreground">({formatPeriod(standing.period)} rankings)</span>
            </p>
          ) : (
            <Muted>{standing.kind === "unranked" ? PROFILE_TEXT.unranked(name) : PROFILE_TEXT.unavailable}</Muted>
          )}
        </Section>

        <Section id="tool-profile-change" heading={PROFILE_HEADINGS[2]}>
          <ChangeBody change={change} />
        </Section>

        <Section id="tool-profile-alternatives" heading={PROFILE_HEADINGS[3]}>
          {alternatives === null ? (
            <Muted>{PROFILE_TEXT.unavailable}</Muted>
          ) : alternatives.length === 0 ? (
            <Muted>{PROFILE_TEXT.noAlternatives}</Muted>
          ) : (
            <ul className="space-y-1">
              {alternatives.map((alt) => (
                <li key={alt.slug} data-profile-alternative={alt.slug}>
                  <Link href={`/${lang}/tools/${alt.slug}`} className="font-medium text-primary hover:underline">
                    {alt.name}
                  </Link>{" "}
                  <span className="text-muted-foreground">
                    #{alt.rank}, score {score1(alt.score)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </CardContent>
    </Card>
  );
}
