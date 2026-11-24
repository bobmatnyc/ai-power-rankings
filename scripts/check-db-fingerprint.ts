/**
 * #355: check that DATABASE_URL points at the expected database, printing nothing derived from it.
 *
 * Why: the prod-db environment must hold the same database as vault NEON.AIPR_DATABASE_URL_NEW.
 *   D19: the repo is public, so no fingerprint hash, host, database name, user or URL may reach
 *   the Actions log. The check compares and reports only match or mismatch.
 * What: computes `databaseFingerprint(DATABASE_URL)` (URL parse only: no connection, no write) and
 *   compares it, in constant time, with the EXPECTED_DB_FINGERPRINT env secret
 *   (`sha256:<16 hex>`). Prints exactly `database match` (exit 0) or `database mismatch` (exit 1).
 *   A missing or unparseable value prints a fixed line naming the variable, never its value, exit 1.
 * Test: PENDING. `databaseFingerprint` cases in tests/unit/timestamptz-237-preflight.test.ts
 *   cover the hash; the compare has no test yet.
 */
import { timingSafeEqual } from "crypto";
import { databaseFingerprint } from "./migration-preflight";

/** Equal-length buffers only; a length difference is a mismatch. */
export function fingerprintsMatch(actual: string, expected: string): boolean {
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function main(): number {
  const expected = (process.env["EXPECTED_DB_FINGERPRINT"] ?? "").trim();
  if (!expected) {
    console.error("ERROR: EXPECTED_DB_FINGERPRINT is missing or empty");
    return 1;
  }
  const rawUrl = process.env["DATABASE_URL"];
  if (!rawUrl) {
    console.error("ERROR: DATABASE_URL is missing or empty");
    return 1;
  }
  const actual = databaseFingerprint(rawUrl);
  if (!actual) {
    console.error("ERROR: DATABASE_URL is not a parseable URL");
    return 1;
  }
  if (fingerprintsMatch(actual, expected)) {
    console.log("database match");
    return 0;
  }
  console.log("database mismatch");
  return 1;
}

process.exit(main());
