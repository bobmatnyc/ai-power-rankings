import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { defaultUrlTransform } from "react-markdown";
import { describe, expect, it } from "vitest";
import { WeeklyDigestView } from "../../components/whats-new/weekly-digest-view";
import { countWords } from "../../lib/article-summary";
import { type DigestValidationContext, digestLinkTargets, validateDigest } from "../../lib/weekly-digest-validate";

/**
 * The weekly digest validator (#181).
 *
 * Why: the model writes the digest body. The rule is 250-350 words for a
 * full digest, no score numbers, and a fixed structure; a body that breaks any
 * of them must not be stored.
 * What: `validateDigest(body, context)` returns the failed checks; an empty
 * array is a pass. Fixtures are built from filler words so each test moves one
 * property at a time.
 * Test: `npx vitest run tests/unit/weekly-digest-validate-181.test.ts`.
 */

const SLUGS = new Set(["alpha-launch", "beta-update", "gamma-release"]);
const FULL: DigestValidationContext = { tier: "full", allowedSlugs: SLUGS, hasNewAndChanged: true };
const SHORT: DigestValidationContext = { tier: "short", allowedSlugs: SLUGS, hasNewAndChanged: false };

/** `n` plain words ending in a sentence end. */
function words(n: number): string {
  return `${Array.from({ length: n - 1 }, () => "word").join(" ")} done.`;
}

interface FullOptions {
  opening?: number;
  bullets?: string[];
  mattered?: string;
  extra?: string;
}

/** A valid full body of exactly 300 counted words unless an option changes it. */
function fullBody({ opening = 40, bullets, mattered, extra = "" }: FullOptions = {}): string {
  const bulletLines = (bullets ?? [
    `- ${words(10)} [Alpha launch](/en/news/alpha-launch)`,
    `- ${words(10)}`,
    `- ${words(10)}`,
  ]).join("\n");
  const matteredText = mattered ?? words(120);
  return [
    words(opening),
    "",
    "## The week in short",
    bulletLines,
    "",
    "## What mattered",
    matteredText,
    "",
    "## New and changed",
    words(30),
    extra,
  ].join("\n");
}

/** Pads a body with filler so it lands on `target` counted words. */
function sized(target: number, options: FullOptions = {}): string {
  const base = fullBody(options);
  const have = countWords(base.replace(/^#{1,6}\s/gm, "").replace(/^[-*]\s/gm, ""));
  return fullBody({ ...options, mattered: words(120 + (target - have)) });
}

describe("validateDigest word range (#181)", () => {
  it("passes a full digest of 300 words", () => {
    expect(validateDigest(sized(300), FULL)).toEqual([]);
  });

  it("accepts the range edges 250 and 350 and rejects 249 and 351", () => {
    expect(validateDigest(sized(250), FULL)).toEqual([]);
    expect(validateDigest(sized(350), FULL)).toEqual([]);
    expect(validateDigest(sized(249), FULL)).toEqual(["word_count_below_min (249<250)"]);
    expect(validateDigest(sized(351), FULL)).toEqual(["word_count_above_max (351>350)"]);
  });

  it("holds a short digest to 80-120 words with no headings", () => {
    expect(validateDigest(words(100), SHORT)).toEqual([]);
    expect(validateDigest(words(79), SHORT)).toEqual(["word_count_below_min (79<80)"]);
    expect(validateDigest(words(121), SHORT)).toEqual(["word_count_above_max (121>120)"]);
  });
});

describe("validateDigest no-score rule (#181)", () => {
  it.each([
    ["a score out of ten", "Cursor scored 8.5 out of 10 this week."],
    ["a bare score", "The tool has a score of 87 now."],
    ["a rating number", "Its rating rose to 9 after the release."],
    ["a rank number", "It is now ranked #2 overall."],
    ["a rank in words", "It ranked 3rd among editors."],
    ["a rank move", "The agent moved up 4 places."],
    ["a rank move by positions", "It dropped 2 positions in the list."],
  ])("rejects %s", (_name, sentence) => {
    const failures = validateDigest(sized(300, { extra: sentence }), FULL);
    expect(failures.some((f) => f.startsWith("score_or_rank_number"))).toBe(true);
  });

  it("allows counts, versions and dates that are not scores", () => {
    const extra = "Version 2.1 shipped on 14 October with 3 new commands for 12 teams.";
    const failures = validateDigest(sized(300, { extra }), FULL).filter((f) =>
      f.startsWith("score_or_rank_number")
    );
    expect(failures).toEqual([]);
  });

  // #181: a rank position is a rank number even with no "ranked" or "place" next to it.
  it.each([
    ["a hash rank", "Cursor is #1 for editors this week."],
    ["a No. rank", "It is the No. 1 agent now."],
    ["a rank in number words", "It is number one for agents."],
    ["a top-N list", "It joined the top 5 this week."],
    ["a top-N list in words", "It joined the top ten this week."],
    ["a rank as an ordinal word", "It ranked third among editors."],
    ["a place as an ordinal word", "It took first place among agents."],
  ])("rejects %s", (_name, sentence) => {
    const failures = validateDigest(sized(300, { extra: sentence }), FULL);
    expect(failures.some((f) => f.startsWith("score_or_rank_number"))).toBe(true);
  });

  it("allows issue references, model names, quarters, counts and the word top", () => {
    const extra =
      "See #181. A top-tier agent was the top story. Claude Opus 4 and GPT-5.4 shipped in Q3 with 3 new tools.";
    const failures = validateDigest(sized(300, { extra }), FULL).filter((f) =>
      f.startsWith("score_or_rank_number")
    );
    expect(failures).toEqual([]);
  });

  // #339: normal digest wording that names no rank position of a tool.
  it.each([
    ["a count of stories", "These were the top three stories of the week."],
    ["a count of stories in digits", "The top 3 stories all came from one vendor."],
    ["an idiom", "The bug should not have shipped in the first place."],
    ["an issue reference", "The release fixes issue #42 in the editor."],
    ["a list of issue references", "It closes issues #4, #5 and #7 for teams."],
    ["an Oxford-comma list of issue references", "Issues #4, #5, and #7 are closed."],
    ["issue references joined by a comma and or", "It fixes issue #4, or #5 for some teams."],
    ["issue references joined by an ampersand", "It closes issues #4 & #5 for teams."],
    ["a pull request reference", "The change landed in PR #12 on Tuesday."],
    ["one place in words", "The settings now live in one place."],
    ["a percentile", "It sits in the top 10% of pass rates."],
    ["a percentile in words", "It sits in the top 10 percent of pass rates."],
    ["top-tier", "A top-tier agent shipped a fix."],
    ["the top story", "The top story was a new agent."],
    ["model versions", "GPT-5.4 and Claude Opus 4 shipped this week."],
    ["a quarter", "The plan lands in Q3 for most teams."],
    ["an OS version", "It now runs on Windows 11 and macOS."],
    ["a count of tools", "The site added 3 new tools this week."],
    // #339: a number word before "places" or "spots" with no move word is a count.
    ["a count of places in words", "The setting is now in two places."],
    ["a count of positions in words", "It has two positions open."],
    ["a count of spots in words", "It opened fifty spots for the beta."],
  ])("allows %s", (_name, sentence) => {
    const failures = validateDigest(sized(300, { extra: sentence }), FULL).filter((f) =>
      f.startsWith("score_or_rank_number")
    );
    expect(failures).toEqual([]);
  });

  // #339: the accepted wording above sits next to rank positions that stay rejected.
  it.each([
    ["first place with a preposition", "Cursor is in first place among editors."],
    ["a top-N list of tools", "It joined the top 5 agents this week."],
    ["a top-N list with no noun", "It joined the top three this week."],
    ["a hash rank before a noun", "It is the #2 agent for teams."],
    ["a hash rank in brackets", "Cursor (#1) shipped a fix."],
    ["a hash rank after see", "See #1 Cursor."],
    ["a hash rank after ref", "Cursor, ref #1."],
    ["an issue word before a hash rank of a tool", "Cursor is the issue #1 agent."],
    ["a hash rank after an Oxford comma", "Cursor, Copilot, and #1 Claude shipped."],
    ["a hash rank after an ampersand", "Cursor & #1 Claude shipped."],
    ["a rank move in number words", "The agent moved up two places."],
    ["a rank move by spots in number words", "It fell two spots this week."],
    ["a rank move of one place", "It moved up one place."],
    ["a rank move after a move word", "Cursor dropped two places this week."],
  ])("still rejects %s", (_name, sentence) => {
    const failures = validateDigest(sized(300, { extra: sentence }), FULL);
    expect(failures.some((f) => f.startsWith("score_or_rank_number"))).toBe(true);
  });

  it("ignores digits inside a link target", () => {
    const slugs = new Set(["rank-7-update"]);
    const body = words(100) + " [story](/en/news/rank-7-update)";
    expect(validateDigest(body, { tier: "short", allowedSlugs: slugs, hasNewAndChanged: false })).toEqual([]);
  });
});

// #343: a rank move in number words is rejected whatever its move verb.
describe("validateDigest rank moves written in words (#343)", () => {
  const rankFailures = (sentence: string): string[] =>
    validateDigest(sized(300, { extra: sentence }), FULL).filter((f) => f.startsWith("score_or_rank_number"));

  it.each([
    "Cursor gained two places.",
    "Cursor lost three spots.",
    "Cursor falls two spots.",
    "Cursor drops two places.",
    "It advanced two positions.",
    "Cursor leapfrogged Copilot by two places.",
    "Cursor improved by two places.",
    "Cursor shifted by two spots.",
  ])("rejects %s", (sentence) => {
    expect(rankFailures(sentence)).not.toEqual([]);
  });

  it.each([
    "The setting is in two places.",
    "It has two positions open.",
    "It opened fifty spots for the beta.",
    "The settings now live in one place.",
    "It is shared by two places.",
    "The extension gained support in two places.",
  ])("allows %s", (sentence) => {
    expect(rankFailures(sentence)).toEqual([]);
  });
});

describe("validateDigest structure (#181)", () => {
  it("requires an opening before the first heading", () => {
    const body = sized(300).split("\n").slice(2).join("\n");
    expect(validateDigest(body, FULL)).toContain("missing_opening");
  });

  it.each(["The week in short", "What mattered"])("requires the %s section", (heading) => {
    const body = sized(300).replace(`## ${heading}`, "Plain line");
    expect(validateDigest(body, FULL)).toContain(`missing_section (${heading})`);
  });

  it("requires 3 or 4 bullets under The week in short", () => {
    const two = sized(300, { bullets: ["- one word here.", "- two word here."] });
    expect(validateDigest(two, FULL)).toContain("week_in_short_bullets (2, want 3-4)");
    const five = sized(300, { bullets: Array.from({ length: 5 }, () => "- bullet word here.") });
    expect(validateDigest(five, FULL)).toContain("week_in_short_bullets (5, want 3-4)");
  });

  it("rejects a heading the shape does not define, including h1 and Sources", () => {
    expect(validateDigest(sized(300, { extra: "## Sources\nmore." }), FULL)).toContain(
      "unexpected_section (Sources)"
    );
    expect(validateDigest(`# Title\n${sized(300)}`, FULL)).toContain("unexpected_section (Title)");
  });

  it("rejects New and changed when the week had no new tools or site changes", () => {
    expect(validateDigest(sized(300), { ...FULL, hasNewAndChanged: false })).toContain(
      "unexpected_section (New and changed)"
    );
  });

  it("rejects any heading in a short digest", () => {
    expect(validateDigest(`${words(90)}\n## What mattered\n${words(5)}`, SHORT)).toContain(
      "unexpected_section (What mattered)"
    );
  });
});

describe("validateDigest links (#181)", () => {
  it("allows /en/news/<slug> for an input article and the site root", () => {
    const body = `${words(100)} [a](/en/news/alpha-launch) [home](/)`;
    expect(validateDigest(body, SHORT)).toEqual([]);
  });

  it.each([
    ["a slug outside the week's articles", "[x](/en/news/not-in-input)"],
    ["an external URL", "[x](https://example.com/page)"],
    ["a bare URL", "see https://example.com/page"],
    ["another site path", "[x](/en/tools/cursor)"],
  ])("rejects %s", (_name, link) => {
    const failures = validateDigest(`${words(100)} ${link}`, SHORT);
    expect(failures.some((f) => f.startsWith("disallowed_link"))).toBe(true);
  });

  // #339: a reference-style link is held to the same targets as an inline one.
  it.each([
    ["a protocol-relative target", "//evil.example/x"],
    ["a protocol-relative target in angle brackets", "<//evil.example/x>"],
    ["another site path", "/en/tools/cursor"],
  ])("rejects a reference-style link with %s", (_name, target) => {
    const failures = validateDigest(`${words(100)} [story][r]\n\n[r]: ${target}`, SHORT);
    expect(failures).toContain(`disallowed_link (${target.replace(/^<|>$/g, "")})`);
  });

  it("allows a reference-style link to an input article", () => {
    const body = `${words(100)} [story][r]\n\n[r]: /en/news/alpha-launch`;
    expect(validateDigest(body, SHORT)).toEqual([]);
  });

  // #339: a footnote and a "[Label]: text" line hold no link target.
  it.each([
    ["a footnote definition", `${words(100)} Claim.[^1]\n\n[^1]: From the vendor blog.`],
    ["a bracket-led line with a text target", `${words(100)}\n\n[Update]: Cursor shipped a fix.`],
  ])("does not read %s as a link", (_name, body) => {
    expect(validateDigest(body, SHORT)).toEqual([]);
  });

  it.each([
    ["a dot-domain target", "evil.example/x"],
    ["a scheme target", "https://evil.example/x"],
  ])("still rejects a bracket-led line with %s", (_name, target) => {
    expect(validateDigest(`${words(100)}\n\n[Update]: ${target}`, SHORT)).toContain(`disallowed_link (${target})`);
  });

  // #339: text outside the link target is prose, so the rank check reads it.
  it.each([
    ["a footnote", `${words(100)} Claim.[^1]\n\n[^1]: Cursor ranked #1 this week.`],
    ["a reference definition title", `${words(100)} [story][r]\n\n[r]: /en/news/alpha-launch "ranked #1"`],
  ])("rejects a rank in %s", (_name, body) => {
    expect(validateDigest(body, SHORT).some((f) => f.startsWith("score_or_rank_number"))).toBe(true);
  });

  // #339: a definition the renderer reads is checked wherever the parser finds it.
  it.each([
    ["with its target on the next line", "[story][r]\n\n[r]:\n//evil.example/x"],
    ["inside a blockquote", "[story][r]\n\n> [r]: //evil.example/x"],
    ["inside a list item", "[story][r]\n\n- [r]: //evil.example/x"],
    ["inside nested containers", "[story][r]\n\n> - > [r]: //evil.example/x"],
  ])("rejects a reference definition %s", (_name, tail) => {
    expect(validateDigest(`${words(100)} ${tail}`, SHORT)).toContain("disallowed_link (//evil.example/x)");
  });

  it.each([
    ["a protocol-relative inline link", "[x](//evil.example/x)", "//evil.example/x"],
    ["an autolink", "<https://evil.example/x>", "https://evil.example/x"],
    ["a javascript: link", "[x](javascript:alert(1))", "javascript:alert(1)"],
    ["a data: link", "[x](data:text/html,hi)", "data:text/html,hi"],
    ["a mailto: link", "[x](mailto:a@evil.example)", "mailto:a@evil.example"],
    ["an empty definition target", "[story][r]\n\n[r]: <>", ""],
  ])("still rejects %s", (_name, link, target) => {
    expect(validateDigest(`${words(100)} ${link}`, SHORT)).toContain(`disallowed_link (${target})`);
  });

  // #339: CommonMark reads these lines as paragraphs, not link definitions.
  it.each(["[Note]: Node.js shipped a fix.", "[Update]: Cursor.ai shipped a fix."])("accepts %s", (line) => {
    expect(validateDigest(`${words(100)}\n\n${line}`, SHORT)).toEqual([]);
  });
});

/** Every `href` and `src` in `html`, with the attribute escapes React writes decoded. */
function renderedUrls(html: string): string[] {
  const decode = (s: string) =>
    s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  return [...html.matchAll(/\s(?:href|src)="([^"]*)"/g)].map((m) => decode(m[1] ?? ""));
}

describe("validateDigest reads the links the page renders (#339)", () => {
  // Each fixture references every definition it holds, so every checked URL renders.
  it.each([
    ["a news link and the site root", "[a](/en/news/alpha-launch) [home](/)"],
    ["a next-line definition", "[story][r]\n\n[r]:\n//evil.example/x"],
    ["a blockquote definition", "[story][r]\n\n> [r]: //evil.example/x"],
    ["a list-item definition", "[story][r]\n\n- [r]: //evil.example/x"],
    ["a nested-container definition", "[story][r]\n\n> - > [r]: //evil.example/x"],
    ["a protocol-relative inline link", "[x](//evil.example/x)"],
    ["autolinks", "<https://evil.example/a> https://evil.example/b www.evil.example a@evil.example"],
    ["script, data and mail links", "[x](javascript:alert(1)) [y](data:text/html,hi) [z](mailto:a@evil.example)"],
    ["an image and a reference image", "![a](/en/news/beta-update) ![b][i]\n\n[i]: //evil.example/i.png"],
    ["a footnote and a titled definition", 'Claim.[^1] [s][r]\n\n[^1]: Note.\n\n[r]: /en/news/gamma-release "t"'],
  ])("checks exactly the URLs rendered for %s", (_name, tail) => {
    const body = `${words(100)} ${tail}`;
    const element = createElement(WeeklyDigestView, {
      digest: { week: "2026-W43", content: body, generatedAt: "2026-10-26T00:00:00.000Z" },
    });
    // remark-rehype adds footnote links of its own; they come from no URL in the body.
    const rendered = renderedUrls(renderToStaticMarkup(element)).filter((u) => !u.startsWith("#user-content-fn"));
    // With no allowed slug, every checked URL but the site root is a failure.
    const failed = validateDigest(body, { ...SHORT, allowedSlugs: new Set() })
      .filter((f) => f.startsWith("disallowed_link ("))
      .map((f) => f.slice("disallowed_link (".length, -1));
    const checked = [...failed, ...(rendered.includes("/") ? ["/"] : [])];
    // The page applies react-markdown's URL filter; the check reads the URL before it.
    expect(new Set(checked.map((u) => defaultUrlTransform(u)))).toEqual(new Set(rendered));
    expect(new Set(digestLinkTargets(body))).toEqual(new Set(checked));
  });
});
