# D9f: missing tracking rows for migrations 0000, 0001, 0012, 0027, 0028

Basis: `origin/main` 8162aa0e, read with `git show`/`git log`. No database was contacted. Nothing was applied.

## Conclusion

The five files are two different cases.

- **0000, 0001, 0012**: historical. They were applied (or their objects created) by routes and scripts that never wrote a row to `_drizzle_migrations`. The tracking table did not exist before 2026-09-06 in its current role. These are a bookkeeping gap. Whether prod holds the objects is unverified, and the SQL checklist in section 4 settles it.
- **0027, 0028**: probably not a gap. Both were committed 2026-10-28 (#315). 0028's own header says "APPLY WITH ACTIVATION, AFTER 2026-11-01, not with 0027". Neither is a tracked-but-unrecorded migration; both are likely still pending by design. Marking them applied would suppress a deliberate, data-modifying change.

Recommendation (section 5): insert tracking rows for 0000, 0001 and 0012 only after the checklist confirms their objects. Leave 0027 and 0028 pending and apply them through the workflow under the owner's activation decision.

## 1. Where migrations live and how they are applied

- Files: `lib/db/migrations/*.sql` (drizzle-kit `out`, `drizzle.config.ts:5`). On disk at 8162aa0e: 0000, 0001, 0012-0022, 0024, 0027-0031. Numbers 0002-0011, 0023, 0025, 0026 have no file.
- `drizzle-kit` (devDependency `^0.31.11`) generated 0000 and 0001 (hash-style names `oval_manta`, `easy_mesmero`). Later files are hand-written.
- `lib/db/migrations/meta/_journal.json` lists only 4 entries: 0000, 0001, `0003_add_scoring_columns`, `0004_ranking_versions`. The last two have no `.sql` file on disk. The journal and snapshots (0000, 0001, 0004) are stale. `drizzle-kit migrate` is not used by anything.
- **Applier**: the repo's own runner `scripts/apply-migrations.ts`, not drizzle-kit and not drizzle's `migrate()`.
  - Tracking table `_drizzle_migrations` (`apply-migrations.ts:52`), created on demand (`:603-608`): `id SERIAL, hash TEXT NOT NULL, created_at BIGINT NOT NULL`. Drizzle's native table is `drizzle.__drizzle_migrations` with SHA hashes; this one is different and is a custom table in `public`.
  - **Key is the file name, not a content hash and not the journal tag.** The `hash` column stores the full filename including `.sql` (`recordApplied`, `:619-620`; `listAppliedFilenames` selects `hash`, `:611-612`). The original version (commit 8cabd44a) says "Use filename as hash for simplicity". The journal tag (`0000_oval_manta`, no `.sql`) is not used. A rename of a file therefore makes it look unapplied.
  - Decision logic: `planMigrations` (`:262-299`). `pending` = files on disk whose name is not in the recorded set. `--only X` runs just X and refuses when X is absent on disk or already recorded; `--force` lifts the second refusal and keeps the existing row (`skipRecord`). No content check, no ordering check, no transaction around statements plus the record insert.
  - Statement splitting: `splitStatements` (`:236-248`) splits on `--> statement-breakpoint`, drops chunks that are only comments.
  - Dry run lists on-disk, recorded and pending files and writes nothing (`runMigrations`, `:364+`).
- **Workflow**: `.github/workflows/apply-migration.yml`. Manual `workflow_dispatch`, input `migration_file`, `dry_run` default true, `force`. A dry run always executes first; the apply step passes `--only <file>` (so it never "applies all pending"). Real apply only from `refs/heads/main` (#355, workflow step at lines 100-114 and the same guard in the script, `:652`).
- **Second, older path**: `app/api/admin/run-migrations/route.ts` (admin GET). It runs only 0000 and 0001 (`:80`), skips 0000 if companies/tools/news/rankings/migrations tables exist and skips 0001 if `articles` exists, treats "already exists" errors as success, and **never writes `_drizzle_migrations`**. It also reads from `src/lib/db/migrations`, a path that does not exist in this layout, so it likely fails today.
- **Side scripts** that run DDL directly without recording: `scripts/apply-semantic-migration.ts` (0012's `ADD COLUMN IF NOT EXISTS`), `apply-automated-ingestion-migration.ts`, `apply-scoring-migration.ts`, etc.

## 2. The five files

| File | Creates / alters | Idempotent? | Safe to re-run where objects exist? | Data-modifying |
|---|---|---|---|---|
| `0000_oval_manta.sql` (88 lines) | Tables `companies`, `migrations`, `news`, `rankings`, `tools` (uuid PKs, jsonb `data`, unique constraints on slug / name / article_id). 20 indexes: `companies_slug_idx`, `companies_name_idx`, `companies_data_gin_idx`, `migrations_name_idx`, `migrations_status_idx`, `news_*` (slug, article_id, published, category, source, importance, data_gin, tool_mentions_gin, title_search), `rankings_period_idx` (unique), `rankings_current_idx`, `rankings_published_idx`, `rankings_data_gin_idx`, `tools_slug_idx`, `tools_category_idx`, `tools_status_idx`, `tools_name_idx`, `tools_data_gin_idx` | No. Plain `CREATE TABLE` / `CREATE INDEX`, no `IF NOT EXISTS` | **No.** The first statement raises "already exists"; the runner stops, nothing recorded. The script has no "already exists" tolerance (only the legacy admin route did) | None |
| `0001_easy_mesmero.sql` (86 lines) | Enum `article_status`; tables `articles`, `article_processing_logs`, `article_rankings_changes`; 2 FKs (cascade) to `articles`; 15 indexes (`idx_article_processing_*`, `idx_article_rankings_*`, `idx_articles_*` incl. unique slug and 3 GIN) | No (plain `CREATE TYPE`/`TABLE`/`INDEX`, `ADD CONSTRAINT`) | **No.** Fails on `CREATE TYPE` | None |
| `0012_add_semantic_skipped_tracking.sql` (8 lines) | `ALTER TABLE automated_ingestion_runs ADD COLUMN IF NOT EXISTS articles_skipped_semantic integer DEFAULT 0` | Yes | **Yes**, a no-op if the column exists. Fails only if `automated_ingestion_runs` is missing (it is not created by any migration file in the repo) | None. The new column carries `DEFAULT 0`; a rewrite-free add on current Postgres |
| `0027_create_productivity_rows.sql` (71 lines) | One DO block: `SET LOCAL lock_timeout='5s'`; preconditions (`tools.kind` exists, so 0016 applied; no target slug exists with another kind); `INSERT` of 9 `tools` rows (`chatgpt`, `gemini-app`, `hermes-agent`, `microsoft-copilot`, `manus`, `genspark`, `mistral-vibe`, `notion-ai`, `grok-app`), `status='inactive'`, `kind='productivity'`, `company_id NULL`, `ON CONFLICT (slug) DO NOTHING`; post-check raises unless exactly 9 exist | Yes (conflict-safe, guarded) | Yes. Re-run writes nothing | **Yes, data**: 9 inserts. Inactive, so hidden from rankings/sitemap |
| `0028_convert_productivity_existing_rows.sql` (238 lines) | One DO block: guards, then UPDATEs on `tools`: `claude-artifacts` renamed "Claude.AI" (name, kind, subcategory, category, `data.name`, `data.info.website`); `openclaw` kind plus website, pricing_model, free_tier, license_type (two JSON paths), `info_provenance`; `clawdbot`, `moltbot`, `cowork-ai` aliases kind; `perplexity` kind, subcategory, category; `chatgpt-canvas`, `claude-desktop-extensions`, `cowork` kind. Raises unless 6 rows end up `productivity` | Yes: every UPDATE is conditional on the row not already being in the target state, so a re-run writes nothing and leaves `updated_at` alone | Yes | **Yes, live data on active rows.** Moves six tools off the harness/other boards at the next publish; header says apply with activation after 2026-11-01. Raises if `openclaw`'s website/pricing/licence hold unexpected values, or if `tool_links` still uses these rows as harness |

Ordering dependency: 0027 and 0028 both need `tools.kind` (0016). 0028 also reads `tool_links` (0016) if present.

## 3. Likely explanation for the gap (git evidence)

Tracking-table history:
- 8cabd44a (2025-10-07) first added a runner with `_drizzle_migrations` keyed by filename. That runner dropped any chunk beginning with `--`.
- e3688b21 / 5ef77dc9 (2026-09-06, #134) added the dispatchable workflow, `--only`, `--force`. The doc `docs/deployment/apply-migrations-workflow.md:31-37` records that the old splitter could record a file whose statements never ran (0013 case).

Per file:
- **0000, 0001**: both come from the initial commit (2024ca03, 2025-09-29). The schema was created by the legacy admin route (which never records) and/or `drizzle-kit push`, before the tracking runner existed. Docs in the repo state they are applied: `docs/development/guides/SCHEMA_ANALYSIS_SUMMARY.md:28-29` ("Applied"). Cause: baseline created outside the tool. No rename or regeneration is visible: the files have a single commit each and are unchanged.
- **0012**: added 2026-02-06 (02e39471) together with `scripts/apply-semantic-migration.ts`, which runs the same `ADD COLUMN IF NOT EXISTS` directly and does not record. The runner's later cycle (Sept 2026) went straight to `--only 0013`. Because every use of the workflow targets one named file, 0012 was never named, so no row was written. Note the 2025 runner's splitter would also have dropped 0012 (its only chunk starts with `-- Migration:`), so even a bulk run would not have applied it.
- **0027, 0028**: added 2026-10-28 (4715f650, #315). 0027's header says apply via the workflow; 0028's says apply "after 2026-11-01, not with 0027". `0029`'s header ("Numbered 0029 because 0027 and 0028 are taken on main") shows later work was built around them while they stayed unapplied. A missing row for both, with 0024 (committed 2026-11-03, #316) applied, is consistent with pending-by-design. The record on `origin/main` has no brief marking either as applied (the untracked local `docs/briefs/` has no 0027/0028 mention either).
- Hash mismatch / rename: ruled out for the key scheme, because the key is the filename and no file was renamed (`git log --follow` shows one commit for 0000, 0001, 0012, 0027, 0028).
- Why so many numbers have no file: 0002-0011, 0023, 0025, 0026 are absent from the tree entirely. That is separate from this gap, but it confirms migrations were historically applied by hand outside the tracked set.

Caveat: this is inferred from the repo. The production tracking table itself could not be inspected; section 4 closes that.

## 4. Read-only SQL checklist (SELECT only; do not run from here)

Run each in a read-only transaction. All objects are in `public`.

```sql
-- A. Tracking table state
SELECT id, hash, created_at, to_timestamp(created_at/1000.0) AS recorded_at
  FROM _drizzle_migrations ORDER BY hash;
-- Also confirm the drizzle-native table is not in use:
SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS drizzle_native_table;

-- B. 0000: tables and indexes (expect 5 tables, 20 indexes)
SELECT table_name FROM information_schema.tables
 WHERE table_schema='public' AND table_name IN ('companies','migrations','news','rankings','tools');
SELECT indexname FROM pg_indexes WHERE schemaname='public' AND indexname IN (
 'companies_slug_idx','companies_name_idx','companies_data_gin_idx','migrations_name_idx','migrations_status_idx',
 'news_slug_idx','news_article_id_idx','news_published_idx','news_category_idx','news_source_idx','news_importance_idx',
 'news_data_gin_idx','news_tool_mentions_gin_idx','news_title_search_idx',
 'rankings_period_idx','rankings_current_idx','rankings_published_idx','rankings_data_gin_idx',
 'tools_slug_idx','tools_category_idx','tools_status_idx','tools_name_idx','tools_data_gin_idx');
-- Note: 0020/0021 drop/replace rankings_period_idx on purpose, so a missing one is expected, not a defect:
SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='rankings';

-- C. 0001: type, tables, FKs, indexes (expect 1 type, 3 tables, 2 FKs, 15 indexes)
SELECT t.typname, array_agg(e.enumlabel ORDER BY e.enumsortorder) AS labels
  FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid
 WHERE t.typname='article_status' GROUP BY t.typname;
SELECT table_name FROM information_schema.tables
 WHERE table_schema='public' AND table_name IN ('articles','article_processing_logs','article_rankings_changes');
SELECT conname FROM pg_constraint WHERE conname IN
 ('article_processing_logs_article_id_articles_id_fk','article_rankings_changes_article_id_articles_id_fk','articles_slug_unique');
SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename IN
 ('articles','article_processing_logs','article_rankings_changes') AND indexname LIKE 'idx\_%';
-- Column drift against 0000/0001 (later migrations alter some, e.g. 0015 timestamptz, 0016 tools.kind):
SELECT table_name, column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
 WHERE table_schema='public' AND table_name IN ('companies','migrations','news','rankings','tools',
   'articles','article_processing_logs','article_rankings_changes')
 ORDER BY table_name, ordinal_position;

-- D. 0012
SELECT column_name, data_type, column_default FROM information_schema.columns
 WHERE table_schema='public' AND table_name='automated_ingestion_runs' AND column_name='articles_skipped_semantic';

-- E. 0027: expect 9 rows if applied (any status); 0 if pending
SELECT slug, name, kind, status, data->>'createdBy' AS created_by, created_at
  FROM public.tools
 WHERE slug IN ('chatgpt','gemini-app','genspark','grok-app','hermes-agent','manus','microsoft-copilot','mistral-vibe','notion-ai');
-- Precondition 0016:
SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tools' AND column_name='kind';

-- F. 0028: applied iff all six are productivity and claude-artifacts is "Claude.AI"
SELECT slug, name, kind, category, subcategory, status, updated_at,
       data #>> '{info,website}' AS website,
       data #>> '{info,business,pricing_model}' AS pricing_model,
       data #>> '{info,business,free_tier}' AS free_tier,
       data #>> '{info,business,license_type}' AS license_biz,
       data #>> '{info,license_type}' AS license_info
  FROM public.tools
 WHERE slug IN ('claude-artifacts','openclaw','perplexity','chatgpt-canvas','claude-desktop-extensions','cowork',
                'clawdbot','moltbot','cowork-ai')
 ORDER BY slug;
-- 0028 guard visibility (non-empty means 0028 would raise today):
SELECT t.slug FROM public.tool_links l JOIN public.tools t ON t.id=l.harness_tool_id
 WHERE t.slug IN ('claude-artifacts','openclaw','clawdbot','moltbot','chatgpt-canvas','claude-desktop-extensions','cowork','cowork-ai')
   AND t.kind='harness';
```

Reading it: E empty and F showing `kind='harness'`/`other` and name `Claude AI`-old means 0027/0028 are pending (expected). B-D all present means 0000/0001/0012 objects exist and only the record is missing.

## 5. Options

| Option | What | Risk |
|---|---|---|
| **1. Mark as applied (INSERT rows) for 0000, 0001, 0012 only, after the checklist confirms objects** | One manual `INSERT INTO _drizzle_migrations (hash, created_at) VALUES ('0000_oval_manta.sql', ...)` per file. The repo has no path for this: `--force` only keeps an existing row, and the workflow cannot insert without executing the file | Low if the checks confirm. A write to prod tracking only, no schema effect. Needs a one-off privileged path (SQL console or a short script). If an object was missing, the file is hidden from the pending list and the drift stays unseen |
| 2. Re-apply via the workflow | `--only 0012 ...` works (idempotent) and records a row. `--only 0000`/`0001` fails at the first statement on a DB with the objects and records nothing | 0012: very low. 0000/0001: guaranteed failure, and if a partial set of objects existed it would fail midway with no rollback. Not usable for those two |
| 3. Mark 0027 and 0028 as applied | INSERT rows | **Wrong; do not use.** The prod check of 2026-11-04 (below) shows both are unapplied: none of 0027's nine slugs exist and every 0028 row is in its pre-0028 state. A row would hide pending, owner-gated data changes (9 inserts; 6 live-row conversions that alter public boards) |
| 4. Apply 0027/0028 now through the workflow | Dry run, then `--only` | 0027 is low (additive, inactive rows). 0028 is user-visible: removes six tools from the harness board at next publish, so it needs the owner's activation call (its header says after 2026-11-01; today is 2026-11-03) |
| 5. Leave as-is | Do nothing | Lowest immediate risk. Cost: `--dry-run` forever lists 0000, 0001, 0012 as "pending", and any future no-arg "apply all pending" run would try 0000 first and fail. Nothing in the workflow does that today (it always passes `--only`) |

### Recommendation

1. Run the section 4 checklist (read-only) through the existing dry-run channel or a SQL console.
2. 0000, 0001, 0012: if B/C/D confirm the objects, apply Option 1 (three tracking-row inserts). 0012 can alternatively go through the workflow (Option 2), which is idempotent and records the row without hand SQL. Prefer that for 0012 because it needs no manual write.
3. 0027, 0028: do not insert rows. Per E/F, if absent, treat them as pending and apply with Option 4 on the owner's activation decision: 0027 first, 0028 when the productivity board goes live. The 2026-11-04 prod check settles E/F: both are unapplied, so Option 3 is out.
4. Optional follow-up (not part of D9f): add a `--mark-applied <file>` flag to `scripts/apply-migrations.ts` so baselines are recorded without hand SQL.

## Evidence index

- `scripts/apply-migrations.ts:52, 236-248, 262-299, 364+, 603-620, 652`
- `.github/workflows/apply-migration.yml:100-150`
- `app/api/admin/run-migrations/route.ts:80-200` (legacy 0000/0001 applier, no tracking write)
- `lib/db/migrations/meta/_journal.json` (4 stale entries)
- `docs/deployment/apply-migrations-workflow.md:31-53`
- Commits: 2024ca03 (0000, 0001), 02e39471 (0012), 4715f650 (0027, 0028), 8cabd44a / e3688b21 / 5ef77dc9 (runner)

## Prod check result (2026-11-04)

One read-only check against production. Nothing was written.

- **0027**: none of its nine slugs exist. Unapplied. Its only guard (a target slug held by another kind) finds nothing, so it applies as written.
- **0028**: every target (`chatgpt-canvas`, `claude-artifacts`, `claude-desktop-extensions`, `cowork`, `openclaw`, `perplexity`) and alias (`clawdbot`, `moltbot`, `cowork-ai`) is in its pre-0028 state. Unapplied.
- **`openclaw`**: kind `harness`, category `autonomous-agent`, subcategory `autonomous_agent`, status `active`, `data.info.website` NULL, no `license_type` at `data.info.business` or `data.info`, no `data.info_provenance`, `pricing_model` `subscription`, `free_tier` false.
- Most rows have `data.info.website` NULL. 0028 guards the website and licence of `openclaw` only, so other rows' NULL websites do not affect it.
- The `tool_links` guard (query F, second statement) was not run against prod.

As committed in #315, 0028 would raise on `openclaw`: its guard accepted only `https://openclaw.dev` or `https://openclaw.ai` as the website and required a `license_type` on at least one path. Branch `fix/0028-openclaw-guard` changes 0028 (unapplied everywhere, ordered by filename, so editing the file is safe): an empty website or licence is accepted and filled with the values 0028 already cites (`https://openclaw.ai`, MIT from `https://github.com/openclaw/openclaw/blob/main/LICENSE`); any other value still raises. Test: `tests/unit/productivity-rows-pglite-314.test.ts`.

Before applying 0028, run the `tool_links` query in section 4 F; a non-empty result still makes 0028 raise.
