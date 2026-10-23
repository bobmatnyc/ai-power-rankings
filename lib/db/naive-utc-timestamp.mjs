/**
 * Timezone-less timestamp columns, read as UTC.
 *
 * Why: #103 — every `timestamp(...)` column in lib/db/schema.ts and
 *   lib/db/article-schema.ts is `timestamp without time zone`, and every writer stores
 *   the UTC wall clock in it. The value on the wire carries no zone
 *   (`2026-10-23 06:00:03.123`), and the raw driver's default parser reads it in the
 *   process's local zone. A reader in America/New_York (EDT) therefore saw the
 *   06:00 UTC cron run as 10:00 UTC, four hours late.
 * What: `parseNaiveUtcTimestamp` applies one rule: a value with no zone is UTC.
 *   `naiveUtcTypes` installs that rule as the driver parser for `timestamp`
 *   (OID 1114) and leaves every other type on the driver default. Every raw reader
 *   passes it as `neon(url, { types: naiveUtcTypes })`. Plain JavaScript, so
 *   `node scripts/*.mjs` can import it without a TypeScript loader.
 * Test: `tests/unit/naive-utc-timestamp.test.ts`, run under TZ=UTC and
 *   TZ=America/New_York by `tests/unit/naive-utc-timestamp-tz.test.ts`.
 */

import { types } from "@neondatabase/serverless";

/** Postgres type OID of `timestamp without time zone`. */
export const PG_TIMESTAMP_OID = 1114;

// Postgres text output for timestamp / timestamptz, plus the ISO `T` form a JSON
// round-trip produces: date, optional time, optional fraction, optional zone.
const TIMESTAMP_TEXT =
  /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}(?::\d{2})?)(\.\d+)?)?\s*(Z|[+-]\d{2}(?::?\d{2})?)?$/i;

/** `+05` → `+05:00`, `+0530` → `+05:30`; `Z` unchanged. */
function isoZone(zone) {
  if (/^z$/i.test(zone)) return "Z";
  const digits = zone.slice(1).replace(":", "");
  return `${zone[0]}${digits.slice(0, 2)}:${digits.slice(2, 4) || "00"}`;
}

/**
 * Read a timestamp value, treating a zone-less one as UTC.
 *
 * Why: #103 — `new Date("2026-10-23 06:00:03")` uses the process's local zone; the
 *   column holds UTC.
 * What: null/undefined → null. A Date or a number passes through `new Date`. A string
 *   with a zone keeps it; a string without one is read as UTC. The fraction is cut to
 *   milliseconds (Postgres emits microseconds). An unrecognised string, such as
 *   `infinity`, gives an Invalid Date.
 * Test: `parseNaiveUtcTimestamp` cases in tests/unit/naive-utc-timestamp.test.ts.
 *
 * @param {unknown} value
 * @returns {Date | null}
 */
export function parseNaiveUtcTimestamp(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return new Date(value.getTime());
  if (typeof value === "number") return new Date(value);

  const match = TIMESTAMP_TEXT.exec(String(value).trim());
  if (!match) return new Date(Number.NaN);

  const [, day, time, fraction, zone] = match;
  const millis = fraction ? fraction.slice(0, 4) : "";
  return new Date(`${day}T${time ?? "00:00:00"}${millis}${zone ? isoZone(zone) : "Z"}`);
}

/**
 * Driver type parsers with `timestamp` read as UTC.
 *
 * Why: #103 — fixing the parse at the driver boundary covers every column a raw query
 *   selects, including `SELECT *`, with no per-column SQL.
 * What: The driver's own `types` object, with `getTypeParser` answering
 *   `parseNaiveUtcTimestamp` for OID 1114 in text format. `timestamptz` (1184) already
 *   carries its offset and stays on the default parser.
 * Test: `naiveUtcTypes` cases in tests/unit/naive-utc-timestamp.test.ts.
 */
export const naiveUtcTypes = {
  ...types,
  getTypeParser(oid, format) {
    if (oid === PG_TIMESTAMP_OID && format !== "binary") return parseNaiveUtcTimestamp;
    return types.getTypeParser(oid, format);
  },
};
