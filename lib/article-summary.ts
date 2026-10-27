/**
 * The article summary contract: one paragraph of 80-120 words (#179).
 *
 * Why: The ingestion prompt asked for a 400-500 word summary with a bulleted
 * outline, so summaries came back as long multi-section text and the news page
 * used all of it as its meta description. #179 makes the summary one short
 * paragraph and caps the description derived from it.
 * What: `SUMMARY_PROMPT_RULE` is the one statement of the rule; every prompt
 * site in `AIAnalyzer.analyzeContent` interpolates it. `countWords` measures a
 * summary. `validateSummary` (#180) checks one against the rule — word range,
 * single paragraph, sentence end — and `SummaryRejectedError` carries the
 * failed checks out of the analyzer once the one retry has also failed.
 * `toMetaDescription` cuts text to `META_DESCRIPTION_MAX_CHARS` on a word
 * boundary.
 * Test: `tests/unit/article-summary-179.test.ts`,
 * `tests/unit/article-summary-validator-180.test.ts`.
 */

export const SUMMARY_WORD_MIN = 80;
export const SUMMARY_WORD_MAX = 120;

/** The summary rule, worded to finish the phrase "The summary must be ...". */
export const SUMMARY_PROMPT_RULE =
  `ONE paragraph of ${SUMMARY_WORD_MIN}-${SUMMARY_WORD_MAX} words of plain prose, ` +
  "with no bullet points, numbered lists, headings, markdown or line breaks";

/** #180: wait before the single regeneration of a rejected summary. */
export const SUMMARY_RETRY_BACKOFF_MS = 2000;

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

/** A line starting with a list marker: "- ", "* ", "• " or "1." / "1)" (one or two digits). */
const LIST_MARKER = /^\s*(?:[-*•▪◦]|\d{1,2}[.)])\s/m;

/** A sentence end ("." "!" "?"), optionally followed by closing quotes or brackets. */
const SENTENCE_END = /[.!?]["'”’)\]]*$/;

/**
 * #180: the checks `summary` fails; an empty array means it is valid.
 *
 * Each entry is a short code that goes into the recorded rejection reason:
 * `not_single_paragraph` (a line break or a list marker), `word_count_below_min
 * (N<80)`, `word_count_above_max (N>120)`, `no_sentence_end`. Entries come in
 * that fixed order. Surrounding whitespace is ignored.
 */
export function validateSummary(summary: string): string[] {
  const text = summary.trim();
  const failures: string[] = [];

  if (/[\r\n]/.test(text) || LIST_MARKER.test(text)) failures.push("not_single_paragraph");

  const words = countWords(text);
  if (words < SUMMARY_WORD_MIN) failures.push(`word_count_below_min (${words}<${SUMMARY_WORD_MIN})`);
  if (words > SUMMARY_WORD_MAX) failures.push(`word_count_above_max (${words}>${SUMMARY_WORD_MAX})`);

  if (!SENTENCE_END.test(text)) failures.push("no_sentence_end");
  return failures;
}

/**
 * #180: a summary that failed validation on the retry as well.
 *
 * `reason` is what the candidate outcome records; it names every failed check.
 */
export class SummaryRejectedError extends Error {
  readonly failures: readonly string[];
  readonly reason: string;

  constructor(failures: readonly string[]) {
    const reason = `summary_rejected: ${failures.join("; ")}`;
    super(reason);
    this.name = "SummaryRejectedError";
    this.failures = failures;
    this.reason = reason;
  }
}
