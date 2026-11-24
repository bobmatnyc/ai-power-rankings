/**
 * #355: print the database fingerprint of DATABASE_URL, and nothing else.
 *
 * Why: the prod-db environment must hold the same database as vault
 *   NEON.AIPR_DATABASE_URL_NEW. The Actions log is public, so the check compares a
 *   one-way hash and never a host, database name, user or URL.
 * What: parses DATABASE_URL (no connection, no query) and prints `database sha256:<16 hex>`
 *   from `databaseFingerprint`. Exits 1 with a fixed line when the URL is missing or invalid.
 * Test: `databaseFingerprint` cases in tests/unit/timestamptz-237-preflight.test.ts.
 */
import { databaseFingerprint } from "./migration-preflight";

const fingerprint = databaseFingerprint(process.env["DATABASE_URL"]);
if (!fingerprint) {
  console.error("ERROR: DATABASE_URL is missing or not a parseable URL");
  process.exit(1);
}
console.log(`database ${fingerprint}`);
