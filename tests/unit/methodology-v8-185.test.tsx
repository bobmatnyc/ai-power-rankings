import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * #185: the v8 methodology page.
 *
 * Why: v8 activation publishes per-list rankings scored by per-kind profiles; the
 *   methodology page must explain that in every locale, publish the factor tables, the
 *   productivity provisional-weights note and the open-weight rule, and name no
 *   tool, rank or score.
 * What: renders the real page in English and German and checks the three list
 *   sections, each table against the checked-in v8.0 weights, the provisional note on
 *   productivity only, and that the HTML holds no rank marker. Checks every locale's
 *   `methodologyV8` block is complete and translated, and the German metadata is a
 *   self canonical with hreflang (the locale-wide check is in seo-canonical-origin).
 * Test: `npx vitest run tests/unit/methodology-v8-185.test.tsx`. No database, no network.
 */

vi.mock("server-only", () => ({}));

import { locales } from "../../i18n/config";
import { EXPECTED_DICTIONARY_STRUCTURE } from "../../i18n/expected-structure";
import { FACTOR_KEYS, loadCheckedInScoringProfiles } from "../../lib/scoring-profiles";

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const params = (lang: string) => ({ params: Promise.resolve({ lang }) });

async function render(lang: string): Promise<string> {
  const { default: Page } = (await import("../../app/[lang]/methodology/page")) as unknown as {
    default: (p: { params: Promise<{ lang: string }> }) => Promise<ReactElement>;
  };
  return renderToStaticMarkup(await Page(params(lang)));
}

const section = (html: string, list: string) =>
  new RegExp(`<section data-profile="${list}">([\\s\\S]*?)</section>`).exec(html)?.[1] ?? "";
const weightCells = (body: string) =>
  [...body.matchAll(/<tr data-factor="([^"]+)"><td>[^<]*<\/td><td>([^<]+)<\/td><\/tr>/g)].map((m) => [m[1], m[2]]);

describe("methodology page (#185)", () => {
  it.each(["en", "de"])("in %s shows one weight table per list, equal to the checked-in v8.0 profiles", async (lang) => {
    const html = await render(lang);
    const set = loadCheckedInScoringProfiles().profileSets["v8.0"]!;
    const pct = new Intl.NumberFormat(lang, { style: "percent", maximumFractionDigits: 2 });
    for (const list of ["harness", "model", "productivity"]) {
      const expected = FACTOR_KEYS.map((factor) => [factor, pct.format(set.profiles[list]!.weights[factor])]);
      expect(weightCells(section(html, list)), list).toEqual(expected);
    }
    expect(html).toContain('data-methodology-version="8.0"');
  });

  it("carries the provisional note on the productivity profile only, and the open-weight rule", async () => {
    const html = await render("en");
    expect(section(html, "productivity")).toContain('data-note="provisional-weights"');
    expect(section(html, "harness")).not.toContain("data-note");
    expect(section(html, "model")).not.toContain("data-note");
    expect(html).toContain("Whether a model&#x27;s weights are open is not a scoring factor.");
  });

  it("links the three list pages in the page's locale", async () => {
    const html = await render("de");
    for (const path of ["/de/rankings\"", "/de/rankings/models\"", "/de/rankings/productivity-tools\""]) {
      expect(html).toContain(`href="${path}`);
    }
  });

  it("publishes no per-tool rank or score", async () => {
    const html = await render("en");
    expect(html).not.toMatch(/#\d/);
    expect(html).not.toMatch(/data-(rank|score|tool)/);
  });

  it("German metadata is a self canonical with hreflang for every locale", async () => {
    const { generateMetadata } = await import("../../app/[lang]/methodology/page");
    const metadata = await generateMetadata(params("de"));
    const alternates = metadata.alternates as { canonical: string; languages: Record<string, string> };
    expect(alternates.canonical).toMatch(/\/de\/methodology$/);
    expect(Object.keys(alternates.languages).sort()).toEqual([...locales, "x-default"].sort());
    expect(String(metadata.title)).toContain("v8.0");
  });
});

describe("methodologyV8 dictionaries (#185)", () => {
  const keys = (value: unknown, prefix = ""): string[] =>
    value && typeof value === "object"
      ? Object.entries(value).flatMap(([k, v]) => keys(v, `${prefix}${k}.`))
      : [prefix.slice(0, -1)];
  const expected = keys(EXPECTED_DICTIONARY_STRUCTURE.methodologyV8);

  it.each([...locales])("%s has every key, none empty, and its own translation", async (locale) => {
    const dict = (await import(`../../i18n/dictionaries/${locale}.json`)).default as Record<string, any>;
    const en = (await import("../../i18n/dictionaries/en.json")).default as Record<string, any>;
    expect(keys(dict["methodologyV8"]).sort()).toEqual([...expected].sort());
    for (const key of expected) {
      const value = key.split(".").reduce((node, part) => node?.[part], dict["methodologyV8"]);
      expect(typeof value === "string" && value.trim() !== "", `${locale} ${key}`).toBe(true);
    }
    if (locale !== "en") {
      for (const key of ["title", "listsBody", "profilesBody", "provisionalNote", "openWeight"]) {
        expect(dict["methodologyV8"][key], `${locale} ${key}`).not.toBe(en["methodologyV8"][key]);
      }
    }
  });
});
