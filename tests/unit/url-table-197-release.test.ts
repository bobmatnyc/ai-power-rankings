import { describe, expect, it } from "vitest";

/**
 * #197: the model-family 308 rows of the #191 URL table are released.
 *
 * Why: the D91 family pages (claude-opus, claude-sonnet, glm, kimi) now exist, so
 *   the rows held behind the #197 `PENDING_TARGETS` entry must 308 like every other
 *   shipped row, each in one hop to a live, indexable family page. D6e: the D58
 *   per-major pages (claude-opus-4, claude-sonnet-4, kimi-2, deepseek-base) render too,
 *   so the six re-pointed aliases ship their 308 as well.
 * What: counts the rows whose destination is a family page (exactly 70: seven
 *   retired slugs in every locale), asserts none is held and each resolves to its
 *   target, checks the six D58 aliases 308 once in every locale, walks every family
 *   and alias row (deepseek-v3-2 included) for a chain, a loop, a wrong target or a
 *   noindex target, and guards each released alias target against being a 308
 *   source or a noindex row of the table.
 * Test: `npx vitest run tests/unit/url-table-197-release.test.ts`. No database, no network.
 */

import { locales } from "../../i18n/config";
import { MODEL_REDIRECT_REPOINTS } from "../../lib/db/repositories/model-redirect-repoint";
import {
  URL_TABLE_ROWS,
  isNoindexToolSlug,
  isPendingTarget,
  isTableRedirectSource,
  resolveTableRedirect,
} from "../../lib/seo/url-table";

// D58: each retired slug now lands on the row of its own major. GLM 5 is the glm row's current
// major, so the two GLM 5.0 slugs keep it; the others move to their per-major row.
const FAMILY_OF: Readonly<Record<string, string>> = {
  "opus-4-6": "claude-opus-4",
  "opus-4-5": "claude-opus-4",
  "sonnet-4-5": "claude-sonnet-4",
  "glm-5-0": "glm",
  "zhipu-glm-5-0": "glm",
  "kimi-2-5": "kimi-2",
  "moonshot-kimi-2-5": "kimi-2",
};
// D6e: every alias of the D58 re-point list, deepseek-v3-2 included, is walked with the family rows.
const TARGET_OF: Readonly<Record<string, string>> = {
  ...FAMILY_OF,
  ...Object.fromEntries(MODEL_REDIRECT_REPOINTS.map((p) => [p.alias, p.to])),
};
const FAMILIES = new Set(Object.values(FAMILY_OF));
const ALIAS_TARGETS = [...new Set(MODEL_REDIRECT_REPOINTS.map((p) => p.to))].sort();
const WALKED_TARGETS = new Set(Object.values(TARGET_OF));
const TOOL_TARGET = /^\/([a-z]{2})\/tools\/([^/?]+)$/;

const redirectRows = URL_TABLE_ROWS.filter((row) => row.action === "308");
const noindexSources = new Set(URL_TABLE_ROWS.filter((row) => row.action === "noindex").map((row) => row.source));
const targetOf = (row: { destination: string }) => TOOL_TARGET.exec(row.destination)?.[2] ?? "";
const familyRows = redirectRows.filter((row) => FAMILIES.has(targetOf(row)));
const walkedRows = redirectRows.filter((row) => WALKED_TARGETS.has(targetOf(row)));
const redirectSources = new Set(redirectRows.map((row) => row.source));

describe("#197 family rows", () => {
  it("are exactly the 70 rows the hold blocked, and none is held now", () => {
    expect(familyRows).toHaveLength(70);
    expect(familyRows.filter((row) => isPendingTarget(row.destination))).toHaveLength(0);
    expect(familyRows.filter((row) => isTableRedirectSource(row.source))).toHaveLength(70);
  });

  it("cover each of the seven retired slugs in every locale", () => {
    for (const locale of locales) {
      for (const [slug, family] of Object.entries(FAMILY_OF)) {
        const source = `/${locale}/tools/${slug}`;
        expect(resolveTableRedirect(source), source).toBe(`/${locale}/tools/${family}`);
      }
    }
  });

  // D6e: released; the 50 per-major rows held until this release now ship like the 20 glm rows.
  it("the 50 per-major rows are released: none pending, each a shipped 308 source", () => {
    const perMajor = familyRows.filter((row) => targetOf(row) !== "glm");
    expect(perMajor).toHaveLength(50);
    for (const row of perMajor) {
      expect(isPendingTarget(row.destination), row.source).toBe(false);
      expect(isTableRedirectSource(row.source), row.source).toBe(true);
      expect(resolveTableRedirect(row.source), row.source).toBe(row.destination);
    }
  });
});

// D6e: released; each of the six re-pointed aliases answers one 308 to its per-major target in every
// locale, and the Q-A85-1 pattern rule reaches that target in the same single hop.
describe("D58 aliases released to their per-major target (D6e)", () => {
  it.each(MODEL_REDIRECT_REPOINTS.map((p) => [p.alias, p.to] as const))("%s 308s once to %s in every locale", (alias, to) => {
    for (const locale of locales) {
      const source = `/${locale}/tools/${alias}`;
      const row = redirectRows.find((r) => r.source === source);
      expect(row?.destination, source).toBe(`/${locale}/tools/${to}`);
      expect(isPendingTarget(row?.destination ?? ""), source).toBe(false);
      expect(isTableRedirectSource(source), source).toBe(true);
      expect(resolveTableRedirect(source), source).toBe(`/${locale}/tools/${to}`);
    }
    expect(resolveTableRedirect(`/old/tools/${alias}`)).toBe(`/en/tools/${to}`);
  });
});

// D6e: the per-row one-hop walk over the 70 family rows and the 10 deepseek-v3-2 rows.
describe("every released family and alias row", () => {
  it("is the 70 family rows plus the 10 deepseek-v3-2 rows", () => {
    expect(walkedRows).toHaveLength(80);
    expect(walkedRows.filter((row) => targetOf(row) === "deepseek-base")).toHaveLength(10);
  });

  it.each(walkedRows.map((row) => [row.source, row.destination]))(
    "%s -> %s is one hop to a live, indexable target page",
    (source, destination) => {
      const [, sourceLocale, , slug] = source.split("/");
      const [, targetLocale, target] = TOOL_TARGET.exec(destination) ?? [];
      expect(targetLocale).toBe(sourceLocale);
      expect(target).toBe(TARGET_OF[slug ?? ""]);
      expect(resolveTableRedirect(source)).toBe(destination);
      // No chain and no loop: the target is not itself a redirect source.
      expect(redirectSources.has(destination)).toBe(false);
      expect(resolveTableRedirect(destination)).toBeNull();
      expect(isNoindexToolSlug(target ?? "")).toBe(false);
    }
  );
});

// D6e: a released alias target that is itself a 308 source would make a two-hop chain, and a
// noindex target would send the alias's links to a page out of the index (#335 review, MEDIUM).
describe("released alias targets (D6e guard)", () => {
  it.each(ALIAS_TARGETS.map((to) => [to]))("%s is not a 308 source and not a noindex row", (to) => {
    expect(isNoindexToolSlug(to), to).toBe(false);
    for (const locale of locales) {
      const page = `/${locale}/tools/${to}`;
      expect(redirectSources.has(page), `${page} is a 308 source`).toBe(false);
      expect(isTableRedirectSource(page), `${page} is a shipped 308 source`).toBe(false);
      expect(resolveTableRedirect(page), page).toBeNull();
      expect(noindexSources.has(page), `${page} is a noindex row`).toBe(false);
    }
  });
});
