/**
 * ISO-week windows and keys for the weekly digest (#181).
 *
 * Why: the digest is keyed `YYYY-Www` and reads one closed Monday to Sunday UTC
 * week, so a retry reads the same articles and a stored week is found again.
 * What: `weekRangeLabel` words a window for titles; `digestRange` and `digestBody` serve the pages and the feed. `isoWeekKey` names the ISO-8601 week of an instant; `previousIsoWeek`
 * is the last full week before it; `windowForWeek` turns a stored key back into
 * its window and returns null for a key that is not a real ISO week.
 * Test: `tests/unit/weekly-digest-window-181.test.ts`.
 */

export interface IsoWeekWindow {
  /** `YYYY-Www`, ISO-8601 week-year and week number. */
  week: string;
  /** Monday 00:00:00.000 UTC. */
  start: Date;
  /** Sunday 23:59:59.999 UTC. */
  end: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_KEY = /^(\d{4})-W(\d{2})$/;

/** Monday 00:00 UTC of the ISO week containing `date`. */
function mondayOf(date: Date): Date {
  const day = date.getUTCDay() || 7; // Sunday is 7 in ISO weeks
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - (day - 1)));
}

/** The ISO week key of `date`, read in UTC. */
export function isoWeekKey(date: Date): string {
  // #181: the ISO week-year is the year of the week's Thursday, so 29-31 December
  // can belong to week 1 of the next year and 1-3 January to week 52 or 53.
  const thursday = new Date(mondayOf(date).getTime() + 3 * DAY_MS);
  const year = thursday.getUTCFullYear();
  const yearStart = Date.UTC(year, 0, 1);
  const week = Math.floor((thursday.getTime() - yearStart) / DAY_MS / 7) + 1;
  return `${year}-W${String(week).padStart(2, "0")}`;
}

function windowStartingAt(start: Date): IsoWeekWindow {
  return {
    week: isoWeekKey(start),
    start,
    end: new Date(start.getTime() + 7 * DAY_MS - 1),
  };
}

/** The last full ISO week that ended before the week containing `now`. */
export function previousIsoWeek(now: Date): IsoWeekWindow {
  return windowStartingAt(new Date(mondayOf(now).getTime() - 7 * DAY_MS));
}

/** The window named by `week`, or null when it is not a real ISO week. */
export function windowForWeek(week: string): IsoWeekWindow | null {
  const match = WEEK_KEY.exec(week);
  if (!match) return null;
  const year = Number(match[1]);
  const number = Number(match[2]);
  if (number < 1 || number > 53) return null;
  // Week 1 is the week holding 4 January.
  const week1Monday = mondayOf(new Date(Date.UTC(year, 0, 4)));
  const window = windowStartingAt(new Date(week1Monday.getTime() + (number - 1) * 7 * DAY_MS));
  // A key that rolls into the next year (W53 of a 52-week year) does not round-trip.
  return window.week === week ? window : null;
}

const SHORT_DATE: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", timeZone: "UTC" };
const LONG_DATE: Intl.DateTimeFormatOptions = { ...SHORT_DATE, year: "numeric" };

/** "Oct 19 to Oct 25, 2026"; both years when the week spans 1 January. */
export function weekRangeLabel(window: IsoWeekWindow): string {
  const sameYear = window.start.getUTCFullYear() === window.end.getUTCFullYear();
  const from = window.start.toLocaleDateString("en-US", sameYear ? SHORT_DATE : LONG_DATE);
  return `${from} to ${window.end.toLocaleDateString("en-US", LONG_DATE)}`;
}

/** "Oct 19 to Oct 25, 2026" for "2026-W43", or the key itself for a malformed one. */
export function digestRange(week: string): string {
  const window = windowForWeek(week);
  return window ? weekRangeLabel(window) : week;
}

/**
 * The digest markdown without its first `# ` line.
 *
 * #181: the stored text opens with a code-built title. The page shows that title
 * as its own heading, so the body drops the line to keep one h1.
 */
export function digestBody(content: string): string {
  return content.replace(/^\s*#[ \t][^\n]*\n+/, "");
}
