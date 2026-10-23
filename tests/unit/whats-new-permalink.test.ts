import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Monthly What's New report permalinks and the index's data path (#54).
 *
 * Why: the `/whats-new` index fetched the relative URL `/api/whats-new/summary`
 * from a server component. A server-side `fetch` cannot resolve a relative URL,
 * so it rejected and every visitor saw "No Monthly Summary Available" while a
 * summary was stored. #54 also adds `/whats-new/<period>` permalinks with
 * their own canonical, JSON-LD and sitemap entries.
 * What: Runs the real pages, summary service, `getDb()`, Drizzle and the Neon
 * HTTP driver. Only the network is replaced: the Neon SQL endpoint is a fake
 * that answers from an in-memory `monthly_summaries` table, and every other URL
 * goes to the real `fetch`, so a relative URL rejects exactly as it does on the
 * server. Covers AC1-AC4, AC6 and AC8 of the #54 plan.
 * Test: `npx vitest run tests/unit/whats-new-permalink.test.ts`. No database,
 * no network.
 */

const ORIGIN = "https://aipowerranking.com";
const DATABASE_URL = "postgresql://fixture:fixture@ep-fixture-54.example.test/fixture";
const NOT_FOUND = { digest: "NEXT_HTTP_ERROR_FALLBACK;404" };

/** A sentence that appears only in the July fixture's markdown. */
const JULY_SENTENCE = "Agentic editors overtook autocomplete plugins in July for the first time.";

interface FixtureRow {
  id: string;
  period: string;
  content: string;
  data_hash: string;
  metadata: Record<string, unknown>;
  generated_at: string;
  created_at: string;
  updated_at: string;
}

const JULY: FixtureRow = {
  id: "00000000-0000-4000-8000-000000000007",
  period: "2026-07",
  content: [
    "# July 2026 in AI coding tools",
    "",
    `${JULY_SENTENCE} The rest of the month was quieter.`,
    "",
    "- **Cursor** held first place",
    "",
    "<script>alert('xss')</script>",
  ].join("\n"),
  data_hash: "hash-07",
  metadata: { model: "fixture-model", article_count: 42, new_tool_count: 3 },
  generated_at: "2026-08-02 06:00:00",
  created_at: "2026-07-31 06:00:00",
  updated_at: "2026-08-02 06:00:00",
};

const JUNE: FixtureRow = {
  ...JULY,
  id: "00000000-0000-4000-8000-000000000006",
  period: "2026-06",
  content: "June hid every tool whose score was < 5 from the table.",
  data_hash: "hash-06",
  generated_at: "2026-06-30 06:00:00",
  created_at: "2026-06-30 06:00:00",
  updated_at: "2026-06-30 06:00:00",
};

/** Postgres type OIDs for the `monthly_summaries` columns. */
const COLUMN_TYPES: Record<string, number> = {
  id: 2950,
  period: 25,
  content: 25,
  data_hash: 25,
  metadata: 3802,
  generated_at: 1114,
  created_at: 1114,
  updated_at: 1114,
};

const db = { rows: [] as FixtureRow[], fail: false, queries: [] as string[] };

/**
 * The Neon SQL-over-HTTP endpoint, answering the three statement shapes the
 * summary service sends: select columns, optional `period = $1`, `period desc`
 * order, optional limit (the last parameter).
 */
function neonEndpoint(body: string): Response {
  const { query, params } = JSON.parse(body) as { query: string; params: string[] };
  db.queries.push(query);
  if (db.fail) return Response.json({ message: "fixture: connection refused" }, { status: 500 });

  const columns = [...(/^select (.*) from "monthly_summaries"/.exec(query)?.[1] ?? "").matchAll(/"(\w+)"(?:,|$)/g)]
    .map((m) => m[1]!);
  let rows = [...db.rows];
  if (/ where "monthly_summaries"\."period" = \$1/.test(query)) rows = rows.filter((r) => r.period === params[0]);
  if (/ order by "monthly_summaries"\."period" desc/.test(query)) rows.sort((a, b) => b.period.localeCompare(a.period));
  if (/ limit \$\d+$/.test(query)) rows = rows.slice(0, Number(params[params.length - 1]));

  return Response.json({
    command: "SELECT",
    rowCount: rows.length,
    fields: columns.map((name) => ({ name, dataTypeID: COLUMN_TYPES[name] })),
    rows: rows.map((row) =>
      columns.map((name) => {
        const value = row[name as keyof FixtureRow];
        return typeof value === "object" ? JSON.stringify(value) : value;
      })
    ),
  });
}

const realFetch = globalThis.fetch;
const fetchSpy = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input);
  if (url === "https://api.example.test/sql") return neonEndpoint(String(init?.body));
  // Everything else, including a relative URL, gets the real server-side fetch.
  return realFetch(input, init);
});

vi.setConfig({ testTimeout: 60_000 });

beforeEach(() => {
  db.rows = [JULY, JUNE];
  db.fail = false;
  db.queries = [];
  fetchSpy.mockClear();
  vi.stubEnv("DATABASE_URL", DATABASE_URL);
  vi.stubEnv("NEXT_PUBLIC_BASE_URL", undefined);
  vi.stubGlobal("fetch", fetchSpy);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const params = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) });

async function renderIndex(lang = "en"): Promise<string> {
  const { default: WhatsNewPage } = await import("../../app/[lang]/whats-new/page");
  return renderToStaticMarkup((await WhatsNewPage(params({ lang }))) as ReactElement);
}

async function renderReport(period: string, lang = "en"): Promise<string> {
  const { default: Page } = await import("../../app/[lang]/whats-new/[period]/page");
  return renderToStaticMarkup((await Page(params({ lang, period }))) as ReactElement);
}

async function reportMetadata(period: string, lang = "en") {
  const { generateMetadata } = await import("../../app/[lang]/whats-new/[period]/page");
  return generateMetadata(params({ lang, period }));
}

function jsonLdBlocks(html: string): string[] {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]!);
}

describe("/whats-new index (#54 AC8)", () => {
  it("renders the stored summary from the server, not the empty state", async () => {
    const html = await renderIndex();

    expect(html).toContain("July 2026");
    expect(html).toContain(JULY_SENTENCE);
    expect(html).not.toContain("No Monthly Summary Available");
    // The summary came through the database driver, not an /api round trip.
    expect(db.queries.length).toBeGreaterThan(0);
    expect(fetchSpy.mock.calls.every(([u]) => String(u) === "https://api.example.test/sql")).toBe(true);
  });

  it("links the latest report's permalink", async () => {
    expect(await renderIndex("de")).toContain('href="/de/whats-new/2026-07"');
  });

  it("shows the empty state only when no summary is stored", async () => {
    db.rows = [];
    expect(await renderIndex()).toContain("No Monthly Summary Available");
  });

  it("fails on a database error instead of claiming no summary exists", async () => {
    db.fail = true;
    await expect(renderIndex()).rejects.toThrow();
  });
});

describe("/whats-new/<period> permalink (#54)", () => {
  it("AC1: renders the month as h1 and the markdown, with raw HTML inert", async () => {
    const html = await renderReport("2026-07");

    expect(html).toContain('<h1 class="text-2xl font-bold mb-2">July 2026</h1>');
    expect(html).toContain("<strong>Cursor</strong>");
    expect(html).toContain(JULY_SENTENCE);
    expect(html).not.toContain("<script>alert");
    expect(html).toContain('href="/en/whats-new/2026-06"'); // Past reports
  });

  it.each(["abc", "2026-13", "2026-7", "2026-07-01", "2026-00"])(
    "AC2: %s is a 404 with no canonical and no database read",
    async (period) => {
      await expect(reportMetadata(period)).rejects.toMatchObject(NOT_FOUND);
      await expect(renderReport(period)).rejects.toMatchObject(NOT_FOUND);
      expect(db.queries).toEqual([]);
    }
  );

  it("AC2: a valid period with no row is a 404, never the latest report", async () => {
    await expect(reportMetadata("2026-05")).rejects.toMatchObject(NOT_FOUND);
    await expect(renderReport("2026-05")).rejects.toMatchObject(NOT_FOUND);
  });

  it("AC2: a database failure is an error, not a 404", async () => {
    db.fail = true;
    const error = await reportMetadata("2026-07").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as { digest?: string }).digest).toBeUndefined();
  });

  it.each(["en", "de", "xx"])("AC3: lang %s canonicalises to the /en permalink", async (lang) => {
    const metadata = await reportMetadata("2026-07", lang);
    const canonical = `${ORIGIN}/en/whats-new/2026-07`;

    expect(metadata.alternates?.canonical).toBe(canonical);
    expect(metadata.alternates?.languages).toBeUndefined();
    expect(String(metadata.openGraph?.url)).toBe(canonical);
    expect(metadata.openGraph).toMatchObject({ locale: "en", type: "article" });
    expect(metadata.title).toEqual({ absolute: "July 2026 | What's New | AI Power Rankings" });
    expect(metadata.description).toBe(JULY_SENTENCE);
  });

  it("AC4: one Article JSON-LD block naming the canonical, with no raw <", async () => {
    // June's first sentence carries a literal `<` into the description.
    const html = await renderReport("2026-06", "fr");
    const blocks = jsonLdBlocks(html);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]).not.toContain("<");
    const article = JSON.parse(blocks[0]!) as Record<string, string>;
    expect(article["@type"]).toBe("Article");
    expect(article["mainEntityOfPage"]).toBe(`${ORIGIN}/en/whats-new/2026-06`);
    expect(article["inLanguage"]).toBe("en");
    expect(article["description"]).toBe("June hid every tool whose score was < 5 from the table.");
    expect(Date.parse(article["dateModified"]!)).toBeGreaterThanOrEqual(Date.parse(article["datePublished"]!));
  });

  it("AC4: dateModified never precedes datePublished", async () => {
    db.rows = [{ ...JULY, generated_at: "2026-07-01 00:00:00", created_at: "2026-07-31 06:00:00" }];
    const article = JSON.parse(jsonLdBlocks(await renderReport("2026-07"))[0]!) as Record<string, string>;
    expect(article["datePublished"]).toBe("2026-07-31T06:00:00.000Z");
    expect(article["dateModified"]).toBe("2026-07-31T06:00:00.000Z");
  });
});

describe("/whats-new index canonical (#54 AC6)", () => {
  it("points at the latest permalink while a report exists, else at itself", async () => {
    const { generateMetadata } = await import("../../app/[lang]/whats-new/page");

    const withReport = await generateMetadata(params({ lang: "ko" }));
    expect(withReport.alternates?.canonical).toBe(`${ORIGIN}/en/whats-new/2026-07`);
    expect(String(withReport.openGraph?.url)).toBe(`${ORIGIN}/en/whats-new/2026-07`);

    db.rows = [];
    const empty = await generateMetadata(params({ lang: "ko" }));
    expect(empty.alternates?.canonical).toBe(`${ORIGIN}/en/whats-new`);
  });
});
