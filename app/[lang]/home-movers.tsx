import Link from "next/link";
import { formatUtcDate } from "@/lib/format-utc-date";
import { canonicalLocale } from "@/lib/seo/alternates";
import { formatRankChange, type MoverRow } from "@/lib/rankings/select-movers";

/**
 * The home page "Biggest movers" strip (#192).
 *
 * Why: the old "Trending Tools" strip claimed "this week", showed risers only,
 * and showed the top 3 tools when nothing moved.
 * What: renders the given up and down lists (already chosen by
 * `selectMovers`) with a signed delta each, under a "since last update" label
 * that names the snapshot date when one is given. With no movers it renders a
 * one-line empty state and no tool names. No hooks, so it renders in the
 * server HTML.
 * Test: `tests/unit/home-movers-192.test.tsx`.
 */

export interface MoversText {
  title: string;
  sinceLastUpdate: string;
  sinceLastUpdateOn: string;
  up: string;
  down: string;
  empty: string;
}

export interface HomeMoverRow extends MoverRow {
  rankChange?: number;
  tool: { id: string; slug?: string; name: string };
}

interface HomeMoversProps {
  up: HomeMoverRow[];
  down: HomeMoverRow[];
  lang: string;
  text: MoversText;
  snapshotDate?: string;
}

function sinceLabel(text: MoversText, lang: string, snapshotDate?: string): string {
  const date = snapshotDate ? new Date(snapshotDate) : null;
  if (!date || Number.isNaN(date.getTime())) return text.sinceLastUpdate;
  // See #192: the raw [lang] segment can be any URL text (`xmlrpc.php`), which
  // `toLocaleDateString` rejects; format in the locale the page renders in.
  const day = formatUtcDate(date, canonicalLocale(lang), { month: "short", day: "numeric", year: "numeric" });
  return text.sinceLastUpdateOn.replace("{date}", day);
}

function MoverList({
  heading,
  rows,
  lang,
  tone,
}: {
  heading: string;
  rows: HomeMoverRow[];
  lang: string;
  tone: string;
}) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-foreground mb-3">{heading}</h3>
      <ul className="space-y-2 pl-0 mb-0">{/* globals.css indents every ul */}
        {rows.map((row) => (
          <li key={row.tool.id}>
            <Link
              href={`/${lang}/tools/${row.tool.slug || row.tool.id}`}
              className="flex items-center justify-between gap-3 bg-card border rounded-lg p-4 hover:shadow-lg transition-shadow"
            >
              <span className="font-semibold text-foreground">{row.tool.name}</span>
              <span className="flex items-center gap-3 text-sm">
                <span className="text-muted-foreground">#{row.rank}</span>
                <span className={`font-semibold ${tone}`}>{formatRankChange(row.rankChange ?? 0)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HomeMovers({ up, down, lang, text, snapshotDate }: HomeMoversProps) {
  return (
    <section aria-labelledby="home-movers-heading" className="px-3 md:px-6 py-12 bg-muted/30">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h2 id="home-movers-heading" className="text-3xl font-bold text-foreground mb-2">
            {text.title}
          </h2>
          <p className="text-muted-foreground">{sinceLabel(text, lang, snapshotDate)}</p>
        </div>
        {up.length === 0 && down.length === 0 ? (
          <p className="text-muted-foreground">{text.empty}</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-3 md:gap-6">
            {up.length > 0 && <MoverList heading={text.up} rows={up} lang={lang} tone="text-ds-rank-up" />}
            {down.length > 0 && (
              <MoverList heading={text.down} rows={down} lang={lang} tone="text-ds-rank-down" />
            )}
          </div>
        )}
      </div>
    </section>
  );
}
