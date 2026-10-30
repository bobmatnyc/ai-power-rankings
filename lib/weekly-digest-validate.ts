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
 * every link, image and link definition URL in the parsed markdown is
 * `/en/news/<slug>` for one of the week's articles or the site root, and that
 * the text holds no score or rank number. The title and the
 * source list are built by code and are not part of the body it checks.
 * Test: `tests/unit/weekly-digest-validate-181.test.ts`.
 */

import { remark } from "remark";
import remarkGfm from "remark-gfm";
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
// #343: a word that makes "<number word> places" a rank move, in every verb
// form. "by" has its own rule below.
const MOVE_WORD =
  "(?:up|down|mov(?:e|es|ed|ing)|climb(?:s|ed|ing)?|ris(?:e|es|en|ing)|rose|fall(?:s|en|ing)?|fell|" +
  "drop(?:s|ped|ping)?|slip(?:s|ped|ping)?|jump(?:s|ed|ing)?|gain(?:s|ed|ing)?|los(?:e|es|ing)|lost|" +
  "advanc(?:e|es|ed|ing)|slid(?:e|es|ing)?|sank|sink(?:s|ing)?|sunk|tumbl(?:e|es|ed|ing)|" +
  "leap(?:s|ed|t|ing)?|plung(?:e|es|ed|ing)|surg(?:e|es|ed|ing))";
// #343: words between the move word and the number; a preposition starts a
// place phrase ("gained support in two places"), not a rank move.
const MOVE_GAP = "(?:(?!(?:in|at|across|for|of|on|with)\\b)\\w+\\W+){0,2}?";

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
  /\b\d+\s*(?:places?|positions?|spots?)\b/i,
  // #339: a move in number words ("fell two spots") needs a move word before it;
  // "in two places" and "fifty spots for the beta" are counts, not moves.
  new RegExp(
    `\\b${MOVE_WORD}\\W+${MOVE_GAP}${NUMBER_WORD}\\s+(?:places?|positions?|spots?)\\b`,
    "i"
  ),
  // #343: "by <number word> places" is a rank move after any verb ("improved
  // by two places", "leapfrogged Copilot by two places"), except after share,
  // split or divide ("shared by two places" is a count).
  new RegExp(
    `(?<!\\b(?:shar|split|divid)\\w*\\s+)\\bby\\W+${MOVE_GAP}${NUMBER_WORD}\\s+(?:places?|positions?|spots?)\\b`,
    "i"
  ),
  new RegExp(`(?<![\\w&#/])(?<!${ISSUE_REF_LEAD}${ISSUE_REF_RUN})#\\d{1,2}(?![\\d\\w])`, "i"),
  new RegExp(`(?<![\\w&#/])#\\d{1,2}\\s+${TOOL_NOUN}\\b`, "i"),
  new RegExp(`\\b(?:no\\.|number)\\s*(?:\\d+|${NUMBER_WORD})\\b`, "i"),
  new RegExp(
    `\\btop\\s+(?:\\d+|${NUMBER_WORD})\\b(?!\\s*(?:%|percent\\b|per\\s+cent\\b))(?!\\s+${ITEM_NOUN}\\b)`,
    "i"
  ),
];

/** The mdast fields this file reads; `remark-parse` + `remark-gfm` produce them. */
interface MdNode {
  type: string;
  url?: string;
  value?: string;
  title?: string | null;
  alt?: string | null;
  children?: MdNode[];
}

// #339: block nodes whose children are separate blocks of text.
const BLOCK_TYPES = new Set(["root", "blockquote", "list", "listItem", "footnoteDefinition", "table"]);

/**
 * The digest body as the renderer reads it.
 *
 * #339: the same parser and plugins as `WeeklyDigestView` (react-markdown runs
 * `remark-parse`, which `remark` wraps, with `remarkPlugins={[remarkGfm]}`), so
 * a link, image or definition here is one the page renders, inside a blockquote
 * or list item or with its destination on the next line.
 */
function parseDigest(body: string): MdNode {
  return remark().use(remarkGfm).parse(body) as MdNode;
}

/**
 * The URL of every `link`, `image` and `definition` node, in document order.
 *
 * #339: a `linkReference` or `imageReference` renders the URL of its
 * `definition`, and the parser only makes a reference node when that
 * definition exists, so checking every definition checks every reference. An
 * unused definition renders nothing and is still checked. A GFM autolink
 * (`https://...`, `www....`, an email) is a `link` node.
 */
export function digestLinkTargets(body: string): string[] {
  const targets: string[] = [];
  const walk = (node: MdNode): void => {
    if (node.type === "link" || node.type === "image" || node.type === "definition") targets.push(node.url ?? "");
    node.children?.forEach(walk);
  };
  walk(parseDigest(body));
  return targets;
}

/**
 * The text of `node` with every link, image and definition URL left out.
 *
 * #339: link text, image alt text and link or definition titles stay, so the
 * rank check reads them; a URL can hold digits (a slug) and does not.
 */
function proseOf(node: MdNode): string {
  const title = node.title ? ` ${node.title}` : "";
  switch (node.type) {
    case "text":
    case "inlineCode":
    case "code":
    case "html":
      return node.value ?? "";
    case "break":
      return "\n";
    case "image":
    case "imageReference":
      return `${node.alt ?? ""}${title}`;
    case "definition":
      return node.title ?? "";
    default: {
      const parts = (node.children ?? []).map(proseOf);
      const joined = BLOCK_TYPES.has(node.type) ? parts.join("\n\n") : parts.join("");
      return node.type === "tableCell" ? `${joined} ` : `${joined}${title}`;
    }
  }
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

function linkFailures(body: string, prose: string, allowedSlugs: ReadonlySet<string>): string[] {
  const failures: string[] = [];
  // #339: the URLs the renderer renders; an empty URL is not an allowed target.
  for (const target of digestLinkTargets(body)) {
    const slug = NEWS_LINK.exec(target)?.[1];
    if (target !== "/" && !(slug && allowedSlugs.has(slug))) failures.push(`disallowed_link (${target})`);
  }
  // A URL shown as text (in code, raw HTML or a link label) is not a link node.
  const bare = /(?:https?:\/\/|www\.)\S+/i.exec(prose);
  const bareFailure = bare ? `disallowed_link (${bare[0]})` : null;
  if (bareFailure && !failures.includes(bareFailure)) failures.push(bareFailure);
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
  // Link targets can hold digits (a slug), so the score check reads the text alone.
  const prose = proseOf(parseDigest(text));
  failures.push(...linkFailures(text, prose, context.allowedSlugs));

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
