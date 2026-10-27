import { describe, expect, it } from "vitest";
import { countWords } from "../../lib/article-summary";
import { type DigestValidationContext, validateDigest } from "../../lib/weekly-digest-validate";

/**
 * The weekly digest validator (#181).
 *
 * Why: the model writes the digest body. The owner ruled 250-350 words for a
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

  it("ignores digits inside a link target", () => {
    const slugs = new Set(["rank-7-update"]);
    const body = words(100) + " [story](/en/news/rank-7-update)";
    expect(validateDigest(body, { tier: "short", allowedSlugs: slugs, hasNewAndChanged: false })).toEqual([]);
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
});
