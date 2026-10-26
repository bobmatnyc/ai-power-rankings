/**
 * The rankings page header's version and date text (#305).
 *
 * Why: the header named a fixed "Algorithm v7.6" from the dictionaries and set its
 *   "as of" date in client effects, so the server HTML disagreed with the published ranking.
 * What: `formatAlgorithmVersion` makes the one display form, `v<digits>`, from the API's
 *   `algorithm.version` ("7.10" and "v1.0" alike). `formatHeaderDate` formats a published
 *   timestamp in UTC. Each returns `null` when its input is missing or unusable, so the
 *   caller leaves that part out. `rankingsSubtitle` and `rankingsAsOf` fill the dictionary
 *   placeholders.
 * Test: `tests/unit/rankings-header-305.test.tsx`.
 */
import { formatUtcDate } from "@/lib/format-utc-date";

/** "7.10" and "v1.0" both become "v<digits>"; anything without a digit is no version. */
export function formatAlgorithmVersion(raw: unknown): string | null {
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  const match = /\d+(?:\.\d+)*/.exec(String(raw));
  return match ? `v${match[0]}` : null;
}

/** A UTC calendar date, or `null` for a missing or invalid timestamp (never "Invalid Date"). */
export function formatHeaderDate(
  value: string | null | undefined,
  locale: string,
  month: "short" | "long"
): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return formatUtcDate(date, locale, { month, day: "numeric", year: "numeric" });
}

interface HeaderText {
  subtitle: string;
  subtitleNoVersion: string;
  asOf: string;
}

/** The subtitle with the version filled in; the version-free wording when there is none. */
export function rankingsSubtitle(text: HeaderText, version: string | null): string {
  return version ? text.subtitle.replace("{version}", () => version) : text.subtitleNoVersion;
}

/** The "as of" line, or `null` when there is no date. */
export function rankingsAsOf(text: HeaderText, date: string | null): string | null {
  return date ? text.asOf.replace("{date}", () => date) : null;
}
