# #476 Ingestion source selection: why daily-news yields 0-3 articles

Read-only research at origin/main (bf622769). Paths relative to repo root.
`ingest` = lib/services/automated-ingestion.service.ts, `tav` = lib/services/tavily-search.service.ts,
`brave` = lib/services/brave-search.service.ts.

## Conclusion

Discovery is two keyword queries sent to a general news search API. There is no tool-name anchoring per
tool, no include/exclude domain list, and no feed or primary-source ingestion. One of the seven rotating
supplementary queries is explicitly about funding, and the primary query is a broad OR-string. Staleness
comes from the provider's `days`/`published_date` disagreeing with the 14-day post-hoc gate, not from a
missing filter. The cheapest large gain is to anchor queries to the tracked tool names and to exclude
funding/VC domains and topics.

## 1. How candidates are discovered

Entry: cron `0 6 * * *` (vercel.json:4-5) -> app/api/cron/daily-news/route.ts:123 `runDailyDiscovery()` with
no arguments, so `options.days` is undefined and `maxArticles` defaults to 20 (ingest:1002).

Provider order (ingest:1870-1923, `discoverArticles`): Tavily first if `TAVILY_API_KEY` is set; Brave only as a
failover when Tavily THROWS (ingest:1936-1956). Brave never runs alongside a healthy Tavily. There is no
RSS/feed discovery (the RSS files in the repo are outbound feeds of the site's own content).

### Tavily (tav:138-256, call site ingest:1885-1914)
Per run, 3 search calls, all `topic: "news"`, `search_depth: "basic"`, no `include_domains`, no `exclude_domains`:

| Pass | Query | max_results | Date param | Source |
|---|---|---|---|---|
| Recency | primary query | 10 | `time_range: "day"` (and no `days`) | tav:194-207 |
| Primary | primary query | 15 | `days: 14` | tav:216-225, ingest:1907 |
| Supplementary | one rotated query | 10 | `days: 14` | tav:227-238 |

- Primary query, a single OR-string (tav:378-383): `AI coding assistant news OR AI code generation tools OR GitHub Copilot OR Cursor AI OR Claude Code OR Windsurf OR Devin AI OR Replit Agent OR Amazon Q Developer OR AI developer tools announcement OR agentic coding 2026`.
- Supplementary list (tav:392-400), one chosen by `new Date().getDay() % 7` (tav:408-409), server-local day, so each query runs once a week:
  0 `AI coding assistant funding startup investment 2026`; 1 `autonomous coding agent Devin Replit release update`;
  2 `"GitHub Copilot" OR "Cursor" announcement 2026`; 3 `AI code review tool launch enterprise`;
  4 `SWE-bench coding agent benchmark results`; 5 `AI pair programming tool VS Code JetBrains`;
  6 `Claude Anthropic developer tools API update`.
- Max raw candidates: 10 + 15 + 10 = 35, deduplicated by URL (tav:242). Matches the observed ~21-29 after overlap.
- Cost: 3 basic searches = 3 credits/run (comments at tav:402-407, ingest:1890-1896). Recorded via `recordCrawlUsage` (tav:338).

### Brave fallback (brave:75-149, call ingest:1921)
`searchAINews("pd")`, past-day freshness, `count=20`, `result_filter=web`, 2 calls/run (primary + one day-of-week query).
Primary query (brave:127) mixes `site:techcrunch.com OR site:theverge.com OR site:arstechnica.com OR site:venturebeat.com OR site:wired.com` with tool-name phrases, which makes it admit anything from those general tech sites. Tuesday's query is `AI code assistant funding startup investment` (brave:140). Brave swallows its own errors and returns `[]` (brave:112-118).

### Downstream caps
Freshness gate then URL dedupe, then `newArticles.slice(0, maxArticles*2)` = 40 (ingest:1327), LLM quality gate, final `slice(0, 20)` (ingest:1556). The candidate pool (<=35) never reaches the caps, so caps are not the bottleneck; the quality gate is.

## 2. Why off-topic and stale items get in

### Off-topic (funding/VC/policy/company pages)
1. Funding is searched on purpose. Tavily supplementary slot 0 (Sunday) is `AI coding assistant funding startup investment 2026` (tav:393); Brave's Tuesday query is the same intent (brave:140). The primary query has no negative terms.
2. The primary query is an OR of generic phrases (`AI coding assistant news`, `AI developer tools announcement`, `agentic coding`). Tavily is a semantic news search, so OR clauses behave as topical hints, not hard requirements; a "Demis Hassabis' AI company raises $5bn" article matches "AI ... news" with no tool name.
3. `topic: "news"` with no `include_domains`/`exclude_domains` (tav:299-301 only applies them if passed; ingest passes none) so VC and wire-service sites are eligible.
4. The only relevance filter is after the fact: the LLM gate requires relevance >= 7 and average >= 7.0 (article-quality.service.ts:60-62, prompt rejects "relevanceScore <= 4" at line 80). Off-topic items therefore cost one LLM assessment each before being rejected. No cheap pre-filter (title/snippet must contain a tracked tool name) exists between the freshness gate and the LLM.
5. Google-redirect teasers: Tavily `content` under 500 chars is scored on the snippet (ingest:331-336, 1341-1365); #476 teaser expansion now mitigates this.

### Stale items
- The provider date filter IS used: `days: 14` is sent on the primary and supplementary passes (ingest:1907, tav:303-306), and `time_range: "day"` on the recency pass. Tavily's `days` applies only to `topic: "news"`; it filters on the provider's own date metadata.
- The local gate is a second, independent check on the result's `published_date` (ingest:97 `FRESHNESS_WINDOW_DAYS = 14`, applied at ingest:1176). Mismatches occur because Tavily's `published_date` is frequently unreliable (the code says so at tav:18-29), and the gate fails open for missing/unparseable dates (ingest:137-147 comments). So the 25-45% stale rate is Tavily returning items its own date metadata called recent but whose reported `published_date` is older, plus topic-agnostic evergreen/company pages carrying old dates. The provider param cannot be tightened to fix this alone; narrowing `days` (e.g. 3-7) shrinks both the provider set and the gate-stale fraction.
- Hypothesis, not verified without prod logs: `days: 14` is far wider than the daily cadence. The 6am run only needs the last ~1-2 days (existing dedupe handles repeats), so a wide window mostly returns things earlier runs already saw, and these then fail URL/semantic dedupe or the 7-day title check (ingest:1262).

## 3. Ranked recommendations

Ranking is by expected on-topic fresh yield per unit of effort. Cost is Tavily basic = 1 credit per search (current: 3/run).

| # | Change | Expected effect | Cost/run | Risk | Size | Owner decision? |
|---|---|---|---|---|---|---|
| 1 | Tool-name-anchored queries built from the catalogue (data/json/tools/tools.json has only 5 rows at this ref, so use the live `tools` table or a curated list of ~20 names: Claude Code, Cursor, GitHub Copilot, Kiro, Windsurf, Devin, Replit Agent, Amazon Q Developer, Codex, Gemini CLI, Cline...). Batch 3-4 names per query with quoted phrases plus release terms (`update OR release OR changelog OR pricing`); rotate batches daily so each tool gets covered every 2-3 days. Replace the funding supplementary slot and drop the generic OR primary. | Largest. Removes the generic/VC match path at source; every result names a tracked tool. Expect off-topic share to drop sharply and on-topic share to rise. | 3-5 searches (+0-2 credits vs now) | Over-narrowing could miss new tools not yet in the catalogue; keep one generic discovery query. Query length limits for OR strings. | M | No |
| 2 | Add `exclude_domains` (Tavily) for funding/VC/aggregator news (e.g. crunchbase.com, pitchbook.com, news.crunchbase.com, finsmes.com, tracxn.com, techfundingnews.com, businesswire/prnewswire/globenewswire press-release hosts) and amazon.com company pages; remove the funding query slot (tav:393, brave:140). One-line API param on `executeSearch`. | Removes the named rejects (raises, funds, company pages) at zero extra cost. | 0 | Low. An exclude list needs upkeep; must not exclude venues that also carry real tool news. | S | List contents: yes, the owner should approve the domain list. |
| 3 | Cheap title/snippet pre-filter before extraction and LLM: require a tracked tool/vendor name (or "AI coding"/"code review" etc.) in title or snippet, and reject titles matching `raises|funding|Series [A-E]|valuation|fund`. Place after the freshness gate (ingest:1176-1188). | Saves LLM and extract spend on the ~60-75% quality rejections; no yield change on its own, but protects the 20-article budget and teaser expansion budget for on-topic items. | 0 API; fewer LLM calls | Regex false negatives (a real "Cursor raises Series D" item is arguably on-topic for the site; decide). | S | Policy: whether funding of a tracked tool counts as on-topic. |
| 4 | Tighten `days` from 14 to 2-3 for the daily cron only (keep 14 as the freshness gate and as the manual backfill value), and keep `time_range: "day"`. Send `days: 3` from `runDailyDiscovery` default, keep `options.days` override. | Cuts stale candidates and dedupe churn; makes every search slot hold new content. Reduces gate-stale from 25-45% toward ~10%. | 0 | Quiet days return <5 candidates, so it must pair with #1 (more targeted queries) and the window then lowers the absolute count of articles. Pipeline gate and window currently share one value (ingest:1126), so split them. | S | No |
| 5 | Primary-source include_domains pass: one extra Tavily search with `include_domains` set to vendor blogs and changelogs (cursor.com, docs.github.com/changelog, github.blog, anthropic.com, docs.anthropic.com, kiro.dev, windsurf.com, openai.com, aws.amazon.com/blogs, jetbrains.com/blog, replit.com/blog), `days: 7`. Add GitHub releases Atom (e.g. github.com/<org>/<repo>/releases.atom) for each tracked repo (`github_repo` is already a field in tools.json). | High precision, first-party news, avoids Google-redirect teasers and VC noise entirely. The strongest on-topic signal for a ranking site. | +1 credit/run (Tavily); GitHub Atom is free | Domain list upkeep; first-party posts may be marketing; GitHub release notes are short (thin-content gate) | M | Yes: source list approval. |
| 6 | Real RSS/Atom ingestion of vendor blogs, changelogs and GitHub release feeds (new `FeedDiscoveryService` feeding the same `SearchResult` shape and gates), independent of search. Query rotation across the tool list so no tool starves. | Deterministic, free, same-day fresh, no relevance guesswork. Removes search-API dependency for primary-source news. | 0 search credits; N HTTP GETs per run (parallel, cached) | New code path, feed breakage, dedupe vs search results, serverless timeout budget (265 s pipeline) | L | Yes: source list and whether to add a new provider type. Any paid news API (e.g. a second search provider or newsletters) is a separate owner decision. |

Suggested sequencing: #2 + #4 + #1 together (small/medium, no owner dependency except the domain list), then #3, then #5/#6 once the source list is approved. Brave remains a failover only; apply #1 and #2 to its query builders (`site:` clause at brave:127 and Tuesday query at brave:140) so a failover run is not worse than the primary.

## Evidence limits
- Prod run counts (11-19..11-22) were taken from the brief, not re-derived; no DB/log access.
- tools.json at origin/main holds 5 tools (checked), so the live `tools` table is the real catalogue.
- The exact reason Tavily returns stale items under `days: 14` is inferred from code comments (tav:18-29), not from API response samples.
