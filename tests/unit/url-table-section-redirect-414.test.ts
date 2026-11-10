import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

/**
 * #414: an unprefixed section path keeps its section when it is localized.
 *
 * Why: the #191 Q-A85-1 rule stripped the first segment of every unprefixed
 *   path, so `/tools/cursor` 308'd to `/en/cursor`, a 404.
 * What: `/tools/<slug>` and `/news/<slug>` resolve to `/en/<full path>` in one
 *   hop, through the middleware too; a table row still wins; every row of
 *   `data/url-table-191.json` resolves as it did at a6d18bef
 *   (`tests/fixtures/url-table-191-resolution-414.json`); `LOCALIZED_SECTIONS`
 *   equals the `app/[lang]` route directories.
 * Test: `npx vitest run tests/unit/url-table-section-redirect-414.test.ts`.
 */

vi.mock("@clerk/nextjs/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@clerk/nextjs/server")>();
  const { fakeClerkMiddleware } = await import("./helpers/clerk-middleware-harness");
  return { ...actual, clerkMiddleware: fakeClerkMiddleware };
});

import expected from "../fixtures/url-table-191-resolution-414.json";
import { locales } from "../../i18n/config";
import {
  LOCALIZED_SECTIONS,
  URL_TABLE_ROWS,
  resolveHeldSourcePage,
  resolveTableRedirect,
} from "../../lib/seo/url-table";
import { runMiddleware } from "./helpers/clerk-middleware-harness";

const anonymousAuth = vi.fn(async () => ({ userId: null, sessionId: null }));
const pathOf = (url: string) => url.split("?")[0] ?? url;

async function run(path: string): Promise<Response> {
  return runMiddleware(anonymousAuth, new NextRequest(`http://localhost${path}`));
}

/** URL-level first segments under `app/[lang]`: route groups are flattened, dynamic segments skipped. */
function sectionDirectories(dir: string): string[] {
  return readdirSync(dir)
    .filter((name) => statSync(join(dir, name)).isDirectory() && !name.startsWith("["))
    .flatMap((name) => (name.startsWith("(") ? sectionDirectories(join(dir, name)) : [name]));
}

describe("#414 unprefixed section paths", () => {
  it("keep the section segment", () => {
    expect(resolveTableRedirect("/tools/cursor")).toBe("/en/tools/cursor");
    expect(resolveTableRedirect("/news/some-article")).toBe("/en/news/some-article");
    expect(resolveTableRedirect("/rankings/models")).toBe("/en/rankings/models");
    expect(resolveTableRedirect("/tools/cursor/")).toBe("/en/tools/cursor");
  });

  it("308 once through the middleware", async () => {
    const res = await run("/tools/cursor");
    expect(res.status).toBe(308);
    expect(res.headers.get("location")).toBe("http://localhost/en/tools/cursor");
  });

  it("let a table row win: an old alias goes straight to its literal target", () => {
    expect(resolveTableRedirect("/tools/openai-codex-cli")).toBe("/en/tools/openai-codex");
    for (const lang of locales) {
      expect(resolveTableRedirect(`/${lang}/tools/openai-codex-cli`)).toBe(`/${lang}/tools/openai-codex`);
    }
  });

  // #417: bare `/tools` and `/news` now 308; see url-table-bare-section-417.test.ts.
  it("leave locale-prefixed and reserved paths alone", () => {
    for (const path of ["/en/tools/cursor", "/sign-in/factor-one", "/api/tools/cline"]) {
      expect(resolveTableRedirect(path), path).toBeNull();
    }
  });

  it("list exactly the app/[lang] route directories", () => {
    const appLang = join(__dirname, "..", "..", "app", "[lang]");
    expect([...LOCALIZED_SECTIONS].sort()).toEqual(sectionDirectories(appLang).sort());
  });
});

describe("#414 every table row resolves as before", () => {
  it("covers every row of the table", () => {
    expect(expected.map((row) => row.source)).toEqual(URL_TABLE_ROWS.map((row) => row.source));
  });

  it.each(expected.map((row) => [row.source, row] as const))("%s", (source, row) => {
    const path = pathOf(source);
    expect(resolveTableRedirect(path)).toBe(row.redirect);
    expect(resolveHeldSourcePage(path)).toBe(row.heldPage);
    if (row.redirect) expect(resolveTableRedirect(pathOf(row.redirect))).toBeNull();
  });
});
