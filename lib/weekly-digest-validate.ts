/**
 * Weekly digest validation (#181).
 *
 * Why: the model writes the digest body and a bad one would be published to
 * readers and RSS. The rule is a 250-350 word digest (80-120 for a thin
 * week), no score numbers or rank changes, and a fixed structure. This is the
 * same shape of control as `validateSummary` (#180) for an article summary.
 * What: `validateDigest` returns the failed checks as short codes; an empty
 * array is a pass. It checks the word range for the tier, the structure
 * (opening, allowed `##` sections, 3-4 bullets in "The week in short"), that
 * every link is `/en/news/<slug>` for one of the week's articles or the site
 * root, and that the text holds no score or rank number. The title and the
 * source list are built by code and are not part of the body it checks.
 * Test: `tests/unit/weekly-digest-validate-181.test.ts`.
 */

import { countWords } from "@/lib/article-summary";

/** `short`: one or two articles. `full`: three or more. */
export type DigestTier = "short" | "full";

export interface DigestValidationContext {
  tier: DigestTier;
  /** Slugs of the week's input articles; the only `/en/news/` links allowed. */
  allowedSlugs: ReadonlySet<string>;
  /** True when the week has new tools or site changes, so "New and changed" may appear. */
  hasNewAndChanged: boolean;
}

/** A full digest is 250-350 words; a short digest is 80-120. */
export const DIGEST_WORDS: Record<DigestTier, { min: number; max: number }> = {
  short: { min: 80, max: 120 },
  full: { min: 250, max: 350 },
};

const SECTIONS = ["The week in short", "What mattered", "New and changed", "Worth watching"] as const;
const REQUIRED_SECTIONS = ["The week in short", "What mattered"] as const;
const HEADING = /^(#{1,6})\s+(.*?)\s*$/;
const BULLET = /^\s*[-*]\s+/;
const NEWS_LINK = /^\/en\/news\/([a-z0-9-]+)$/;

const NUMBER_WORD = "(?:one|two|three|four|five|six|seven|eight|nine|ten|twenty|fifty|hundred)";
const ORDINAL_WORD = "(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)";

// #339: words that, after "top N", make it a count of the week's items rather
// than a list of ranked tools ("the top three stories").
const ITEM_NOUN =
  "(?:stor(?:y|ies)|items?|articles?|headlines?|news|changes?|updates?|releases?|launches|announcements?|themes?|points?|takeaways?|reads?|links?|topics?|highlights?|developments?)";
// #339: a word that marks "#N" as an issue or pull request reference, and the
// "#4, #5, and" run that may sit between it and a later reference. "see" and
// "ref" are not lead words: "See #1 Cursor." is a rank.
const ISSUE_REF_LEAD = "\\b(?:issues?|PRs?|pull\\s+requests?|bugs?|tickets?|fix(?:es|ed)?|close[sd]?|resolve[sd]?)\\s+";
const ISSUE_REF_RUN = "(?:#\\d+\\s*(?:,\\s*(?:and|or)\\b|,|and\\b|or\\b|&)\\s*)*";
// #339: "#N" before one of these is a rank position even after an issue word.
const TOOL_NOUN = "(?:agents?|tools?|editors?|models?|assistants?|IDEs?|extensions?|picks?|choices?)";

// #181: a score, a rank change or a rank position, in digits or number words.
// Counts ("3 new tools"), versions ("GPT-5.4"), quarters, dates and issue
// references ("#181": three or more digits) are not matched; "top" alone is
// not a rank, only "top" followed by a number is.
// #339: the boundary is a rank position of a tool. "#N" after an issue word,
// "in the first place", "top N%" / "top N percent" and "top N <item noun>" are
// accepted; "#N" elsewhere, "in first place" and "top N" before any other word
// stay rejected.
const SCORE_OR_RANK: readonly RegExp[] = [
  /\b\d+(?:\.\d+)?\s*(?:\/|out of)\s*(?:10|100)\b/i,
  /\b(?:scores?|scored|ratings?|rated)\b\W+(?:\w+\W+){0,3}?\d/i,
  new RegExp(`\\brank(?:ed|ing|s)?\\b\\W+(?:(?:at|in|as|to|from|number|no\\.?)\\W+){0,2}(?:\\d|${ORDINAL_WORD}\\b)`, "i"),
  new RegExp(`(?<!\\bin\\s+the\\s+)\\b(?:\\d+(?:st|nd|rd|th)|${ORDINAL_WORD})\\s+(?:place|rank|position|spot)\\b`, "i"),
  // #339: a move in number words too ("two spots"); "one place" only after a move word.
  new RegExp(`\\b(?:\\d+|(?!one\\b)${NUMBER_WORD})\\s*(?:places?|positions?|spots?)\\b`, "i"),
  /\b(?:up|down|by)\s+one\s+(?:place|position|spot)\b/i,
  new RegExp(`(?<![\\w&#/])(?<!${ISSUE_REF_LEAD}${ISSUE_REF_RUN})#\\d{1,2}(?![\\d\\w])`, "i"),
  new RegExp(`(?<![\\w&#/])#\\d{1,2}\\s+${TOOL_NOUN}\\b`, "i"),
  new RegExp(`\\b(?:no\\.|number)\\s*(?:\\d+|${NUMBER_WORD})\\b`, "i"),
  new RegExp(
    `\\btop\\s+(?:\\d+|${NUMBER_WORD})\\b(?!\\s*(?:%|percent\\b|per\\s+cent\\b))(?!\\s+${ITEM_NOUN}\\b)`,
    "i"
  ),
];

/** A fresh global pattern per call: a shared one keeps `lastIndex` between calls. */
const markdownLinks = () => /\[[^\]]*\]\(([^)\s]*)\)/g;
// #339: a `[label]: target` or `[label]: <target>` line; group 1 is the target,
// group 2 the rest (a title). A footnote label (`[^1]`) is not a link.
const bracketLabelLines = () => /^ {0,3}\[(?!\^)[^\]]+\]:[ \t]*(<[^>\n]*>|[^\s<]*)(.*)$/gm;
// #339: a scheme, a leading `/` `.` `#` or `?`, or a dot-domain. "[Update]: Cursor
// shipped a fix." has none, so it is prose, not a link definition.
const URL_SHAPED = /^(?:[a-z][a-z0-9+.-]*:.|[/.#?]|[^\s/]+\.[a-z]{2,}(?:[/:?#]|$))/i;

/** The reference-style link definitions in `body`: target and the text after it. */
function referenceDefinitions(body: string): Array<{ target: string; rest: string; index: number; length: number }> {
  return [...body.matchAll(bracketLabelLines())]
    .map((m) => ({ target: (m[1] ?? "").replace(/^<|>$/g, ""), rest: m[2] ?? "", index: m.index, length: m[0].length }))
    .filter((d) => URL_SHAPED.test(d.target));
}

/**
 * `body` with inline link targets and reference definition targets removed;
 * both are checked by `linkFailures`. A definition's title stays, so the rank
 * check reads it.
 */
function withoutLinkTargets(body: string): string {
  let text = body;
  for (const d of referenceDefinitions(body).reverse()) {
    text = text.slice(0, d.index) + d.rest + text.slice(d.index + d.length);
  }
  return text.replace(markdownLinks(), "]");
}

/** The word count `validateDigest` measures: heading and bullet markers are not words. */
export function countDigestWords(body: string): number {
  return countWords(body.replace(/^#{1,6}\s+/gm, "").replace(/^\s*[-*]\s+/gm, ""));
}

function structureFailures(body: string, context: DigestValidationContext): string[] {
  const failures: string[] = [];
  const opening: string[] = [];
  const found = new Map<string, number>(); // section name -> bullet count
  let current: string | null = null;
  let seenHeading = false;

  for (const line of body.split(/\r?\n/)) {
    const heading = HEADING.exec(line);
    if (heading) {
      seenHeading = true;
      const name = heading[2] ?? "";
      const known = SECTIONS.find((s) => s.toLowerCase() === name.toLowerCase());
      if (heading[1] === "##" && known && context.tier === "full") {
        current = known;
        found.set(known, found.get(known) ?? 0);
      } else {
        current = null;
        failures.push(`unexpected_section (${name})`);
      }
    } else if (!seenHeading) {
      opening.push(line);
    } else if (current && BULLET.test(line)) {
      found.set(current, (found.get(current) ?? 0) + 1);
    }
  }

  if (opening.join("").trim() === "") failures.push("missing_opening");
  if (context.tier === "short") return failures;

  for (const name of REQUIRED_SECTIONS) {
    if (!found.has(name)) failures.push(`missing_section (${name})`);
  }
  const bullets = found.get("The week in short");
  if (bullets !== undefined && (bullets < 3 || bullets > 4)) {
    failures.push(`week_in_short_bullets (${bullets}, want 3-4)`);
  }
  if (found.has("New and changed") && !context.hasNewAndChanged) {
    failures.push("unexpected_section (New and changed)");
  }
  return failures;
}

function linkFailures(body: string, allowedSlugs: ReadonlySet<string>): string[] {
  const failures: string[] = [];
  // #339: a reference definition's target gets the same check as an inline target.
  const targets = [...[...body.matchAll(markdownLinks())].map((m) => m[1] ?? ""), ...referenceDefinitions(body).map((d) => d.target)];
  for (const target of targets) {
    const slug = NEWS_LINK.exec(target)?.[1];
    if (target !== "/" && !(slug && allowedSlugs.has(slug))) failures.push(`disallowed_link (${target})`);
  }
  const bare = /(?:https?:\/\/|www\.)\S+/i.exec(withoutLinkTargets(body));
  if (bare) failures.push(`disallowed_link (${bare[0]})`);
  return failures;
}

/** The failed checks for `body`; an empty array means the digest is valid. */
export function validateDigest(body: string, context: DigestValidationContext): string[] {
  const text = body.trim();
  const failures: string[] = [];

  const { min, max } = DIGEST_WORDS[context.tier];
  const words = countDigestWords(text);
  if (words < min) failures.push(`word_count_below_min (${words}<${min})`);
  if (words > max) failures.push(`word_count_above_max (${words}>${max})`);

  failures.push(...structureFailures(text, context));
  failures.push(...linkFailures(text, context.allowedSlugs));

  // Link targets can hold digits (a slug), so the score check reads the text alone.
  const prose = withoutLinkTargets(text);
  // One failure per stretch of text: "ranked #2" matches two patterns but is one rank.
  const hits: Array<{ start: number; end: number }> = [];
  for (const pattern of SCORE_OR_RANK) {
    const hit = pattern.exec(prose);
    if (!hit) continue;
    const start = hit.index;
    const end = start + hit[0].length;
    if (hits.some((h) => start < h.end && h.start < end)) continue;
    hits.push({ start, end });
    failures.push(`score_or_rank_number (${hit[0].trim()})`);
  }
  return failures;
}
