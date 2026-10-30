/**
 * Word-count bounds of the monthly report (#182).
 *
 * Why: #182 merges two monthly generators (a ~1,500-word summary and a
 *   400-600-word editorial) into one report of 300-450 words. The model is
 *   asked for that length; this module rejects a reply outside it before it is
 *   stored, so an over- or under-length reply never becomes the served report.
 * What: `countReportWords()` counts the words a reader sees: a markdown link
 *   counts as its text, a bare URL and a token with no letter or digit (a
 *   heading or list marker) count as nothing. `assertReportWordCount()` returns the count
 *   when it is within `MONTHLY_REPORT_MIN_WORDS`..`MONTHLY_REPORT_MAX_WORDS`
 *   (inclusive) and throws `MonthlyReportLengthError` otherwise.
 * Test: `tests/unit/monthly-report-182.test.ts`.
 */

export const MONTHLY_REPORT_MIN_WORDS = 300;
export const MONTHLY_REPORT_MAX_WORDS = 450;

/** The reply's word count is outside the monthly report's bounds. */
export class MonthlyReportLengthError extends Error {
  constructor(public readonly wordCount: number) {
    super(
      `Monthly report has ${wordCount} words; it must be ` +
        `${MONTHLY_REPORT_MIN_WORDS}-${MONTHLY_REPORT_MAX_WORDS}`
    );
    this.name = "MonthlyReportLengthError";
  }
}

/** Words a reader sees in `markdown`; a token counts when it holds a letter or digit. */
export function countReportWords(markdown: string): number {
  // A bare marker token (`##`, `-`, `**`) holds no letter or digit, so it is
  // never counted; a hyphenated word stays one word.
  const visible = markdown
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1") // [text](url) -> text
    .replace(/https?:\/\/\S+/g, " ");
  return visible.split(/\s+/).filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
}

/** The word count of `markdown`; throws `MonthlyReportLengthError` when out of bounds. */
export function assertReportWordCount(markdown: string): number {
  const words = countReportWords(markdown);
  if (words < MONTHLY_REPORT_MIN_WORDS || words > MONTHLY_REPORT_MAX_WORDS) {
    throw new MonthlyReportLengthError(words);
  }
  return words;
}
