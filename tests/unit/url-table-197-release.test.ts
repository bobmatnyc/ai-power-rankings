import { describe, expect, it } from "vitest";

/**
 * #197: the model-family 308 rows of the #191 URL table are released.
 *
 * Why: the D91 family pages (claude-opus, claude-sonnet, glm, kimi) now exist, so
 *   the rows held behind the #197 `PENDING_TARGETS` entry must 308 like every other
 *   shipped row, each in one hop to a live, indexable family page.
 * What: counts the rows whose destination is a family page (exactly 70: seven
 *   retired slugs in every locale). D6e: the 50 rows re-pointed to a per-major page are
 *   held (no 308) until the release PR; the 20 glm rows are released and each resolves to
 *   its family page. Walks every released row for a chain, a loop, a non-family target or
 *   a noindex target, and checks the six D58 aliases answer no 308 in any locale.
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
// D6e: the per-major targets are held in PENDING_TARGETS until the release PR; glm is released.
const HELD_TARGETS = new Set(["claude-opus-4", "claude-sonnet-4", "kimi-2"]);
const FAMILIES = new Set(Object.values(FAMILY_OF));
const FAMILY_TARGET = /^\/([a-z]{2})\/tools\/([^/?]+)$/;

const redirectRows = URL_TABLE_ROWS.filter((row) => row.action === "308");
const familyRows = redirectRows.filter((row) => {
  const match = FAMILY_TARGET.exec(row.destination);
  return match !== null && FAMILIES.has(match[2] ?? "");
});
const targetOf = (row: { destination: string }) => FAMILY_TARGET.exec(row.destination)?.[2] ?? "";
const heldRows = familyRows.filter((row) => HELD_TARGETS.has(targetOf(row)));
const releasedRows = familyRows.filter((row) => !HELD_TARGETS.has(targetOf(row)));
const redirectSources = new Set(redirectRows.map((row) => row.source));

describe("#197 family rows", () => {
  it("are the 70 rows of the seven retired slugs: 50 held for D6e, 20 released", () => {
    expect(familyRows).toHaveLength(70);
    expect(heldRows).toHaveLength(50);
    expect(releasedRows).toHaveLength(20);
  });

  it("released: none is held, each ships and resolves to its family page in every locale", () => {
    expect(releasedRows.filter((row) => isPendingTarget(row.destination))).toHaveLength(0);
    expect(releasedRows.filter((row) => isTableRedirectSource(row.source))).toHaveLength(20);
    for (const locale of locales) {
      for (const [slug, family] of Object.entries(FAMILY_OF)) {
        if (HELD_TARGETS.has(family)) continue;
        const source = `/${locale}/tools/${slug}`;
        expect(resolveTableRedirect(source), source).toBe(`/${locale}/tools/${family}`);
      }
    }
  });

  // D6e: held until the release PR removes the PENDING_TARGETS entry.
  it("held: every row is pending, ships no 308 and is not a redirect source", () => {
    expect(heldRows.filter((row) => !isPendingTarget(row.destination))).toHaveLength(0);
    for (const row of heldRows) {
      expect(isTableRedirectSource(row.source), row.source).toBe(false);
      expect(resolveTableRedirect(row.source), row.source).toBeNull();
    }
  });
});

// D6e: the six re-pointed aliases answer no 308 in any locale while their per-major target is
// pending; a 308 to a page that does not exist yet is the failure this guards against.
describe("D58 aliases held while their target is pending (D6e)", () => {
  it.each(MODEL_REDIRECT_REPOINTS.map((p) => [p.alias, p.to] as const))("%s (target %s) answers no 308 in any locale", (alias, to) => {
    for (const locale of locales) {
      const source = `/${locale}/tools/${alias}`;
      const row = redirectRows.find((r) => r.source === source);
      expect(row?.destination, source).toBe(`/${locale}/tools/${to}`);
      expect(isPendingTarget(row!.destination), source).toBe(true);
      expect(resolveTableRedirect(source), source).toBeNull();
      // The pattern rule must not reach the held row through a non-locale prefix either.
      expect(resolveTableRedirect(`/old/tools/${alias}`), source).toBeNull();
    }
  });
});

describe("every released family row", () => {
  it.each(releasedRows.map((row) => [row.source, row.destination]))(
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
