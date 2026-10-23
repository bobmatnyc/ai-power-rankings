/**
 * Period parsing and text helpers for the `/whats-new` monthly reports (#54).
 *
 * Why: a report URL is `/whats-new/<YYYY-MM>`, and the same period string
 * names the stored row, the page heading and the metadata title. One module
 * keeps the URL rule and the month label consistent across them.
 */

/** A stored summary period: `YYYY-MM`, month 01-12, nothing else. */
export const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** True when `value` is a well-formed `YYYY-MM` period (#54). */
export function isValidPeriod(value: string): boolean {
  return PERIOD_PATTERN.test(value);
}

/**
 * "July 2026" for "2026-07".
 *
 * #54: formatted in UTC. The old index parsed `<period>-01` as UTC midnight and
 * formatted it in the server's zone, which names the previous month west of UTC.
 */
export function formatPeriod(period: string): string {
  return new Date(`${period}-01T00:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

const MAX_DESCRIPTION_LENGTH = 160;

/**
 * The first sentence of a report's markdown body, as plain text, for the
 * meta description (#54).
 *
 * What: Skips blank lines, headings, rules and table rows, strips quote and
 * list markers and inline markdown (emphasis, code, links keep their text,
 * HTML tags are dropped), and returns the first
 * sentence of the first remaining line, cut to 160 characters. Returns null
 * when the body has no prose line.
 */
export function firstSentence(markdown: string): string | null {
  for (const raw of markdown.split("\n")) {
    const line = raw.trim();
    if (!line || /^(#|---|\*\*\*|\|)/.test(line)) continue;
    const text = line
      .replace(/^>\s*/, "")
      .replace(/^([-*+]|\d+\.)\s+/, "")
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/[*_`]/g, "")
      .replace(/<[^>]*>/g, "")
      .trim();
    if (!text) continue;
    const sentence = /^(.+?[.!?])(\s|$)/.exec(text)?.[1] ?? text;
    return sentence.length > MAX_DESCRIPTION_LENGTH
      ? `${sentence.slice(0, MAX_DESCRIPTION_LENGTH - 1).trimEnd()}…`
      : sentence;
  }
  return null;
}
