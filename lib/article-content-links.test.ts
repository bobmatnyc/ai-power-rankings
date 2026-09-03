import { describe, expect, it } from "vitest";
import { extractExternalLinks, stripRelatedLinksSection } from "./article-content-links";

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
