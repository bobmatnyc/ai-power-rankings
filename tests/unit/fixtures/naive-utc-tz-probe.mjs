/**
 * Child-process probe for tests/unit/naive-utc-timestamp-tz.test.ts (#103).
 *
 * Why: the process time zone is fixed when a process starts, so comparing TZ=UTC with
 *   TZ=America/New_York needs one process per zone.
 * What: Feeds check-ingestion-gap.mjs the wire text Postgres sends for its
 *   timestamp-without-time-zone columns, parsed by the type parsers the script hands
 *   neon() (the driver default when it hands none), and as raw text. Prints one JSON
 *   object with the verdict lines, the age and the detail lines.
 * Test: tests/unit/naive-utc-timestamp-tz.test.ts.
 */

import { types as driverTypes } from "@neondatabase/serverless";
import * as gap from "../../../scripts/check-ingestion-gap.mjs";
import { naiveUtcTypes, toUtcTimestampSql } from "../../../lib/db/naive-utc-timestamp.mjs";

const PG_TIMESTAMP_OID = 1114;
const parseWire = (gap.NEON_OPTIONS?.types ?? driverTypes).getTypeParser(PG_TIMESTAMP_OID, "text");

// The 2026-10-23 daily cron run, as Postgres renders the stored UTC wall clock.
const STARTED_WIRE = "2026-10-23 06:00:03.123";
const NOW_MS = Date.parse("2026-10-23T17:00:03.123Z");

const run = (startedAt) => ({ started_at: startedAt, status: "completed", articles_ingested: 2, error_log: [] });
const article = (value) => ({ id: "a1", slug: "s", status: "active", published_date: value, created_at: value });

const viaDriver = gap.evaluateIngestionRuns([run(parseWire(STARTED_WIRE))], NOW_MS);
const viaText = gap.evaluateIngestionRuns([run(STARTED_WIRE)], NOW_MS);

process.stdout.write(
  JSON.stringify({
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    driverLines: viaDriver.lines,
    textLines: viaText.lines,
    driverDetail: gap.formatIngestedArticleLines(["a1"], [article(parseWire(STARTED_WIRE))]),
    textDetail: gap.formatIngestedArticleLines(["a1"], [article(STARTED_WIRE)]),
    // #103: the published_date literal migrate-v76-to-articles-simple.ts writes.
    migrateLiteral: toUtcTimestampSql(naiveUtcTypes.getTypeParser(PG_TIMESTAMP_OID, "text")("2025-11-03 00:00:00")),
  })
);
