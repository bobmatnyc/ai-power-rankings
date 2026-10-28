import { describe, expect, it } from "vitest";

/**
 * #197: the model-family 308 rows of the #191 URL table are released.
 *
 * Why: the D91 family pages (claude-opus, claude-sonnet, glm, kimi) now exist, so
 *   the rows held behind the #197 `PENDING_TARGETS` entry must 308 like every other
 *   shipped row, each in one hop to a live, indexable family page.
 * What: counts the rows whose destination is a family page (exactly 70: seven
 *   retired slugs in every locale), asserts none is held and each resolves to its
 *   family page, and walks every released row for a chain, a loop, a non-family
 *   target or a noindex target.
 * Test: `npx vitest run tests/unit/url-table-197-release.test.ts`. No database, no network.
 */

import { locales } from "../../i18n/config";
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
const FAMILIES = new Set(Object.values(FAMILY_OF));
const FAMILY_TARGET = /^\/([a-z]{2})\/tools\/([^/?]+)$/;

const redirectRows = URL_TABLE_ROWS.filter((row) => row.action === "308");
const familyRows = redirectRows.filter((row) => {
  const match = FAMILY_TARGET.exec(row.destination);
  return match !== null && FAMILIES.has(match[2] ?? "");
});
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
});

describe("every released family row", () => {
  it.each(familyRows.map((row) => [row.source, row.destination]))(
    "%s -> %s is one hop to a live, indexable family page",
    (source, destination) => {
      const [, sourceLocale, , slug] = source.split("/");
      const [, targetLocale, family] = FAMILY_TARGET.exec(destination) ?? [];
      expect(targetLocale).toBe(sourceLocale);
      expect(family).toBe(FAMILY_OF[slug ?? ""]);
      expect(resolveTableRedirect(source)).toBe(destination);
      // No chain and no loop: the target is not itself a redirect source.
      expect(redirectSources.has(destination)).toBe(false);
      expect(resolveTableRedirect(destination)).toBeNull();
      expect(isNoindexToolSlug(family ?? "")).toBe(false);
    }
  );
});
