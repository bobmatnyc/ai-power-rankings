/**
 * The article summary contract: one paragraph of 80-120 words (#179).
 *
 * Why: The ingestion prompt asked for a 400-500 word summary with a bulleted
 * outline, so summaries came back as long multi-section text and the news page
 * used all of it as its meta description. #179 makes the summary one short
 * paragraph and caps the description derived from it.
 * What: `SUMMARY_PROMPT_RULE` is the one statement of the rule; every prompt
 * site in `AIAnalyzer.analyzeContent` interpolates it. `countWords` measures a
 * summary for the ingestion log only — it never rejects (rejection is #180).
 * `toMetaDescription` cuts text to `META_DESCRIPTION_MAX_CHARS` on a word
 * boundary.
 * Test: `tests/unit/article-summary-179.test.ts`.
 */

export const SUMMARY_WORD_MIN = 80;
export const SUMMARY_WORD_MAX = 120;

/** The summary rule, worded to finish the phrase "The summary must be ...". */
export const SUMMARY_PROMPT_RULE =
  `ONE paragraph of ${SUMMARY_WORD_MIN}-${SUMMARY_WORD_MAX} words of plain prose, ` +
  "with no bullet points, numbered lists, headings, markdown or line breaks";

/** Longest meta description, in characters (code points), the news page emits. */
export const META_DESCRIPTION_MAX_CHARS = 160;

/** Number of whitespace-separated words in `text`; 0 for blank text. */
export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed === "" ? 0 : trimmed.split(/\s+/).length;
}

/**
 * `text` with whitespace collapsed, cut to at most `max` code points.
 *
 * A cut ends on the last word boundary that fits and gains a trailing "…"
 * (counted in `max`). A single word longer than `max` is cut mid-word, since
 * there is no boundary to cut on.
 */
export function toMetaDescription(text: string, max = META_DESCRIPTION_MAX_CHARS): string {
  const flat = text.replace(/\s+/g, " ").trim();
  const chars = Array.from(flat); // code points, so a cut never halves a surrogate pair
  if (chars.length <= max) return flat;

  const head = chars.slice(0, max - 1).join("");
  // The next character being a space means `head` already ends on a whole word.
  const space = chars[max - 1] === " " ? head.length : head.lastIndexOf(" ");
  const cut = space > 0 ? head.slice(0, space) : head;
  return `${cut.replace(/[\s,;:.\-–—]+$/, "")}…`;
}
