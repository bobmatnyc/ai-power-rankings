/**
 * Calendar-date formatting for stored UTC dates and timestamps (#239).
 *
 * Why: article and ranking dates are stored as UTC (an `event_date` of
 *   `2026-10-21T00:00:00Z`). `toLocaleDateString` without a `timeZone` formats
 *   in the runtime's zone, so a browser west of UTC named the previous day and
 *   disagreed with the server render (React hydration error #418).
 * What: `formatUtcDate` is `toLocaleDateString` with `timeZone: "UTC"` forced,
 *   so every browser and server prints the same calendar day.
 * Test: `tests/unit/utc-client-dates-239.test.tsx`.
 */

export function formatUtcDate(
  value: Date | string | number,
  locale: string | undefined,
  options: Intl.DateTimeFormatOptions = {}
): string {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleDateString(locale, { ...options, timeZone: "UTC" });
}

