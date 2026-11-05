# #317 audit: parent-company funding and valuation on non-harness tools

Date: 2026-11-05. Read-only. Prod DB (Neon `neondb`), every query inside `BEGIN READ ONLY ... ROLLBACK` with `default_transaction_read_only=on`. Code read from `origin/main` at 2b84dd8e.

## Conclusion

No non-harness tool (kind `model`, `productivity`, `other`) stores `funding`, `valuation` or `employees` in prod. The scoring engine has nothing to boost from those three fields for these kinds. **Zero rows need a data correction for the audited fields.**

Two adjacent parent-level inputs exist and are listed below as owner decisions, not as rows to fix.

## Precondition (0024 through)

- PR #316 is MERGED (2026-11-03T23:28:15Z), merge commit 8162aa0e.
- Prod `public._drizzle_migrations` (16 rows) contains `14 | 0024_correct_harness_inputs.sql | created_at 1793748689664` (about 2026-11-03 22:51Z). Later rows: 0027 (id 15) and 0028 (id 16).
- #317 carries the label `blocked` (stale; its only stated blocker is 0024).

## Scope and method

Rule (De4 (d), per #317): only product-level figures count; parent-company funding and valuation count for no tool.

Engine inputs read by `calculateCompanyBacking` (`lib/ranking-algorithm-v76.ts:438`): `info.metrics.funding`, `.valuation`, `.employees`, with `data.metrics.<key>` winning over `data.info.metrics.<key>` (`lib/db/harness-inputs-sql.ts:59`). It also gives +20 when the company string contains Google, Microsoft, Meta, Amazon, GitHub, Anthropic or OpenAI.

Queries:
1. Kind and status counts of `tools`.
2. Recursive key scan (depth 4) of `tools.data` for every non-harness tool, matching `fund|valuat|employee|raised|invest|arr|revenue|headcount|team_size|backer|parent|company`.
3. Containers `data.metrics` and `data.info.metrics`: which keys exist on non-harness tools.
4. `tool_metrics_history` (read by the #95 point-in-time regeneration) for fund/valuation/employees/monthly_arr.
5. `companies.data` keys; harness rows after 0024 as a sanity check.

## Counts

| kind | tools | with `data.metrics` | with `data.info.metrics` | with funding / valuation / employees |
|---|---|---|---|---|
| harness | 78 | 61 | 22 | 15 (out of scope; see note) |
| model | 77 | 0 | 0 | **0** |
| productivity | 18 | 5 | 0 | **0** |
| other | 29 | 0 | 0 | **0** |

Keys that exist under `data.metrics` on non-harness tools: `news_mentions` (5), `swe_bench` (2), `vscode` (2), `npm` (1). No `funding`, `valuation`, `employees`, `monthly_arr`.

`tool_metrics_history`: 70 harness, 72 model, 26 other, 9 productivity rows. **0** rows in any kind carry funding, valuation, employees or monthly_arr. A regeneration from history cannot reintroduce those fields.

`companies` (411 rows): the only funding-adjacent key is `size`. The engine does not read the companies table for these fields.

## Rows that look wrong

None for funding, valuation or employees.

Leftover text only (no scoring effect), both `productivity`, both already cleaned by 0024 rows 22-26:
- `chatgpt-canvas`: `business_metrics_provenance.parent_note` says "Funding/valuation are OpenAI corporate-level." The figures are gone.
- `claude-artifacts`: same note, "SWE-bench/funding/valuation are Anthropic corporate-level". The figures are gone.

Proposal (not applied): none needed for scoring. A later wording pass could drop the stale clause from the two notes.

## Adjacent parent-level inputs (outside the issue's stated fields)

These are owner decisions. The audit does not recommend either.

1. **Major-company string credit.** `calculateCompanyBacking` adds +20 (before the 0.2 weight, so +4 on `marketTraction` and +4 on `businessSentiment`) when the company string names a major company. Non-harness tools that match, 37 rows:
   - model, 30: claude-fable, claude-fable-5-0, claude-haiku, claude-haiku-4, claude-opus-4, claude-opus-5-0, claude-sonnet-4, claude-sonnet-5-0 (Anthropic); gemini-argon, gemini-flash, gemini-flash-3-5, gemini-flash-3-7, gemini-pro, gemini-pro-3-1, gemma-31b (Google); gpt-astra, gpt-base, gpt-luna, gpt-luna-5, gpt-mini, gpt-oss-120b, gpt-sol, gpt-sol-5, gpt-sol-6-0, gpt-terra, gpt-terra-5 (OpenAI); llama-maverick, muse-spark, muse-spark-1-2, muse-spark-open (Meta).
   - productivity, 7: chatgpt-canvas (OpenAI), claude-artifacts (Anthropic), claude-desktop-extensions (Anthropic), openclaw ("OpenClaw (OpenAI)"); inactive: chatgpt, gemini-app, microsoft-copilot.
   - Whether this is "parent-company backing" under De4 (d) is a ruling for the owner. The model profile weights `marketTraction` 0.10 and `businessSentiment` 0.12; productivity weights both 0.12. Active tools only are ranked, so the live effect is on the active rows above.
2. **Inherited SWE-bench.** `chatgpt-canvas` (74.9) and `claude-artifacts` (80.9) hold `metrics.swe_bench.verified` of the underlying model, as their own notes state. This is not funding, so it is outside #317.

## Note on harness rows (out of scope, for context)

After 0024, 15 harness tools still hold funding, valuation or employees: augment-code, cline, coderabbit, continue-dev, cursor, devin, diffblue-cover, lovable, openhands, qodo-gen, replit-agent, sourcegraph-cody, tabnine, windsurf, zed. 0024 left these in place; they look like company-owns-the-product figures. #317 covers non-harness only, so this audit does not assess them.

## What #317 says happens next

- This audit is read-only. The data correction "comes after, under its own dry-run and clearance" (Architect clearance, per the #317 text and the #316 precedent: restore branch, passing dry run, owner clearance).
- With zero rows found, no correction migration is proposed. Next step: Architect or owner closes #317 with this result, or rules on adjacent item 1 above. A ruling to remove the company-string credit for models is a code change in the ranking engine (not a data migration), and needs its own issue and owner approval.

## Method safeguards

The URL went to `psql` only as `PG*` environment variables, set inside a `tm secrets exec` grant. No credential appears in this file. No write, no DDL, no build or test run.
