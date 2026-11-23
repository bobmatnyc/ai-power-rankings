import { describe, expect, it } from "vitest";
import {
  TEASER_MAX_CHARS,
  isNavBoilerplate,
  needsFullText,
  resolvePublisherUrl,
} from "../../lib/services/teaser-detection";

/**
 * Why: #476 — snippets over 500 chars that were still truncated or boilerplate
 * were scored as the article, and a google.com/url redirect reached fetch/dedup.
 */

const PROSE = "Anthropic released a Claude Code update that adds background agents for long tasks. ".repeat(10);

describe("needsFullText (#476)", () => {
  it.each([
    ["short snippet", "x".repeat(TEASER_MAX_CHARS)],
    ["[...] fragment", `${PROSE} The rest of the story [...] continues on the site.`],
    ["[…] fragment", `${PROSE} […]`],
    ["trailing ellipsis", `${PROSE} and then the company said…`],
    ["read more link", `${PROSE} Read more at the publisher.`],
    ["continue reading", `${PROSE} Continue reading`],
    ["error page", `Oops, something went wrong. ${PROSE}`],
  ])("flags %s", (_label, content) => {
    expect(needsFullText(content)).toBe(true);
  });

  it("flags a nav-menu extraction longer than the length cutoff", () => {
    const nav = ["Home", "News", "Finance", "Sports", "[Mail](https://mail.example)", "Weather", "Shopping", "Video"]
      .map((item) => `${item} ${" ".repeat(80)}`)
      .join("\n");
    expect(nav.length).toBeGreaterThan(TEASER_MAX_CHARS);
    expect(isNavBoilerplate(nav)).toBe(true);
    expect(needsFullText(nav)).toBe(true);
  });

  it("does not flag full article prose", () => {
    expect(needsFullText(PROSE)).toBe(false);
  });

  it("does not flag an article that mentions 'oops' past its opening", () => {
    expect(needsFullText(`${PROSE} The engineer said oops when the agent ran. ${PROSE}`)).toBe(false);
  });
});

describe("resolvePublisherUrl (#476)", () => {
  it.each([
    [
      "https://www.google.com/url?rct=j&sa=t&url=https%3A%2F%2Fpublisher.example%2Fstory&ct=ga",
      "https://publisher.example/story",
    ],
    ["https://google.co.uk/url?q=https://publisher.example/a?b=1", "https://publisher.example/a?b=1"],
  ])("unwraps %s", (input, expected) => {
    expect(resolvePublisherUrl(input)).toBe(expected);
  });

  it.each([
    ["non-google host", "https://example.com/url?url=https://publisher.example/x"],
    ["google non-redirect path", "https://www.google.com/search?q=https://publisher.example/x"],
    ["redirect without target", "https://www.google.com/url?sa=t"],
    ["non-http target", "https://www.google.com/url?url=javascript:alert(1)"],
    ["unparseable", "not a url"],
  ])("leaves %s unchanged", (_label, input) => {
    expect(resolvePublisherUrl(input)).toBe(input);
  });
});
