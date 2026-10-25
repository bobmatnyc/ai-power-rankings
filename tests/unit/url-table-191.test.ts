import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * #191: the signed URL table — 308 rows, noindex rows and the held rows.
 *
 * Why: the owner signed the table (D89). Every shipped 308 row must answer one
 *   308 to its destination, every noindex row must carry robots noindex and
 *   leave the sitemap, and a row whose destination page is missing must not move.
 * What: table-driven over the committed path-only map `data/url-table-191.json`
 *   (never the private table): counts, the real middleware handler (Clerk's
 *   wrapper replaced by an identity function) for every 308 row with and
 *   without a #233 search key, the tool-page metadata for every noindex row,
 *   the sitemap, and the `/{lang}/contact` page.
 * Test: `npx vitest run tests/unit/url-table-191.test.ts`. No database, no network.
 */

const { findToolBySlug, findAll, getPublishedSlugs, listPeriods, permanentRedirect, redirect } =
  vi.hoisted(() => ({
    findToolBySlug: vi.fn(),
    findAll: vi.fn(),
    getPublishedSlugs: vi.fn(),
    listPeriods: vi.fn(),
    permanentRedirect: vi.fn(),
    redirect: vi.fn(),
  }));

vi.mock("@clerk/nextjs/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@clerk/nextjs/server")>();
  return { ...actual, clerkMiddleware: (handler: unknown) => handler };
});
vi.mock("../../lib/tools/tool-page-request", () => ({ findToolBySlug }));
vi.mock("../../lib/services/whats-new-summary.service", () => ({ listPeriods }));
vi.mock("../../lib/db/repositories/news", () => ({ newsRepository: { getPublishedSlugs } }));
vi.mock("../../lib/db/repositories/tools.repository", () => ({ toolsRepository: { findAll } }));
vi.mock("next/navigation", () => ({ permanentRedirect, redirect }));

import rawRows from "../../data/url-table-191.json";
import { locales } from "../../i18n/config";
import {
  URL_TABLE_ROWS,
  isPendingTarget,
  resolveTableRedirect,
} from "../../lib/seo/url-table";

type Handler = (
  auth: () => Promise<{ userId: string | null; sessionId: string | null }>,
  req: NextRequest
) => Promise<Response>;

const anonymousAuth = vi.fn(async () => ({ userId: null, sessionId: null }));

async function run(path: string, method = "GET"): Promise<Response> {
  const { default: middleware } = await import("../../middleware");
  return (middleware as unknown as Handler)(
    anonymousAuth,
    new NextRequest(`http://localhost${path}`, { method })
  );
}

function location(res: Response): string | null {
  const value = res.headers.get("location");
  return value ? value.replace(/^http:\/\/localhost/, "") : null;
}

function pathOf(url: string): string {
  return url.split("?")[0] ?? url;
}

const redirectRows = URL_TABLE_ROWS.filter((row) => row.action === "308");
const noindexRows = URL_TABLE_ROWS.filter((row) => row.action === "noindex");
const shipped = redirectRows.filter((row) => !isPendingTarget(row.destination));
const held = redirectRows.filter((row) => isPendingTarget(row.destination));
const isLocale = (segment: string) => (locales as readonly string[]).includes(segment);

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_DISABLE_AUTH", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the committed map", () => {
  it("holds the signed table's 308 and noindex counts, path columns only", () => {
    expect(redirectRows).toHaveLength(268);
    expect(noindexRows).toHaveLength(311);
    expect(URL_TABLE_ROWS).toHaveLength(268 + 311);
    for (const row of rawRows as object[]) {
      expect(Object.keys(row).sort()).toEqual(["action", "destination", "source"]);
    }
    expect(new Set(URL_TABLE_ROWS.map((row) => row.source)).size).toBe(URL_TABLE_ROWS.length);
  });

  it("ships every 308 row except those whose destination page is missing", () => {
    expect(shipped).toHaveLength(81);
    expect(held).toHaveLength(187);
    // #198: the 20 /whats-new rows wait for /en/insights.
    expect(held.filter((row) => row.destination === "/en/insights")).toHaveLength(20);
    expect(shipped.length + held.length).toBe(redirectRows.length);
  });

  it("covers the 17 non-locale rows (Q-A85-1) by the pattern rule, not literal rows", () => {
    const patternRows = redirectRows.filter((row) => !isLocale(row.source.split("/")[1] ?? ""));
    expect(patternRows).toHaveLength(17);
  });
});

describe("middleware answers every shipped 308 row", () => {
  it.each(shipped.map((row) => [row.source, row.destination]))(
    "%s -> one 308 to %s",
    async (source, destination) => {
      const res = await run(source);
      expect(res.status).toBe(308);
      expect(location(res)).toBe(destination);
    }
  );

  it.each(shipped.map((row) => [row.source, row.destination]))(
    "%s with a #233 search key still takes one hop to %s",
    async (source, destination) => {
      const sep = source.includes("?") ? "&" : "?";
      const first = await run(`${source}${sep}q=sentinel&utm_source=x`);
      expect(first.status).toBe(308);
      expect(location(first)).toBe(destination);
      // The destination itself is not moved again, by the table or the strip.
      const second = await run(destination);
      expect(second.status).toBe(200);
      expect(location(second)).toBeNull();
    }
  );

  it.each(held.map((row) => [row.source]))("held row %s is served as before", async (source) => {
    const res = await run(source);
    expect(res.status).toBe(200);
    expect(location(res)).toBeNull();
  });

  it("strips a search key from a held source with the #233 308 alone", async () => {
    const res = await run("/de/best-ai-code-editors?q=sentinel&sort=score");
    expect(res.status).toBe(308);
    expect(location(res)).toBe("/de/best-ai-code-editors?sort=score");
  });

  it("answers HEAD and leaves POST alone", async () => {
    expect((await run("/de/tools/clawdbot", "HEAD")).status).toBe(308);
    expect((await run("/de/tools/clawdbot", "POST")).status).toBe(200);
  });

  it.each(["/xx/dashboard/rankings", "/tech/admin", "/%61%70%69/%61%64%6d%69%6e/news"])(
    "keeps the sign-in or 401 answer for protected %s (#228)",
    async (path) => {
      const res = await run(path);
      expect(location(res) ?? "").not.toMatch(/^\/en\//);
      expect(anonymousAuth).toHaveBeenCalledTimes(1);
    }
  );

  it("treats a trailing slash like the bare path", async () => {
    expect(location(await run("/en/tools/moltbot/"))).toBe("/en/tools/openclaw");
  });
});

describe("rows and routes the table leaves alone", () => {
  it.each([
    "/", // Q-A85-4: the root redirect is untouched
    "/de/news/some-article", // Q-A85-2: localised news URLs stay
    "/en/rankings?category=other", // Q-A85-5
    "/en/rankings?category=code-editor",
    "/en/tools/cline",
    "/sign-in/factor-one",
    "/api/tools/cline",
    "/data/rankings.json",
    "/_vercel/insights/view",
    "/.well-known/security.txt",
  ])("%s is not a table redirect", (path) => {
    expect(resolveTableRedirect(pathOf(path))).toBeNull();
  });

  it("never applies the pattern rule to a top-level app/ or public/ entry", () => {
    const root = join(__dirname, "..", "..");
    const appRoutes = readdirSync(join(root, "app")).filter(
      (name) => !name.startsWith("[") && statSync(join(root, "app", name)).isDirectory()
    );
    const publicEntries = readdirSync(join(root, "public"));
    for (const name of [...appRoutes, ...publicEntries]) {
      expect(resolveTableRedirect(`/${name}/x`), name).toBeNull();
    }
  });
});

describe("noindex rows", () => {
  it.each(noindexRows.map((row) => [row.source]))("%s carries robots noindex", async (source) => {
    const [, lang, , slug] = source.split("/");
    findToolBySlug.mockResolvedValue({ id: "1", slug, name: slug, category: "other", status: "active", info: {} });
    const { generateToolMetadata } = await import("../../app/[lang]/tools/[slug]/metadata");
    const metadata = await generateToolMetadata(slug as string, lang as string);
    expect(metadata.robots).toMatchObject({ index: false });
  });

  it("leaves a keep tool indexable", async () => {
    findToolBySlug.mockResolvedValue({ id: "1", slug: "cline", name: "Cline", category: "other", status: "active", info: {} });
    const { generateToolMetadata } = await import("../../app/[lang]/tools/[slug]/metadata");
    expect((await generateToolMetadata("cline", "en")).robots).toMatchObject({ index: true });
  });
});

describe("sitemap", () => {
  it("drops noindex tools and shipped 308 sources, keeps the rest", async () => {
    findAll.mockResolvedValue(
      ["cline", "stripe", "ollama", "clawdbot", "opus-4-6"].map((slug) => ({ slug, status: "active" }))
    );
    getPublishedSlugs.mockResolvedValue([]);
    listPeriods.mockResolvedValue([]);
    const { buildSitemapEntries } = await import("../../lib/sitemap");
    const paths = new Set(
      (await buildSitemapEntries("https://aipowerranking.com")).map((e) => new URL(e.url).pathname)
    );
    for (const locale of locales) {
      expect(paths.has(`/${locale}/tools/cline`)).toBe(true);
      expect(paths.has(`/${locale}/tools/stripe`)).toBe(false);
      expect(paths.has(`/${locale}/tools/ollama`)).toBe(false);
      expect(paths.has(`/${locale}/tools/clawdbot`)).toBe(false);
      // Held: its destination (#197) is missing, so the URL is unchanged.
      expect(paths.has(`/${locale}/tools/opus-4-6`)).toBe(true);
    }
    for (const row of noindexRows) expect(paths.has(row.source)).toBe(false);
    for (const row of shipped) expect(paths.has(pathOf(row.source))).toBe(false);
  });
});

describe("/{lang}/contact (Q-A85-4)", () => {
  it("redirects permanently to /{lang}/contact/default", async () => {
    const { default: ContactRedirect } = await import("../../app/[lang]/contact/page");
    await ContactRedirect({ params: Promise.resolve({ lang: "de" }) });
    expect(permanentRedirect).toHaveBeenCalledWith("/de/contact/default");
    expect(redirect).not.toHaveBeenCalled();
  });
});
