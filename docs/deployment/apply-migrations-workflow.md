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

## Running it locally

Same script, same flags, against whatever `DATABASE_URL` your shell has:

```bash
npx tsx scripts/apply-migrations.ts --dry-run --show-columns automated_ingestion_runs
npx tsx scripts/apply-migrations.ts --only 0013_add_candidate_outcome_tracking.sql
npx tsx scripts/apply-migrations.ts        # apply every pending migration
```

The script never prints the connection string, or its host or password, even inside a
driver error message — this repository is public and the Actions log is world-readable.

## Files

- `scripts/apply-migrations.ts` — the runner, and `tests/unit/apply-migrations.test.ts`
- `.github/workflows/apply-migration.yml` — the dispatchable workflow
