# Cron schedules and stored timestamps

Reference for reading cron run times. See issue #103.

## Cron schedules are UTC

The `crons` entries in `vercel.json` run on UTC. `0 6 * * *` for
`/api/cron/daily-news` fires at 06:00 UTC, which is 02:00 in New York during
EDT and 01:00 during EST.

The team is on the Vercel Pro plan, so a cron fires within the minute of its
schedule. A run that appears hours late is a display problem, not a delay. The
2026-10-23 daily run was invoked at 06:00:03 UTC.

## Timestamp columns are `timestamptz` (UTC)

Every `timestamp(...)` column in `lib/db/schema.ts` and
`lib/db/article-schema.ts` declares `withTimezone: true`, so its type is
`timestamp with time zone` (`timestamptz`). Migration
`lib/db/migrations/0015_timestamptz_utc.sql` converted the existing columns,
reading each stored value as UTC (`AT TIME ZONE 'UTC'`). It was applied to
production on 2026-10-24 (run 40083541449, commit 73b3d716). Postgres now
returns each value with its zone, for example `2026-10-23 06:00:03.123+00`, and
every reader gets the same instant whatever its local zone.

Writers still store UTC, for example `new Date().toISOString()` for
`automated_ingestion_runs.started_at`.

## The #103 shim is kept

Before 0015 these columns were zoneless, and the database driver's default
parser read them in the process's local zone: a reader in America/New_York
showed the 06:00 UTC run as 10:00 UTC (#103). The compatibility shim from #103
is kept (Architect ruling 2026-10-24, R5). It is harmless on migrated columns,
because it only parses the zoneless `timestamp` type, and it protects unmigrated
databases, such as dev, whose columns can still be `timestamp without time zone`:
raw `neon()` clients pass `{ types: naiveUtcTypes }` from
`lib/db/naive-utc-timestamp.mjs`, scripts read these columns through
`getRawSql()` from `lib/db/connection.ts`, and a value that is already text goes
through `parseNaiveUtcTimestamp()`. Drizzle-typed selects
(`db.select().from(...)`) map both column types as UTC and need no change.

Tests: `tests/unit/naive-utc-timestamp.test.ts` and
`tests/unit/naive-utc-timestamp-tz.test.ts`, which runs the ingestion gap check
under `TZ=UTC` and `TZ=America/New_York`; `tests/unit/timestamptz-237-schema.test.ts`,
`tests/unit/timestamptz-237-preflight.test.ts` and
`tests/unit/timestamptz-237-tz.test.ts` for migration 0015; and
`tests/unit/timestamptz-237-doc.test.ts` for this page.
