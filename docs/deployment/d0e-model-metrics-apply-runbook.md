# D0e / Dfe model metrics apply runbook (#329)

Run only when Bob says go. Verified against main 69dd432e (2026-11-10). No secret value appears here.
Prior evidence: dry run 42730341624 = 16 metric rows, 16 update, 0 refused. Activation preview 42730523638 refused 35 rows, so the apply uses `activate=false`.
Production: Neon project `shiny-math-31185162`, branch `production-new`.

## Differences from the plan

1. There is no per-list `model` publish. The only publish path is `publish-rankings.yml`, which calls `/api/cron/regenerate-rankings`. That route runs `publishActiveRankings()` and writes all three boards (harness, model, productivity). Its only input is `confirm`. The harness board is therefore re-written. The "harness unchanged at 61 rows / 18 trending periods" check is a post-condition to verify, not a guarantee.
2. The publish confirm string is `publish-v8.1`. The metrics confirm string is `load-model-metrics`.
3. The loader has no revert. Rollback is a Neon restore from the D98 branch only.
4. The route has no dry run. Each publish replaces the current period's rows. It needs its own clearance on #101.

## 1. Preconditions

```
gh api repos/bobmatnyc/ai-power-rankings/commits/main --jq .sha
```
Expect `69dd432e...` or later (and #409 merged).

D98 branch, created by Codex in the Neon console: `pre-model-metrics-20261110`.
```
neonctl branches list --project-id shiny-math-31185162 | grep pre-model-metrics-20261110
```
Expect one line with that name, parent `production-new`. Record its UTC creation time. Do not continue without it. If `neonctl` is unavailable, confirm in the Neon console.

Secrets (names only):
```
gh secret list | grep -E '^(DATABASE_URL|MODEL_METRICS_JSON_B64|CRON_SECRET)\b'
```
Expect all three names. Also: `gh variable list` may show `PRODUCTION_BASE_URL`; if unset, it defaults to https://aipowerranking.com.

## 2. Apply (metrics only, no activation)

```
gh workflow run load-model-metrics.yml --ref main -f dry_run=false -f activate=false -f confirm=load-model-metrics
sleep 10; gh run list --workflow=load-model-metrics.yml --limit 1
```
The run must start from `main` or every step is skipped. Watch (use the run id printed):
```
gh run watch <run-id> --exit-status
gh run view <run-id> --log | grep -E '^(totals: |apply: committed)'
```
Expected (dry-run step, then write step):
```
totals: 16 metric row(s), 16 update, 0 unchanged, 0 refused; <activation text>
apply: committed, 16 metric row(s) written, 0 row(s) activated
```
Any refused row fails the job before the write. Stop and report.
A re-run is a no-op (16 unchanged).

## 3. Publish (needs separate clearance on #101)

```
gh workflow run publish-rankings.yml --ref main -f confirm=publish-v8.1
gh run list --workflow=publish-rankings.yml --limit 1
gh run watch <run-id> --exit-status
```
Expected summary: `HTTP status: 200`, `algorithm_version: 8.1`, `tool_count: <n>`, `cache_purge: ok`, `Result: published v8.1`.
Exit codes: 2 = CRON_SECRET mismatch, 3 = 409 in progress, 4 = published a different version (row replaced; do not re-dispatch). Never re-dispatch after a timeout; read `/api/rankings` first.

## 4. Live check

The CDN lags up to 15 minutes; the models page revalidates every 300 s.
```
curl -s 'https://aipowerranking.com/api/rankings?list=model' | jq '{n:(.rankings|length), first:.rankings[0].rank, last:.rankings[-1].rank, mrc:.list_meta.metric_row_count, indexable:.list_meta.indexable}'
```
Expect `n` 16, ranks 1..16, `mrc` 16.
```
curl -s 'https://aipowerranking.com/api/rankings/trending?list=model' | jq '[.periods[]?.rankings|length]'
```
Expect measured models only (no period larger than 16 entries; compare with the board).
```
curl -s 'https://aipowerranking.com/api/rankings?list=harness' | jq '.rankings|length'
curl -s 'https://aipowerranking.com/api/rankings/trending?list=harness' | jq '.periods|length'
```
Expect 61 and 18. A difference is a flagged finding: report before any further action.

## 5. Rollback

Metrics write: restore production from Neon branch `pre-model-metrics-20261110` (Neon console, Restore; target `production-new`). Rows written by the loader carry `data.metrics.terminal_bench` and `data.metrics_provenance.terminal_bench`; a DELETE of those keys is not the sanctioned rollback. The loader has no revert command.

Prior (empty) model board: after the restore, the stored current rows are the pre-apply ones, so no republish is needed unless the publish already ran. If it did, the restore also reverts the publish rows. Then purge the cache by dispatching `publish-rankings.yml` only if Bob clears a new publish; otherwise wait for the CDN lag and 300 s ISR. Re-check section 4 for `metric_row_count` 0.

Vercel rollback: not needed. No deploy changes in this sequence.
