# Cron schedules and stored timestamps

Reference for reading cron run times. See issue #103.

## Cron schedules are UTC

The `crons` entries in `vercel.json` run on UTC. `0 6 * * *` for
`/api/cron/daily-news` fires at 06:00 UTC, which is 02:00 in New York during
EDT and 01:00 during EST.

The team is on the Vercel Pro plan, so a cron fires within the minute of its
schedule. A run that appears hours late is a display problem, not a delay. The
2026-10-23 daily run was invoked at 06:00:03 UTC.

## Timestamp columns hold UTC with no zone

Every `timestamp(...)` column in `lib/db/schema.ts` and
`lib/db/article-schema.ts` is `timestamp without time zone`. Writers store the
UTC wall clock, for example `new Date().toISOString()` for
`automated_ingestion_runs.started_at`; Postgres drops the `Z`. Postgres returns
the value with no zone, for example
`2026-10-23 06:00:03.123`.

Read these values as UTC. `new Date("2026-10-23 06:00:03")` and the database
driver's default parser use the process's local zone, so a reader in
America/New_York shows the 06:00 UTC run as 10:00 UTC.

- Raw `neon()` clients pass `{ types: naiveUtcTypes }` from
  `lib/db/naive-utc-timestamp.mjs`.
- Scripts that used `getDb().execute()` for these columns use `getRawSql()` from
  `lib/db/connection.ts`.
- A value that is already text goes through `parseNaiveUtcTimestamp()`.
- Drizzle-typed selects (`db.select().from(...)`) already map these columns as
  UTC and need no change.

Moving the columns to `timestamptz` needs a migration. That is separate work.

Tests: `tests/unit/naive-utc-timestamp.test.ts` and
`tests/unit/naive-utc-timestamp-tz.test.ts`, which runs the ingestion gap check
under `TZ=UTC` and `TZ=America/New_York`.
