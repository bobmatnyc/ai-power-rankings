import { describe, expect, it } from "vitest";
import {
  extractExternalLinks,
  filterChromeLinks,
  isChromeBoilerplateText,
  isRootPathUrl,
  sanitizeRelatedLinksBlock,
  stripRelatedLinksSection,
} from "./article-content-links";

/**
 * Content shape taken verbatim from the article the defect was reported
 * against (/en/news/russian-hackers-exploit-spacex-s-cursor-ai-tool-in-
 * multi-company-breach-campaign), which rendered these same five links under
 * both a "Related Links" and a "Referenced Links" heading.
 */
const REPORTED_ARTICLE = `Russian state-linked operators abused a SpaceX-built Cursor AI extension.

The campaign spanned several companies before detection.

**Related Links:**
- [MyNewMarkets.com](https://www.mynewmarkets.com/)
- [Claims Journal](https://www.claimsjournal.com/)
- [Insurance Journal TV](https://www.insurancejournal.tv/)
- [Academy of Insurance](https://www.ijacademy.com/)
- [Carrier Management](https://www.carriermanagement.com/)`;

describe("extractExternalLinks", () => {
  it("extracts links", () => {
    const links = extractExternalLinks(REPORTED_ARTICLE);
    expect(links).toHaveLength(5);
    expect(links[0]).toEqual({ text: "MyNewMarkets.com", url: "https://www.mynewmarkets.com/" });
    expect(links[4]).toEqual({
      text: "Carrier Management",
      url: "https://www.carriermanagement.com/",
    });
  });

  it("deduplicates repeated urls", () => {
    const content = `See [Claims Journal](https://www.claimsjournal.com/) for detail.

**Related Links:**
- [Claims Journal](https://www.claimsjournal.com/)
- [Carrier Management](https://www.carriermanagement.com/)`;

    expect(extractExternalLinks(content).map((l) => l.url)).toEqual([
      "https://www.claimsjournal.com/",
      "https://www.carriermanagement.com/",
    ]);
  });

  it("returns an empty list for content with no links", () => {
    expect(extractExternalLinks("Plain prose with no markdown links.")).toEqual([]);
    expect(extractExternalLinks("")).toEqual([]);
  });
});

describe("stripRelatedLinksSection", () => {
  it("strips the trailing related links block", () => {
    const stripped = stripRelatedLinksSection(REPORTED_ARTICLE);

    expect(stripped).not.toMatch(/Related Links/i);
    expect(stripped).not.toContain("mynewmarkets.com");
    expect(stripped).toContain("Russian state-linked operators");
    expect(stripped).toContain("The campaign spanned several companies before detection.");
  });

  it("keeps the referenced-links list populated after stripping", () => {
    // The single surviving section must still render all five links, so
    // extraction has to read the original content, not the stripped copy.
    expect(extractExternalLinks(REPORTED_ARTICLE)).toHaveLength(5);
    expect(extractExternalLinks(stripRelatedLinksSection(REPORTED_ARTICLE))).toHaveLength(0);
  });

  it("strips heading variants the model emits", () => {
    const variants = [
      "**Related Links:**",
      "**Related Links**",
      "## Related Links",
      "### Related Links:",
      "__Related Links__",
      "Related Links:",
    ];

    for (const heading of variants) {
      const content = `Body text.\n\n${heading}\n- [A](https://a.example/)\n- [B](https://b.example/)`;
      const stripped = stripRelatedLinksSection(content);
      expect(stripped, `variant: ${heading}`).toBe("Body text.");
    }
  });

  it("leaves a heading with no link list untouched", () => {
    const content = "Related Links:\n\nThis paragraph is prose, not a link list.";
    expect(stripRelatedLinksSection(content)).toBe(content);
  });

  it("preserves body content and inline links that follow the block", () => {
    const content = `Intro with an [inline link](https://inline.example/).

**Related Links:**
- [A](https://a.example/)

## Analysis

Closing paragraph.`;

    const stripped = stripRelatedLinksSection(content);
    expect(stripped).toContain("[inline link](https://inline.example/)");
    expect(stripped).toContain("## Analysis");
    expect(stripped).toContain("Closing paragraph.");
    expect(stripped).not.toContain("a.example");
  });

  it("returns content unchanged when there is no related links block", () => {
    const content = "Just an article body.\n\nWith two paragraphs.";
    expect(stripRelatedLinksSection(content)).toBe(content);
  });

  it("handles empty content", () => {
    expect(stripRelatedLinksSection("")).toBe("");
  });
});

// #122: the "Referenced Links" section on the live example article
// (aipowerranking.com/en/news/russian-hackers-exploit-spacex-s-cursor-ai-
// tool-in-multi-company-breach-campaign) rendered Insurance Journal's own
// footer/sister-site navigation as if it were story references. None of
// these five domains match the source article's own domain, so a naive
// same-domain filter cannot catch them (confirmed live via WebFetch: the
// page's "Referenced Links:" section is exactly these five entries).

// #122 code review finding (CRITICAL): the first version of this check
// matched anchor TEXT against the linked hostname. That both dropped a
// standard outlet-name citation with a deep article path
// (`[TechCrunch](https://techcrunch.com/2026/08/28/...)`) as "site-name-only",
// AND missed the actual live chrome link `[Academy of Insurance]
// (https://www.ijacademy.com/)`, whose anchor has no textual overlap with
// "ijacademy" at all. URL SHAPE — root path vs. a specific article/resource
// path — is the reliable signal; anchor text is not.
describe("isRootPathUrl", () => {
  it("flags every known chrome link from the reported article (bare domain roots)", () => {
    expect(isRootPathUrl("https://www.mynewmarkets.com/")).toBe(true);
    expect(isRootPathUrl("https://www.claimsjournal.com/")).toBe(true);
    expect(isRootPathUrl("https://www.insurancejournal.tv/")).toBe(true);
    expect(isRootPathUrl("https://www.ijacademy.com/")).toBe(true);
    expect(isRootPathUrl("https://www.carriermanagement.com/")).toBe(true);
  });

  it("flags a root url with no trailing slash the same as one with it", () => {
    expect(isRootPathUrl("https://www.mynewmarkets.com")).toBe(true);
  });

  it("does not flag a deep-path url, regardless of anchor text", () => {
    expect(isRootPathUrl("https://www.spacex.com/updates/breach-disclosure")).toBe(false);
    expect(isRootPathUrl("https://example.com/q3-earnings-report")).toBe(false);
  });

  it("does not flag a deep-path outlet-name citation (regression: was a false positive)", () => {
    // Standard citation style: naming the outlet as the anchor for a
    // specific article is not chrome just because the anchor equals the
    // site's brand name.
    expect(
      isRootPathUrl("https://techcrunch.com/2026/08/28/openai-announces-new-model/")
    ).toBe(false);
  });

  it("returns false for an unparsable url", () => {
    expect(isRootPathUrl("not a url")).toBe(false);
  });

  it("accepted trade-off: a genuine root-path reference is flagged as chrome too", () => {
    // Mirrors the old isSiteNameOnlyAnchor "known gap" test, for the
    // opposite failure direction. A homepage cited AS a reference — e.g.
    // "[Vendor Tool official site](https://vendor-tool.example/)" with that
    // exact URL present in the source content — is indistinguishable, by
    // path shape alone, from a nav/footer/sister-site link, and is dropped
    // by both filterChromeLinks and sanitizeRelatedLinksBlock. This is a
    // deliberate, accepted trade-off (see isRootPathUrl's doc comment): if
    // a future report is "a legitimate homepage link is missing from
    // Referenced Links," the fix is NOT to loosen isRootPathUrl to admit
    // root URLs back in — that reopens #122 (the reported chrome links are
    // themselves all bare domain roots). It needs a stronger signal
    // (e.g. corroborating anchor text) added alongside the path check,
    // not a relaxation of the path check itself.
    expect(isRootPathUrl("https://vendor-tool.example/")).toBe(true);
  });
});

describe("isChromeBoilerplateText", () => {
  it("flags known navigation/subscription boilerplate", () => {
    for (const text of [
      "Subscribe",
      "Newsletter",
      "Sign Up",
      "Sign-up",
      "Log In",
      "Home",
      "About Us",
      "Contact Us",
      "Privacy Policy",
      "Terms of Service",
      "Advertise With Us",
    ]) {
      expect(isChromeBoilerplateText(text), text).toBe(true);
    }
  });

  it("does not flag story-relevant anchor text", () => {
    expect(isChromeBoilerplateText("SpaceX confirms breach in official statement")).toBe(false);
    expect(isChromeBoilerplateText("Carrier Management")).toBe(false);
  });
});

describe("filterChromeLinks", () => {
  it("removes all five chrome links extracted from the reported article, keeping a genuine reference", () => {
    const content = `${REPORTED_ARTICLE}
- [SpaceX's official breach disclosure](https://www.spacex.com/updates/breach-disclosure)`;

    const filtered = filterChromeLinks(extractExternalLinks(content));

    // The root-path signal (isRootPathUrl) catches all five — the anchor-text
    // heuristic this replaced only caught four.
    expect(filtered.map((l) => l.url)).toEqual([
      "https://www.spacex.com/updates/breach-disclosure",
    ]);
  });

  it("keeps a deep-path outlet-name citation (regression: was a false positive)", () => {
    const links = [
      {
        text: "TechCrunch",
        url: "https://techcrunch.com/2026/08/28/openai-announces-new-model/",
      },
    ];
    expect(filterChromeLinks(links)).toEqual(links);
  });

  it("drops boilerplate-text links regardless of domain", () => {
    const links = [
      { text: "Subscribe", url: "https://example.com/subscribe" },
      { text: "The vendor's roadmap announcement", url: "https://example.com/roadmap" },
    ];
    expect(filterChromeLinks(links)).toEqual([
      { text: "The vendor's roadmap announcement", url: "https://example.com/roadmap" },
    ]);
  });

  it("returns an empty list unchanged", () => {
    expect(filterChromeLinks([])).toEqual([]);
  });
});

describe("sanitizeRelatedLinksBlock", () => {
  // Realistic fixture: sourceContent stands in for the raw page text handed
  // to the LLM (Jina/Tavily markdown extraction of the Insurance Journal
  // article), which never actually contains the sister-site chrome URLs —
  // supporting the hypothesis that the model recalled them from background
  // knowledge about the publisher rather than extracting them. It DOES
  // contain the genuine in-story reference's URL.
  const sourceContent = `Russian state-linked operators abused a SpaceX-built Cursor AI extension
to compromise several companies before detection.

SpaceX published its own account at
https://www.spacex.com/updates/breach-disclosure describing the scope of
the intrusion and its remediation steps.

Insurance Journal is a publication covering the insurance industry.`;

  // rewrittenContent stands in for the LLM's own output: prose plus a
  // Related Links block mixing the five hallucinated chrome links with the
  // one genuine, verifiable reference.
  const rewrittenContent = `Russian hackers exploited a compromised Cursor AI tool distributed via SpaceX
tooling to breach multiple companies in a coordinated campaign.

SpaceX has published its own disclosure of the incident.

**Related Links:**
- [MyNewMarkets.com](https://www.mynewmarkets.com/)
- [Claims Journal](https://www.claimsjournal.com/)
- [Insurance Journal TV](https://www.insurancejournal.tv/)
- [Academy of Insurance](https://www.ijacademy.com/)
- [Carrier Management](https://www.carriermanagement.com/)
- [SpaceX's official breach disclosure](https://www.spacex.com/updates/breach-disclosure)`;

  it("drops every unverifiable/chrome link while keeping the genuine reference", () => {
    const sanitized = sanitizeRelatedLinksBlock(rewrittenContent, sourceContent);

    expect(sanitized).toContain("**Related Links:**");
    expect(sanitized).toContain(
      "[SpaceX's official breach disclosure](https://www.spacex.com/updates/breach-disclosure)"
    );
    expect(sanitized).not.toContain("mynewmarkets.com");
    expect(sanitized).not.toContain("claimsjournal.com");
    expect(sanitized).not.toContain("insurancejournal.tv");
    expect(sanitized).not.toContain("ijacademy.com");
    expect(sanitized).not.toContain("carriermanagement.com");
    // Body prose is untouched.
    expect(sanitized).toContain("Russian hackers exploited a compromised Cursor AI tool");
  });

  it("removes the heading entirely when every candidate link is dropped", () => {
    const allChrome = `Body prose about the story.

**Related Links:**
- [MyNewMarkets.com](https://www.mynewmarkets.com/)
- [Claims Journal](https://www.claimsjournal.com/)`;

    const sanitized = sanitizeRelatedLinksBlock(allChrome, sourceContent);

    expect(sanitized).toBe("Body prose about the story.");
  });

  it("verifies a link via sourceHrefs even when it is absent from sourceContent text", () => {
    // Models the basic-HTML-fetch fallback path, where the extracted href
    // list is the ground truth rather than raw page text.
    const content = `Prose.

**Related Links:**
- [Vendor's product page](https://vendor.example/product)`;

    const keptByHref = sanitizeRelatedLinksBlock(content, "Prose with no urls in it.", [
      "https://vendor.example/product",
    ]);
    expect(keptByHref).toContain("vendor.example/product");

    const droppedWithoutHref = sanitizeRelatedLinksBlock(content, "Prose with no urls in it.", []);
    expect(droppedWithoutHref).toBe("Prose.");
  });

  it("drops a chrome-shaped link even when its url does appear in sourceContent", () => {
    // Defense in depth: extracted page text can itself still contain
    // footer/nav chrome, so URL-presence alone must not be sufficient.
    const content = `Prose.

**Related Links:**
- [Subscribe](https://example.com/subscribe)`;

    const sanitized = sanitizeRelatedLinksBlock(
      content,
      "Prose. Footer: https://example.com/subscribe"
    );
    expect(sanitized).toBe("Prose.");
  });

  it("drops a root-path chrome link even when its real href is in sourceHrefs (regression: was a false negative)", () => {
    // #122 code review finding (HIGH): the basic-HTML-fetch fallback scrapes
    // the WHOLE page, so metadata.links legitimately contains the source
    // site's own real footer hrefs — including the exact live-bug link,
    // "Academy of Insurance" / ijacademy.com. Being verifiable is not
    // sufficient; a bare-root URL must still be dropped as chrome.
    const content = `Prose.

**Related Links:**
- [Academy of Insurance](https://www.ijacademy.com/)`;

    const sanitized = sanitizeRelatedLinksBlock(content, "Prose with no urls in it.", [
      "https://www.ijacademy.com/",
    ]);
    expect(sanitized).toBe("Prose.");
  });

  it("keeps a deep-path outlet-name citation that is verifiable (regression: was a false positive)", () => {
    const content = `Prose.

**Related Links:**
- [TechCrunch](https://techcrunch.com/2026/08/28/openai-announces-new-model/)`;

    const sanitized = sanitizeRelatedLinksBlock(
      content,
      "See https://techcrunch.com/2026/08/28/openai-announces-new-model/ for details."
    );
    expect(sanitized).toContain(
      "[TechCrunch](https://techcrunch.com/2026/08/28/openai-announces-new-model/)"
    );
  });

  it("verifies a href that entity-encodes '&' against the model's plain-ampersand url (regression)", () => {
    // #122 code review finding (MEDIUM): an href scraped from a raw HTML
    // attribute commonly entity-encodes "&" as "&amp;" for any query string
    // with 2+ params; the model's own markdown output uses a plain "&". An
    // exact-string comparison must not treat these as different URLs.
    const content = `Prose.

**Related Links:**
- [Vendor pricing page](https://vendor.example/pricing?a=1&b=2)`;

    const sanitized = sanitizeRelatedLinksBlock(content, "Prose with no urls in it.", [
      "https://vendor.example/pricing?a=1&amp;b=2",
    ]);
    expect(sanitized).toContain(
      "[Vendor pricing page](https://vendor.example/pricing?a=1&b=2)"
    );
  });

  it("verifies a href that differs from the model's url only by a trailing slash", () => {
    const content = `Prose.

**Related Links:**
- [Vendor pricing page](https://vendor.example/pricing)`;

    const sanitized = sanitizeRelatedLinksBlock(content, "Prose with no urls in it.", [
      "https://vendor.example/pricing/",
    ]);
    expect(sanitized).toContain("[Vendor pricing page](https://vendor.example/pricing)");
  });

  it("leaves prose and inline links outside the block untouched", () => {
    const content = `Intro with an [inline link](https://inline.example/).

**Related Links:**
- [MyNewMarkets.com](https://www.mynewmarkets.com/)

## Analysis

Closing paragraph.`;

    const sanitized = sanitizeRelatedLinksBlock(content, "no matching urls here");
    expect(sanitized).toContain("[inline link](https://inline.example/)");
    expect(sanitized).toContain("## Analysis");
    expect(sanitized).toContain("Closing paragraph.");
    expect(sanitized).not.toContain("mynewmarkets.com");
  });

  it("returns content unchanged when there is no related links block", () => {
    const content = "Just an article body.\n\nWith two paragraphs.";
    expect(sanitizeRelatedLinksBlock(content, "anything")).toBe(content);
  });

  it("handles empty rewrittenContent", () => {
    expect(sanitizeRelatedLinksBlock("", "anything")).toBe("");
  });
});
