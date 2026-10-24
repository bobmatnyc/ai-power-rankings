import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HomeMovers } from "../../app/[lang]/home-movers";

/**
 * #192: the movers strip must survive any `[lang]` URL segment.
 *
 * Why: the segment reached `toLocaleDateString` raw, and a non-BCP-47 value
 * (`xmlrpc.php`, `.env`) throws `RangeError: Invalid language tag`, turning a
 * scanner request into a 500 instead of the English page (#156).
 * What: renders `HomeMovers` with invalid segments and a snapshot date; the
 * markup must carry the formatted date. A valid locale keeps its own format.
 * Test: `npx vitest run tests/unit/home-movers-locale-192.test.tsx`.
 */

const TEXT = {
  title: "Biggest movers",
  sinceLastUpdate: "Since last update",
  sinceLastUpdateOn: "Since last update on {date}",
  up: "Moving up",
  down: "Moving down",
  empty: "No rank changes.",
};

function render(lang: string): string {
  return renderToStaticMarkup(
    <HomeMovers up={[]} down={[]} lang={lang} text={TEXT} snapshotDate="2026-10-21T00:00:00Z" />
  );
}

describe("HomeMovers with an arbitrary [lang] segment (#192)", () => {
  it.each(["xmlrpc.php", "foo_bar", ".env", "wp-login.php", "index.html"])(
    "renders the English date for %s without throwing",
    (lang) => {
      expect(render(lang)).toContain("Since last update on Oct 21, 2026");
    }
  );

  it("keeps the locale's own format for a supported locale", () => {
    expect(render("de")).toContain("21. Okt. 2026");
  });
});
