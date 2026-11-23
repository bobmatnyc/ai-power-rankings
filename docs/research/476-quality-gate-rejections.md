# #476 Quality gate: why 19 of 20 candidates are `quality_rejected`

Read-only research at origin/main (ceb953b3). The local checkout is stale (HEAD bf622769, lacks #479/#481/#482), so
line numbers below are from `git show origin/main:<file>`. Run: gh run 45144960897 (2026-11-23).
`ingest` = lib/services/automated-ingestion.service.ts, `aq` = lib/services/article-quality.service.ts.

## Conclusion

The gate is one LLM call per candidate, not a length or relevance-score rule in code. A candidate is rejected when the
model's average of three scores is < 7.0 or its relevanceScore is < 7. The code has no length check. The most likely
cause is a weak snippet: Tavily search `content` over 500 chars is never expanded, so most candidates reach a strict
prompt that scores thin, tangential content at <= 4. Confidence is moderate, because the CI log holds only counts and
the per-candidate scores are in the DB (Q3), which this research did not query.

## Q1. Where the gate is and what it scores

- Verdict: `aq:329-331` in `parseAssessmentResponse`:
  `shouldIngest = averageScore >= 7.0 && relevanceScore >= 7`. Thresholds: `INGEST_THRESHOLDS` at `aq:60-63`.
  `averageScore = (quality + relevance + credibility) / 3` (`aq:326`).
- Inputs (`aq:279-293`): title, source, URL, published date, and `content` cut to the first 4000 chars. No word or
  length minimum exists in this service. Model: `getOpenRouterModel()`, temperature 0.3, 2000 max tokens (`aq:133-148`).
- Prompt (`aq:76-110`): "strict content evaluator", "REJECT ... aggressive". Relevance <= 4 for listicles, abstract AI
  references, index pages, "Paywalled stubs: Teaser content ... (just a headline and 1-2 sentences)" (`aq:84`), and
  generic industry reports. Quality "0-3 for stubs/teasers" (`aq:97`); relevance "0-4 if AI coding tools are only
  mentioned tangentially" (`aq:98`).
- Labelling: `ingest:~1560-1600` in the Step 5 block. `batchAssess` results are filtered on `shouldIngest === true`. An
  entry with `error` becomes `assessment_failed`. Every other non-passing entry is recorded `quality_rejected`, with
  the model's `reasoning`, `averageScore` and `relevanceScore` (#179).
- Not the gate: the freshness gate, URL dedupe, `skipped_previously_rejected` (#479) and semantic dedupe run before
  assessment. The assessment fails closed (#172), so 19 `quality_rejected` entries are real model verdicts, not
  parse failures or credit errors (those would be `assessment_failed`).

## Q2. Most likely criterion, ranked

1. Relevance < 7 on thin or tangential content (confidence: medium-high). With 19 of 20 failing, the single binding
   criterion is almost certainly `relevanceScore >= 7`, because the prompt maps tangential or stub content to <= 4.
   Evidence: `aq:80-98`, `aq:331`. The run summary's `rejectReasons.below_relevance_threshold` and
   `rejectScoreBuckets` (lib/services/ingestion-run-summary.ts:119-157) would confirm it, but the
   workflow prints only outcome counts (scripts/check-ingestion-gap.mjs:258).
2. Snippet-only content (confidence: medium). Tavily's `content` is used as-is when `> 100` chars
   (`ingest:1387`). Only snippets `<= TEASER_MAX_CHARS` (500) are queued for expansion (`ingest:1401`, `:336`). A 501-1500
   char snippet is a search excerpt, not an article, and is scored as such. This is the same failure mode #479 fixed
   for <= 500 chars, left open above 500. Expansion is also capped: `maxPerRun: 10`, 10 s each, concurrency 3, stop at
   120 s (`ingest:~325-332`). The run shows `teaser_expanded=5`, so at most 10 candidates were teaser-length and only
   5 got full text. The other 5 or more were scored on the teaser or on a snippet over 500 chars.
3. Tool-anchored queries returning on-name but non-substantive pages (confidence: medium-low). #482
   (lib/services/discovery-queries.ts:`buildToolAnchoredQueries`) builds
   `"A" OR "B" OR "C" OR "D" AI coding news`, 4 tools per query, 2 queries per run. Pages that name a tool in passing
   (changelog stubs, listicles, product pages, forum posts) now match more often. The prompt rejects these. The
   `tools` table can also hold non-coding tools, so a group like four unrelated names yields a thin match.
4. 3-day provider window (#482) shrinks the pool (confidence: low). Fewer fresh items means the pool is dominated by the
   top-ranked pages for the day's four tools, which are often evergreen. This is a pool-quality effect, not a gate
   effect. Dedupe-before-assess then removes repeat URLs, so what remains is leftover low-signal pages.

Did #482 change the candidate shape the gate assumes? No. #482 changed only the query text, the daily provider window
(`DAILY_PROVIDER_WINDOW_DAYS = 3`), and the freshness gate (`Math.max(FRESHNESS_WINDOW_DAYS, options?.days ?? 0)`,
`ingest:~1125`). The candidate objects and the assessment input are unchanged. #479 changed the shape: it added
`skipped_previously_rejected` and teaser expansion (`expandTeaser` / `expandTeasers`, `ingest:~672-735`), and #481
persisted `teaserExpanded` / `previouslyRejected` as a `run_counts` entry. `previously_rejected=0` shows the 30-day
rejection memory has not yet caught anything: all 19 URLs are new this run, and they enter the memory only now.

Evidence that short content fails: only the prompt (`aq:84`, `aq:97`). No log or code path in the checked material
proves a length threshold; the log has counts only.

## Q3. Are per-candidate reasons persisted?

Yes. Table `automated_ingestion_runs`, column `candidate_outcomes` (jsonb, lib/db/schema.ts:384). Each `quality_rejected`
entry (#179) holds `url`, `title`, `reason` (the model's rationale, up to 2000 chars: `ingest:315`, `:1202`),
`averageScore`, `relevanceScore`, `discoveredVia`, `sourceDate`. The list is capped at 100 entries
(`CANDIDATE_OUTCOME_LIMIT`). The leading `run_counts` entry holds `teaserExpanded` and `previouslyRejected`.
The summary counts (`rejectReasons`, `rejectScoreBuckets`, `assessmentFailedReasons`) go to the run's summary log line (#172).
The CI alert (scripts/check-ingestion-gap.mjs:230-260) prints only per-outcome counts, so the reasons exist but the
alert never shows them.

## Smallest fix options (not implemented)

1. Show the reasons (smallest, no behaviour change). In check-ingestion-gap.mjs, print the top 5 `quality_rejected`
   entries as `title | relevanceScore | averageScore | reason[:120]`, and print `rejectReasons`. The next run then
   confirms or refutes hypothesis 1 before any threshold change.
2. Widen teaser expansion: raise `TEASER_MAX_CHARS` from 500 to about 1500 and `maxPerRun` from 10 to 20 (budget is the
   binding limit: 20 x 10 s / 3 workers fits the 120 s stop). Targets hypothesis 2.
3. Cheap pre-filter before the LLM: require the title or snippet to name one of the `loadTrackedToolNames()` entries.
   This saves cost but does not raise yield.
4. Only if the scores show many candidates at relevance 5-6 with average >= 7: lower `minimumRelevanceScore` to 6.
   Do not do this first: it changes what is published, and the prompt still scores tangential items at <= 4.

## Next step

Read the 19 rejected rows for run 2026-11-23T06:00Z from `candidate_outcomes` (read-only SQL by the operator) and
bucket them by `relevanceScore` and content length. That decides between options 1-2 and 4.
