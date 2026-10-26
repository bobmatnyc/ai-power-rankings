/**
 * #305: the rankings header renders its count, algorithm version and "as of" date
 * from the published ranking, in the server HTML.
 *
 * Why: production `/en/rankings` printed "Total Tools 0", a fixed "Algorithm v7.6"
 *   from the dictionaries and no date until a client effect ran.
 * What: renders the grid with `renderToString` (no effects run, as in the server
 *   HTML) and checks the count, the `v<digits>` version and the dates; checks the
 *   version and date helpers; checks every locale's `subtitle`/`asOf` take placeholders;
 *   checks the page hands the API's version and date to the grid.
 * Test: `npx vitest run tests/unit/rankings-header-305.test.tsx`. Made-up tools, no network.
 */
import { readdirSync } from "node:fs";
import path from "node:path";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "../../i18n/dictionaries/en.json";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/en/rankings",
  useSearchParams: () => new URLSearchParams(""),
  useRouter: () => ({ push: () => {}, replace: () => {}, prefetch: () => {} }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("../../components/ui/tool-icon", () => ({ ToolIcon: () => null }));
vi.mock("../../contexts/ranking-changes-context", () => ({
  useRankingChanges: () => ({ changes: null }),
}));
vi.mock("../../i18n/client", () => ({ useI18n: () => ({ dict: en, lang: "en" }) }));

import { RankingListPage } from "../../app/[lang]/rankings/ranking-list-page";
import RankingsGrid from "../../components/ranking/rankings-grid";
import { RankingsStatsCards } from "../../components/ranking/rankings-stats-cards";
import {
  formatAlgorithmVersion,
  formatHeaderDate,
  rankingsAsOf,
  rankingsSubtitle,
} from "../../lib/rankings/header";

const dict = en as never;

function rows(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    rank: i + 1,
    tool: { id: `id-${i}`, slug: `made-up-${i}`, name: `Made Up Tool ${i}`, category: `cat-${i % 2}`, status: "active" },
    scores: { overall: 50 + i },
    metrics: {},
  }));
}

function html(initial: unknown[], header?: { version?: string | null; publishedAt?: string | null }) {
  return renderToString(
    <RankingsGrid lang="en" dict={dict} initialRankings={initial as never} {...(header ? { header } : {})} />
  );
}

/** The text of the stat card titled `title`, from the server HTML. */
function stat(markup: string, title: string): string {
  const m = new RegExp(`${title}</div>.*?<div class="text-2xl font-bold">(.*?)</div>`, "s").exec(markup);
  return m?.[1] ?? "";
}

afterEach(() => vi.unstubAllGlobals());

describe("rankings header in the server HTML (#305)", () => {
  it("counts the board's rows, names the published version and prints the date", () => {
    const markup = html(rows(7), { version: "7.10", publishedAt: "2026-10-21T12:00:00.000Z" });
    expect(stat(markup, "Total Tools")).toBe("7");
    expect(stat(markup, "Last Update")).toBe("Oct 21, 2026");
    expect(markup).toContain("Algorithm v7.10 - Market-validated scoring");
    expect(markup).toContain("Rankings as of October 21, 2026");
    // Other sections still name a fixed version (out of scope here); the header does not.
    expect(markup).toContain(
      '<p class="text-muted-foreground text-lg">Comprehensive rankings of AI coding tools using Algorithm v7.10 - Market-validated scoring</p>'
    );
  });

  it("shows 0, not a placeholder, for a list that is truly empty", () => {
    // The grid loads an empty server list on the client; its stat cards then get zero rows.
    const markup = renderToString(
      <RankingsStatsCards dict={dict} loading={false} totalTools={0} categoriesCount={0} avgScore={0} lastUpdateDate="" />
    );
    expect(stat(markup, "Total Tools")).toBe("0");
    expect(markup).not.toContain("42");
  });

  it("omits the version and the date when the API gave none", () => {
    const markup = html(rows(3));
    expect(stat(markup, "Total Tools")).toBe("3");
    expect(markup).toContain(en.rankings.subtitleNoVersion);
    expect(markup).not.toContain("v1.0");
    expect(markup).not.toContain("Invalid Date");
    expect(markup).not.toContain("Rankings as of");
  });
});

describe("header helpers (#305)", () => {
  it.each([
    ["7.10", "v7.10"],
    ["v1.0", "v1.0"],
    ["V8", "v8"],
    [7.6, "v7.6"],
    ["", null],
    ["beta", null],
    [undefined, null],
  ])("formats version %j as %j", (raw, expected) => {
    expect(formatAlgorithmVersion(raw)).toBe(expected);
  });

  it("returns null for a missing or invalid date", () => {
    expect(formatHeaderDate(null, "en", "long")).toBeNull();
    expect(formatHeaderDate("not a date", "en", "long")).toBeNull();
    expect(formatHeaderDate("2026-10-21T23:30:00Z", "en", "short")).toBe("Oct 21, 2026");
  });

  it("fills placeholders literally, even for a replacement holding a dollar pattern", () => {
    const text = { subtitle: "A {version} B", subtitleNoVersion: "A B", asOf: "On {date}" };
    expect(rankingsSubtitle(text, "$&")).toBe("A $& B");
    expect(rankingsSubtitle(text, null)).toBe("A B");
    expect(rankingsAsOf(text, null)).toBeNull();
  });
});

describe("locale dictionaries (#305)", () => {
  const dir = path.resolve(__dirname, "../../i18n/dictionaries");
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));

  it.each(files)("%s: subtitle takes {version} and has no fixed version", async (file) => {
    const { rankings } = (await import(`../../i18n/dictionaries/${file}`)).default;
    expect(rankings.subtitle).toContain("{version}");
    expect(rankings.subtitle).not.toMatch(/\d/);
    expect(rankings.subtitleNoVersion).not.toMatch(/\d|\{/);
    expect(rankings.asOf).toContain("{date}");
  });
});

describe("the list page (#305)", () => {
  it("hands the API's algorithm.version and published_at to the grid", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          rankings: rows(2),
          list_meta: { list: "harness", entry_count: 2, indexable: false, tier_scheme: "thirds" },
          published_at: "2026-10-21T12:00:00.000Z",
          algorithm: { version: "7.10" },
        })
      )
    );
    const page = await RankingListPage({ lang: "en", list: "harness" });
    const found: ReactElement[] = [];
    const walk = (node: ReactNode): void => {
      if (Array.isArray(node)) return node.forEach(walk);
      if (!isValidElement(node)) return;
      if (node.type === RankingsGrid) found.push(node);
      walk((node.props as { children?: ReactNode }).children);
    };
    walk(page);
    expect(found).toHaveLength(1);
    expect((found[0]?.props as { header: unknown }).header).toEqual({
      version: "7.10",
      publishedAt: "2026-10-21T12:00:00.000Z",
    });
  });
});
