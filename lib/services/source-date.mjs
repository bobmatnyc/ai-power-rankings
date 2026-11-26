/**
 * Candidate source dates, read as ISO-8601 or RFC 2822.
 *
 * Why: #476 — Tavily returns `published_date` as RFC 2822 text
 *   ("Sun, 22 Nov 2026 06:00:00 GMT"). recordOutcome() stored it raw, and the gap
 *   detector's ISO-only parser printed `sourceDate=invalid` for every candidate.
 * What: `parseSourceDate` reads an ISO-8601 / Postgres timestamp (via
 *   parseNaiveUtcTimestamp, so a zone-less value is UTC) or a strict RFC 2822 date.
 *   `normalizeSourceDate` returns the ISO form of a date that parses, else the raw
 *   text. Plain JavaScript, so `node scripts/*.mjs` imports it without a loader.
 * Test: `tests/unit/source-date-476.test.ts`.
 */

import { parseNaiveUtcTimestamp } from "../db/naive-utc-timestamp.mjs";

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

// RFC 2822 section 3.3 date-time, plus the obsolete named zones of section 4.3.
const RFC_2822 =
  /^(?:(?:mon|tue|wed|thu|fri|sat|sun),\s*)?(\d{1,2})\s+([a-z]{3})\s+(\d{4})\s+(\d{2}):(\d{2})(?::(\d{2}))?\s+([+-]\d{4}|gmt|ut|utc|z|[ecmp][sd]t)$/i;

// Hours east of UTC for the named zones RFC 2822 allows.
const NAMED_ZONE_HOURS = { gmt: 0, ut: 0, utc: 0, z: 0, est: -5, edt: -4, cst: -6, cdt: -5, mst: -7, mdt: -6, pst: -8, pdt: -7 };

/**
 * @param {string} text
 * @returns {Date | null}
 */
function parseRfc2822(text) {
  const match = RFC_2822.exec(text);
  if (!match) return null;
  const [, dayText, monthText, yearText, hourText, minuteText, secondText, zoneText] = match;
  const month = MONTHS.indexOf(monthText.toLowerCase());
  const day = Number(dayText);
  const year = Number(yearText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText ?? "0");
  if (month < 0 || hour > 23 || minute > 59 || second > 60) return null;
  // Date.UTC rolls 31 Feb over into March; refuse it instead.
  if (day < 1 || day > new Date(Date.UTC(year, month + 1, 0)).getUTCDate()) return null;
  const zone = zoneText.toLowerCase();
  const offsetMinutes =
    zone in NAMED_ZONE_HOURS
      ? NAMED_ZONE_HOURS[zone] * 60
      : (zone[0] === "-" ? -1 : 1) * (Number(zone.slice(1, 3)) * 60 + Number(zone.slice(3, 5)));
  return new Date(Date.UTC(year, month, day, hour, minute, second) - offsetMinutes * 60 * 1000);
}

/**
 * Read a candidate source date.
 *
 * @param {unknown} value
 * @returns {Date | null} null for null/undefined and for anything that is not a real instant.
 */
export function parseSourceDate(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    const rfc = parseRfc2822(value.trim());
    if (rfc) return rfc;
  }
  const date = parseNaiveUtcTimestamp(value);
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

/**
 * The value recordOutcome() stores as `sourceDate`.
 *
 * @param {string | null | undefined} value
 * @returns {string | null} ISO-8601 when the value parses, else the raw text; null when absent.
 */
export function normalizeSourceDate(value) {
  if (value === null || value === undefined || value === "") return null;
  const date = parseSourceDate(value);
  return date ? date.toISOString() : String(value);
}
