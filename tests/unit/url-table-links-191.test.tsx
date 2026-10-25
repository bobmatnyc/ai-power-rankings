import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * #191: no internal link on the footer or the best-of hub points at a 308 source.
 *
 * Why: a link to a moved URL costs every visitor and crawler a redirect hop.
 *   The footer's 9 category links and the hub's 8 links point at best-of pages
 *   whose rows are held until the harness ranking (#196) ships; once those rows
 *   ship this test fails until the links move to the final targets.
 * What: renders the footer and the `best-ai-coding-tools` hub for every locale
 *   and checks each `href` against `resolveTableRedirect`.
 * Test: `npx vitest run tests/unit/url-table-links-191.test.tsx`.
 */

const { lang } = vi.hoisted(() => ({ lang: { value: "en" } }));
vi.mock("../../i18n/client", () => ({ useI18n: () => ({ lang: lang.value }) }));

import BestAICodingToolsPage from "../../app/[lang]/best-ai-coding-tools/page";
import { Footer } from "../../components/layout/footer";
import { locales } from "../../i18n/config";
import { resolveTableRedirect } from "../../lib/seo/url-table";

function internalHrefs(html: string): string[] {
  return [...html.matchAll(/href="(\/[^"]*)"/g)].map((m) => (m[1] ?? "").split("?")[0] ?? "");
}

describe("internal links never point at a #191 308 source", () => {
  it.each([...locales])("footer and hub links in %s", async (locale) => {
    lang.value = locale;
    const footer = internalHrefs(renderToStaticMarkup(<Footer />));
    const hub = internalHrefs(
      renderToStaticMarkup(await BestAICodingToolsPage({ params: Promise.resolve({ lang: locale }) }))
    );
    expect(footer).toContain(`/${locale}/contact/default`);
    expect(footer.filter((href) => href.includes("/best-"))).toHaveLength(9);
    expect(hub.filter((href) => href.includes("/best-"))).toHaveLength(8);
    for (const href of [...footer, ...hub]) {
      expect(resolveTableRedirect(href), href).toBeNull();
    }
  });
});
