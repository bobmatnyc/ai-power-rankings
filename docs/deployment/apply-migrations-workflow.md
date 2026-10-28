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

## Merging the D90 duplicate tools

The **Merge duplicate tools (D90)** workflow (`.github/workflows/merge-duplicate-tools.yml`,
D96) runs `scripts/merge-duplicate-tools.ts` against production. Its only trigger is a
manual dispatch from the Actions tab.

| Input | Default | Meaning |
|---|---|---|
| `dry_run` | `true` | Print the merge plan and write nothing. |
| `confirm` | empty | Must be `merge-d90-duplicates` to apply. Ignored on a dry run. |

1. **Dry run.** Dispatch with the defaults. The job runs the script's SELECT-only dry run
   and stops. It fails when a pair is unresolved. Review the per-pair plan in the log.
2. **Apply.** Once the dry run is reviewed and cleared, dispatch once with `dry_run: false`
   and `confirm: merge-d90-duplicates`. The job repeats the dry run, takes the script's
   backup, and runs `--apply` against that backup in one transaction. A failed dry run or
   backup stops the job before any write. A re-run is a no-op.

`dry_run: false` with any other `confirm` fails the job and runs nothing. Any non-zero
exit fails the job. The run summary records the mode, each step's outcome and the
script's count lines only (D19); the database fingerprint line is dropped from the log.
The job runs only when dispatched from `main`; a dispatch from any other ref runs no step.

The backup file lives only for the job, on the runner; it is not a restore path.

**Recovery (D98).** Before the apply dispatch, the owner creates a named Neon branch of
production in the Neon console (name pattern: `pre-d90-YYYYMMDD`) as the recovery point.
Record its name and the UTC time before the apply runs. The apply dispatch never runs
before that branch exists. Rollback is a restore from that branch; a DELETE alone is not a
rollback.

**Known gap (D99).** The dry run and the backup use the same writer `DATABASE_URL`
repository secret, by name. There is no read-only role.

## Loading the model seeds (#329)

The **Load model seed (#329)** workflow (`.github/workflows/load-model-seed.yml`) runs
`scripts/load-model-seeds.ts` against production, in the same D96 pattern. Its only trigger
is a manual dispatch from `main`.

| Input | Default | Meaning |
|---|---|---|
| `seed` | `all` | `closed` (`docs/refresh/closed-models.json`), `open-weight` (`docs/refresh/open-weight-models-refresh.json`) or both. |
| `dry_run` | `true` | Validate the seeds, print the per-row diff, write nothing. |
| `confirm` | empty | Must be `load-model-seed` to write. Ignored on a dry run. |

1. **Dry run.** Dispatch with the defaults. The job prints `insert`, `update` (with each
   changed column), `unchanged` or `REFUSED` per row and a `totals:` line. A refused row (a
   slug held by a non-model row, or a stored `open_weight` that disagrees) fails the job.
2. **Write.** Once the dry run is reviewed and cleared, dispatch with `dry_run: false` and
   `confirm: load-model-seed`. The job repeats the dry run, then writes every planned row in
   one transaction. A re-run is a no-op.

The write is an upsert keyed on slug. A new row is created `inactive`, kind `model`. On an
existing model row it sets only the seed columns (`open_weight`, `hf_repo`, `licence`,
`parameters_b`, `active_parameters_b`, `release_date`) and the `data.modelSeed` provenance
key. It never changes `status`, `name`, a description or `data.metrics`, and never activates
a row. Activation and metrics are a later, separate change.

**Recovery (D98).** Before the write dispatch, the owner creates a named Neon branch of
production (name pattern: `pre-model-seed-YYYYMMDD`) and records its name and UTC time.
Rollback is a restore from that branch.

## Loading model metrics and activating the model rows (#329)

The **Load model metrics (#329)** workflow (`.github/workflows/load-model-metrics.yml`) runs
`scripts/load-model-metrics.ts` against production, in the same D96 pattern. Its only trigger
is a manual dispatch from `main`. It writes the Vals Terminal-Bench 4.0 figure of each listed
seeded model row (D63) and, as a separate explicit step, activates the seeded model rows.

**Where the figures live.** The leaderboard figures are not published in this repository. The
reviewed file sits at the gitignored path `data/private/model-metrics.json` on the reviewer's
machine; the loader refuses a copy that is under version control. The workflow reads it from
the `MODEL_METRICS_JSON_B64` repository secret (the file, base64-encoded:
`base64 < data/private/model-metrics.json`), decodes it to a file under `RUNNER_TEMP`, never
prints it, and deletes it at the end. The loader runs with `--hide-values`, so the public log
shows which rows change but no figure. Locally the file path comes from `--metrics-file <path>`
or `MODEL_METRICS_FILE`.

File format: `checked_at` and a `metrics` array; each row has `slug` (a slug of the model seed
files), `field` (`terminal_bench` only), `value` (above 0, at most 100), `source` (exactly
`https://www.vals.ai/benchmarks/terminal-bench-4`), `as_of` (no later than `checked_at`) and an
optional `version` naming the version or dated snapshot measured when it is not the seeded
flagship. Muse Wonder is refused.

| Input | Default | Meaning |
|---|---|---|
| `dry_run` | `true` | Validate the file, print the per-row diff, write nothing. |
| `activate` | `false` | Also set the seeded model rows `active` in the same transaction. |
| `confirm` | empty | `load-model-metrics` to write metrics; `activate-model-metrics` to write and activate. Ignored on a dry run. |

1. **Dry run.** Dispatch with the defaults (add `activate: true` to also check the
   activation). The job prints `update`, `unchanged` or `REFUSED` per row and a `totals:` line.
   A refused row (no row with that slug, a non-model row, a redirect alias, a non-object
   `data.metrics`) or a refused activation fails the job.
2. **Write.** Dispatch with `dry_run: false` and `confirm: load-model-metrics`. The job repeats
   the dry run, then writes in one transaction. The write merges only
   `data.metrics.terminal_bench` (a bare number) and `data.metrics_provenance.terminal_bench`
   (`{ source, as_of }`); every other key stays. It never writes a redirect row and never
   changes `status`.
3. **Activate.** Dispatch with `dry_run: false`, `activate: true` and
   `confirm: activate-model-metrics`. The same transaction then sets `status = 'active'` on
   every row the model seed files list, and is refused unless each of them is an inactive or
   active model row that carries a Vals figure after the write. Other kinds, redirect rows and
   unlisted model rows never change.

**Activation gate (D63 Q10).** Do not dispatch step 3 before #318 has merged and the #317
audit has confirmed that no parent-company figures sit on model rows. Steps 1 and 2 may run
earlier.

**Public source line.** Any page that shows one of these figures carries: "Source: Vals AI,
Terminal-Bench 4.0 leaderboard, https://www.vals.ai/benchmarks/terminal-bench-4, as of
<as_of>". The models page shows no figure yet.

**Recovery (D98).** Before any write dispatch, the owner creates a named Neon branch of
production (name pattern: `pre-model-metrics-YYYYMMDD`) and records its name and UTC time.
Rollback is a restore from that branch.

## Files

- `scripts/apply-migrations.ts` — the runner, and `tests/unit/apply-migrations.test.ts`
- `.github/workflows/apply-migration.yml` — the dispatchable workflow
- `.github/workflows/merge-duplicate-tools.yml` — the D90 merge dispatch, and
  `tests/unit/merge-duplicate-tools-workflow-d96.test.ts`
- `.github/workflows/load-model-seed.yml` — the model seed load dispatch (#329), with
  `scripts/load-model-seeds.ts`, `tests/unit/load-model-seed-workflow-329.test.ts` and
  `tests/unit/load-model-seeds-329.test.ts`
- `.github/workflows/load-model-metrics.yml` — the model metrics and activation dispatch
  (#329), with `scripts/load-model-metrics.ts`, `tests/unit/load-model-metrics-workflow-329.test.ts`,
  `tests/unit/load-model-metrics-329.test.ts` and `tests/unit/model-metrics-pglite-329.test.ts`
