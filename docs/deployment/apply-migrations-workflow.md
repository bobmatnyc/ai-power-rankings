# Applying a database migration

Migrations in `lib/db/migrations/` are applied by hand, not by the deploy. Migration
`0013_add_candidate_outcome_tracking.sql` shipped with the #133 deploy and was never
applied, and production ingestion was down from 2026-09-04 until someone noticed (#134).

Nobody can pull a production `DATABASE_URL` to a laptop — secrets are injected at runtime.
The `DATABASE_URL` GitHub Actions repository secret does reach production, so the apply
runs from CI.

## Procedure

Run the **Apply database migration** workflow twice, from the Actions tab.

1. **Dry run first.** Dispatch with `migration_file` set to the filename (e.g.
   `0013_add_candidate_outcome_tracking.sql`) and `dry_run: true` (the default). The job
   connects, writes nothing, and puts three things in the run summary: the migration files
   on disk, which of them are recorded as applied in `_drizzle_migrations`, and the current
   columns of `show_columns_table` (default `automated_ingestion_runs`). Read the pending
   list and confirm the file you named is on it.
2. **Then apply.** Re-dispatch the same `migration_file` with `dry_run: false`. The job
   repeats the dry run, then applies exactly that one file and prints the target table's
   columns before and after. Other pending migrations are listed but left alone.

The apply refuses, non-zero, if the named file is not on disk or is already recorded in
`_drizzle_migrations` — a repeat dispatch fails loudly rather than re-running its
statements.

## When a migration is recorded but its columns are missing

A tracking row is not proof the statements ran. Until #134 the runner dropped any chunk of
a migration file whose first characters were `--`, so a file could be recorded as applied
with none of its `ALTER TABLE`s executed — `0013_add_candidate_outcome_tracking.sql` has a
comment line above each of its two statements, and production may hold a row for it with
neither `articles_skipped_stale` nor `candidate_outcomes` present. The dry run says as much
beside every recorded file: compare its list against the columns printed below it.

When they disagree, dispatch with `dry_run: false` and `force: true`. `--force` lifts the
already-recorded refusal for that one file only, re-executes its statements, and keeps the
existing tracking row rather than inserting a second. It is safe because every migration
here is guarded (`IF EXISTS` / `IF NOT EXISTS`), which is also what makes any interrupted
apply re-runnable — the statements and the tracking row are separate calls with no
enclosing transaction, so a failure between them leaves the DDL applied and the file still
pending. `--force` is rejected without `--only`; it never re-runs everything.

## Running it locally

Same script, same flags, against whatever `DATABASE_URL` your shell has:

```bash
npx tsx scripts/apply-migrations.ts --dry-run --show-columns automated_ingestion_runs
npx tsx scripts/apply-migrations.ts --only 0013_add_candidate_outcome_tracking.sql
npx tsx scripts/apply-migrations.ts --only 0013_add_candidate_outcome_tracking.sql --force
npx tsx scripts/apply-migrations.ts        # apply every pending migration
```

The script never prints the connection string, or its host or password, even inside a
driver error message — this repository is public and the Actions log is world-readable.

## Files

- `scripts/apply-migrations.ts` — the runner, and `tests/unit/apply-migrations.test.ts`
- `.github/workflows/apply-migration.yml` — the dispatchable workflow
