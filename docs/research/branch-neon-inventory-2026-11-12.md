# Branch and Neon inventory before any delete GO (2026-11-12)

Read-only. Nothing was deleted, pruned, pushed or re-authed, and no SQL was run.
Raw git evidence is in `/tmp/inv-branches/` (scan.tsv, prs.tsv, joined.txt, filesame.txt, scan.sh).

## 1. Neon branches (project shiny-math-31185162)

**Blocked.** The local `neonctl` is logged in to the Duetto-CTO org. It returns
`project not found` for shiny-math-31185162. No Neon API key is in the
environment or the Keychain.

| Field | restore-pre-v8-20261109T1252 | rehearse-v8-2026-11 |
|---|---|---|
| Created, parent, size, compute, protected | unknown (no access) | unknown (no access) |
| Issue that used it | none found; only Intent Ledger task T12 (opened 2026-11-09 18:49Z) | same |
| Issue closed | n/a | n/a |
| Data only there | unknown without SQL | unknown without SQL |

The restore branch's name timestamp (11-09 12:52Z) falls within the v8 launch
window (tasks T0f and T07, #281). It is probably the D98 pre-write safety copy
of production. No commit or doc confirms this.

**To finish:**
- A Neon credential that can see shiny-math-31185162.
- Clearance for one SELECT per branch: a row-count and max-timestamp comparison
  against production-new.

## 2. Local branches and worktrees

origin/main is 8d016543; local main is 11 commits behind it. There are 238 local
branches besides main, and 19 worktrees.

| Group | Count | State |
|---|---|---|
| A. Ancestor of origin/main (mostly `worktree-agent-*`) | 112 | Content on main, no PR. |
| B. Every commit cherry-equivalent to main | 56 | 55 PRs MERGED. `dedup-entity-pre-319` has no PR. |
| C. Squash-merged, tip equals the PR head | 33 | All PRs MERGED; the content is on main. |
| D. Merged PR, but the local tip differs from the PR head | 8 | Look like pre-rebase copies. Not verified line by line. |
| E. Commits not on main | 29 | Need a ruling; listed below. |

### Group D: local-only commits beyond the merged PR head

| Branch | Merged PR | Local-only commits |
|---|---|---|
| chore/drop-google-api-key | #365 | 1 |
| feat/186-per-list-rankings | #279 | 7 |
| feat/198-insights-monthly | #379 | slice commits (stacked copies) |
| feat/198-insights-rss | #380 | slice commits (stacked copies) |
| feat/198-insights-weekly-slice | #378 | slice commits (stacked copies) |
| feat/314-activate-productivity-rows | #385 | 2 |
| fix/seo-self-canonical | #158 | 5 |
| perf/368-edge-cache-public-pages | #369 | 6 |

Worktrees: tmp/wt-314-activate and tmp/wt-369.

### Group E: commits not on main

**Keep or decide separately:**

| Branch | PR | Commits not on main | Note |
|---|---|---|---|
| fix/443-locale-html-lang-dates (36f3c1b5) | none | 1 | PARKED, not a delete candidate. |
| chore/355-prod-db-environment | #360 OPEN | 2 | Waits on B77. |
| feat/184-open-weight-models | #298 CLOSED | 6 | 5 files absent from main. Possibly superseded by #335 and #407. Has a worktree. |
| docs/183-191-briefs | none | 3 | 9 files under docs/briefs/ absent from main. Has a worktree. |
| docs/186-237-briefs | none | 2 | 3 files absent from main. Has a worktree. |
| diag/ingestion-db-divergence | none | 2 | scripts/diagnose-ingestion-divergence.mjs absent from main. |
| diag/ingestion-freshness-followup | none | 1 | WIP; same script. |
| fix/seo-canonical-hreflang-wip | none | 6 | Top commit 1aa64201 is not in #158. Has a worktree. |
| docs/content-ia-audit-177 | none | 1 | 1 of 2 files differs from main. |

**Probably superseded (judged from PR subjects, not diffed):**

| Branch(es) | PR on main |
|---|---|
| fix/93-consolidate-admin-rankings-v76 (closed #116) | #254 |
| 180-pre-rebase-749449cd | #321 |
| 314-productivity-reclass | #315 and #385 |
| feat/models-per-major-release, feat/models-per-major-seed-opt3 | #335 and #337 |

**Rebase or restack copies of PRs already on main:**

| Branch(es) | PR on main |
|---|---|
| pr-322 | #322 |
| pr330 | #330 |
| pr318-rebase (adds a v8.1 label and version bump) | #318 |
| rebase/369-onto-main, sync/369-edge-cache-rebase | #369 |
| rebase/385-activate-productivity-rows | #385 |
| restack-281, restack-281-a1f, restack-281-pre-{2nd,521,8d6,a1f,d49} | #281 |
| restack-316-pre-a1f | #316 |
| worktree-agent-a0f122fdec7f8221e | #281 restack plus 1 extra test commit |
| worktree-agent-ac2f141f04dd1c14a | #316 and #313 |
| worktree-agent-ae146d746251cd28d | #318 |
| worktree-agent-aef2e95038cde103e | weekly-digest cron monitor tests; #373 is on main |

### Uncommitted work at risk

Worktree `.claude/worktrees/agent-adfb609e7a48770c3` (detached HEAD at 69dd432e,
which is on main) holds an untracked file that is not in git:
`docs/deployment/d0e-model-metrics-apply-runbook.md`.

No worktree is missing on disk or marked prunable. The other worktrees are clean.

### Remote refs

- 70 local branches have a same-named origin ref and no OPEN PR. 69 of them have
  a MERGED or CLOSED PR; the other one is the parked fix/443 branch.
- 21 more local branches have upstreams already gone from origin.
