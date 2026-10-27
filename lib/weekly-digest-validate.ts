/**
 * Weekly digest validation (#181).
 *
 * Why: the model writes the digest body and a bad one would be published to
 * readers and RSS. The owner ruled a 250-350 word digest (80-120 for a thin
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

/** Owner ruling 2026-10-27: 250-350 words; a short digest is 80-120. */
export const DIGEST_WORDS: Record<DigestTier, { min: number; max: number }> = {
  short: { min: 80, max: 120 },
  full: { min: 250, max: 350 },
};

const SECTIONS = ["The week in short", "What mattered", "New and changed", "Worth watching"] as const;
const REQUIRED_SECTIONS = ["The week in short", "What mattered"] as const;
const HEADING = /^(#{1,6})\s+(.*?)\s*$/;
const BULLET = /^\s*[-*]\s+/;
const NEWS_LINK = /^\/en\/news\/([a-z0-9-]+)$/;

// #181: a score or a rank change, as digits. Counts, versions and dates are not matched.
const SCORE_OR_RANK: readonly RegExp[] = [
  /\b\d+(?:\.\d+)?\s*(?:\/|out of)\s*(?:10|100)\b/i,
  /\b(?:scores?|scored|ratings?|rated)\b\W+(?:\w+\W+){0,3}?\d/i,
  /\brank(?:ed|ing|s)?\b\W+(?:(?:at|in|as|to|from|number|no\.?)\W+){0,2}\d/i,
  /\b\d+(?:st|nd|rd|th)\s+(?:place|rank|position|spot)\b/i,
  /\b\d+\s*(?:places?|positions?|spots?)\b/i,
];

/** A fresh global pattern per call: a shared one keeps `lastIndex` between calls. */
const markdownLinks = () => /\[[^\]]*\]\(([^)\s]*)\)/g;

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
  for (const match of body.matchAll(markdownLinks())) {
    const target = match[1] ?? "";
    const slug = NEWS_LINK.exec(target)?.[1];
    if (target !== "/" && !(slug && allowedSlugs.has(slug))) failures.push(`disallowed_link (${target})`);
  }
  const bare = /(?:https?:\/\/|www\.)\S+/i.exec(body.replace(markdownLinks(), "]"));
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
  const prose = text.replace(markdownLinks(), "]");
  for (const pattern of SCORE_OR_RANK) {
    const hit = pattern.exec(prose);
    if (hit) failures.push(`score_or_rank_number (${hit[0].trim()})`);
  }
  return failures;
}
