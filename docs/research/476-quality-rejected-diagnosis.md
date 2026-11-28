# #476 quality_rejected diagnosis (2026-11-28, main 54806fd1)

## Conclusion
The rejects are correct: 21 of 22 are off-topic general news (relevance 0-5). Discovery still returns general news after #494. One on-topic item (forbes, 6.7 / 7.0) fails only on the average. Proposed fix: lower `minimumAverageScore` from 7.0 to 6.5. It admits forbes and nothing else from the three runs.

## 1. The rule
- Thresholds: `INGEST_THRESHOLDS` = average >= 7.0 and relevance >= 7. `lib/services/article-quality.service.ts:60-63`.
- Gate: `shouldIngest = avg >= 7.0 && relevance >= 7`. `article-quality.service.ts:326-331`. Average = (quality + relevance + credibility) / 3, so credibility and writing depth count equally with relevance (`:326`).
- Scores come from an LLM. System prompt `article-quality.service.ts:74-108`, `temperature: 0.3` at `:140`, model via `getOpenRouterModel()` (`:118-120`, `lib/services/openrouter-model`). The prompt is aggressive: reject listicles, market overviews and "AI mentioned in passing" at relevance <= 4. Accept at >= 7 only when the article is primarily about AI coding tools.
- Outcome `quality_rejected` is recorded at `lib/services/automated-ingestion.service.ts:1619-1627` (avg and relevance are recomputed there).
- `low_relevance_and_avg` and `low_avg` exist only in the gap detector, not in ingestion. `scripts/check-ingestion-gap.mjs:380-399`. Its thresholds are a hand-copied mirror at `:335-336`. A change to the service constants must be copied there.

## 2. Score distribution (from the detector logs)
Ingested scores are not logged. The detector prints averageScore and relevanceScore only for rejects.

| Run | quality_rejected | relevance >= 7 | relevance 5-6 | relevance <= 4 | Ingested |
|---|---|---|---|---|---|
| 11-28 (46129083298) | 22 | 1 (forbes 6.7/7.0) | 1 (newsweek 5.3/5.0) | 20 | 0 |
| 11-27 (45971349687) | 19 | 1 (t.co 5.7/7.0) | 1 (securityweek 5.7/5.0) | 17 | 1 (businessinsider, OpenAI billing) |
| 11-25 (45582775334) | 16 (+9 quality_rejected_unexpanded) | not listed | not listed | not listed | 2 (vals.ai benchmark, marktechpost) |

- Near-threshold on 11-28: only forbes. Everything else has average <= 5.3 and relevance <= 5. Offenders include cbssports 1.7/0, foxnews 2.3/0, npr 4.3/3, usatoday 3.3/1.
- 11-27: t.co 5.7/7.0 is a link-shortener with unknown content. Nothing else is near.
- 11-25: the script only prints the first rejects under the 50-line budget; I did not tabulate it.

## 3. Upstream cause
- Discovery is the problem. #494 packs 4 tools per query, adds curated phrases for ambiguous names, and appends `AI coding news`. `lib/services/discovery-queries.ts:70-130` (phrases), `:213-232` (`buildToolAnchoredQueries`). It rotates by UTC day over groups, 2 queries per provider call (`lib/services/tavily-search.service.ts:178-182`, `lib/services/brave-search.service.ts:82`).
- The queries are OR-chains of quoted phrases. Providers match any one phrase plus loose terms like "news", so a group containing a still-ambiguous name returns sports, health and politics pages. 11-28 still has cbssports, foxnews, npr, fiercehealthcare and insidehighered.
- Not confirmed: which query produced which URL. The detector does not log the query, only `discoveredVia`. I did not read the Tavily or Brave response handling.
- The threshold is not too strict for off-topic items. It is marginally strict for forbes: relevance 7.0 meets the bar, so it was rejected on quality or credibility alone.

## 4. Proposed fix (one change)
Lower the average threshold, keep the relevance threshold at 7.
- `lib/services/article-quality.service.ts:61`: `minimumAverageScore: 7.0,` becomes `minimumAverageScore: 6.5,`.
- Same PR, mirror: `scripts/check-ingestion-gap.mjs:335`: `7.0` becomes `6.5`. Update the `low_avg` case in `tests/unit/check-ingestion-gap.test.ts:508` (6.9 / 8 is no longer low_avg; use 6.4).
- Effect on today's 30: forbes (6.7 / 7.0) passes. No other candidate passes, because the other 21 have relevance <= 5. Previously rejected, duplicate and blocked items are untouched. Expect about 1 ingest on 11-28. On 11-27, t.co (5.7) still fails; on 11-25 no change is visible.
- Risk: an article with relevance exactly 7 and weak quality or credibility (6.0 / 6.0 / 7.0 = 6.33 still fails; 6.0 / 7.0 / 6.5 = 6.5 passes) now ingests. Relevance >= 7 stays the topic guard, so off-topic news does not enter. Rollback is one constant.
- Not covered: this yields 0-1 extra per day and does not fix the discovery noise. A discovery change would be a second ticket.
- Guard test: add `tests/unit/article-quality-thresholds-476.test.ts`. It mocks `openRouter.generate` to return scores and asserts that (6.0, 7.0, 7.0 -> avg 6.67) ingests, (6.0, 7.0, 6.0 -> 6.33) rejects, and (8, 6, 8 -> avg 7.3, relevance 6) rejects. It also asserts `QUALITY_MIN_AVERAGE_SCORE === INGEST_THRESHOLDS.minimumAverageScore`, which stops the detector mirror from drifting.

## Discovery change since 11-21

Evidence (gap-detector runs, bobmatnyc/ai-power-rankings): 11-19 run 44493844271: 29 candidates, 3 ingested, 13 quality_rejected, 10 skipped_stale. 11-20 run 44708317010: 18 candidates, 1 ingested, 14 quality_rejected, 3 skipped_stale. 11-27 run 45971349687: 22 candidates, 1 ingested, 19 quality_rejected, 0 stale. 11-28 run 46129083298: 30 candidates, 0 ingested, 22 quality_rejected (cbssports, usatoday, fiercehealthcare, foxnews, npr; relevance 0-3).
The quality-reject share is similar before and after (78%, 86%, 73%). What fell is on-topic supply: skipped_stale vanished and ingests went 3, 1, 1, 0.
Candidate domains are not in the 11-19 and 11-20 logs (CANDIDATE_REJECTED domain= shipped 11-25, #492), so the before/after domain mix cannot be compared. Search queries are not logged at runtime; Vercel logs are not retained (`vercel logs` returned none).
Change: a3c9eff (#482, 11-22) replaced the fixed generic OR query and weekday topic queries with rotating tool-anchored quoted-OR queries, and cut the daily Tavily `days` window from 14 to 3 (DAILY_PROVIDER_WINDOW_DAYS, lib/services/discovery-queries.ts, used at app/api/cron/daily-news/route.ts:126). #494 (4256667, 11-26) swapped bare names for phrases ("Cursor" became "Cursor AI" OR "Cursor IDE" OR "Anysphere"). Providers: Tavily only; Brave runs only if Tavily throws (automated-ingestion.service.ts:1986-2060). No provider env var changed after 11-10 (TAVILY_API_KEY 284d, BRAVE_SEARCH_API_KEY 270d, JINA_API_KEY 81d).
Hypothesis (not proven): Tavily returns a fixed top-15 per query by relevance, so a 3-day window with few on-topic stories fills the page with general news.
Proposed single fix: DAILY_PROVIDER_WINDOW_DAYS 3 to 7 (the #479 rejected-URL skip already guards against re-scoring old stories). Guard: tests/unit/discovery-queries-476.test.ts asserting the daily window. Risk: more stale candidates (skipped_stale rises, no extra cost). Verify with the next 3 gap-detector runs.
