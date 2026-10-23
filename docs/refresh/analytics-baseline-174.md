# GA4 baseline (#174, M1-1)

Status: PARTIAL. The baseline has not landed under D88 (0 of 6 acceptance criteria met). Gaps are listed below.

Issue: [#174](https://github.com/bobmatnyc/ai-power-rankings/issues/174). Gate that consumes it: [bot-share-gate.md](bot-share-gate.md) ([#176](https://github.com/bobmatnyc/ai-power-rankings/issues/176)). First-party events: [ga4-event-plan.md](ga4-event-plan.md) ([#175](https://github.com/bobmatnyc/ai-power-rankings/issues/175)).

## Architect ruling, 2026-10-23 16:40Z

- `bot-share-gate.md` is NOT frozen. [#174](https://github.com/bobmatnyc/ai-power-rankings/issues/174) met 0 of 6 acceptance criteria, so under D88 the baseline has not landed. The freeze happens once [#175](https://github.com/bobmatnyc/ai-power-rankings/issues/175)'s first-party events give a usable baseline.
- List-to-detail uses the page-view proxy for now, labelled as a proxy: tools 1.06, all content 3.33. It is replaced by the [#175](https://github.com/bobmatnyc/ai-power-rankings/issues/175) `ranking_row_click` rate once that event has data.

**Data source:** GA4 Pages and screens export, 2026-09-23..10-20 (static, owner-provided; no GA API access by owner ruling). One dimension (page title and screen class), 742 rows, window = 28 days. The export has no page path, session, source, or entry/exit columns.

Page types below are derived from the page title. Paths are not in the export, so the grouping is a title-based approximation. Locale is inferred from the title language only; English fallback titles on non-English routes count as `en`.

## Acceptance criteria

| # | Criterion (from the issue body) | Status | Number or reason |
|---|---|---|---|
| 1a | Landing-page report, 90 days | GAP | No landing-page dimension in the export. |
| 1b | Path report, 90 days | GAP | Export is by page title, not path. Page-type grouping by title is given below as a substitute. |
| 1c | Traffic-source report, 90 days | GAP | No source column. |
| 1d | 90-day window | GAP | The export covers 28 days (2026-09-23..10-20). |
| 2 | Entry and exit table by page type | GAP | No entry or exit data. Views, users and engagement by page type are given instead (table 1). |
| 3 | Traffic split by source/medium | GAP | No source/medium column. |

Inputs requested in the [#177](https://github.com/bobmatnyc/ai-power-rankings/issues/177) comment:

| Item | Status | Number or reason |
|---|---|---|
| Fill `views_90d` in the content-ia audit CSV | GAP (window) | 28-day views per tool title exist for all 114 catalog tools. The column asks for 90 days. |
| Diff the 130 GA4 profile titles against the 114 catalog tools | MET | 130 tool-profile titles in English. All 114 catalog tools match a title. 16 titles are not in the catalog: cascade 3, composer 2.5 2, gpt-5.6 2, grok 4.5 2, grok 4.6 2, grok 4.7 35, grok build 3, hydrafusion 35, mico 2, microsoft copilot managed runtime 35, microsoft security copilot 2, neovim 1, office 365 38, opus 27, visual studio code 1, work iq 1 (views in the 28 days). |
| Landing pages and referrers for "Tool Not Found" | GAP | The title has 84 views / 84 users, 0 engagement time. No landing-page or referrer columns. |
| Under-10-views rule on the 22 provisional keeps | MET | 0 of 22 are under 10 views in 28 days. All 22 stay as keeps by this rule. (11 of the 130 titles overall are under 10 views.) |

## Baseline table 1: by page type (all 742 rows)

Engagement = average engagement time per active user, in seconds, weighted by active users: sum(avg x users) / sum(users). Views per user = views / active users. Zero-engagement view share = views on rows with an average engagement time of exactly 0, divided by the views of the type.

| Page type | Rows | Views | % of views | Views per user | Engagement (s/user) | Zero-engagement view share |
|---|---|---|---|---|---|---|
| News detail (residual) | 569 | 13,704 | 53.7% | 1.000 | 0.05 | 81.0% |
| Tool detail | 133 | 5,471 | 21.5% | 1.000 | 0.08 | 88.1% |
| Rankings (`/rankings`) | 1 | 2,532 | 9.9% | 1.005 | 0.28 | 0.0% |
| Best-* category pages | 9 | 1,287 | 5.0% | 1.000 | 0.06 | 64.6% |
| Home (all locales) | 12 | 944 | 3.7% | 1.012 | 0.75 | 2.8% |
| News list | 1 | 594 | 2.3% | 1.014 | 0.38 | 0.0% |
| Tools directory | 1 | 297 | 1.2% | 1.021 | 0.38 | 0.0% |
| Legal / contact (terms, privacy, contact) | 3 | 286 | 1.1% | 1.000 | 0.16 | 63.3% |
| Methodology | 1 | 114 | 0.4% | 1.000 | 0.16 | 0.0% |
| Trending / history | 10 | 96 | 0.4% | 1.000 | 0.43 | 30.2% |
| About | 1 | 94 | 0.4% | 0.989 | 0.24 | 0.0% |
| Tool Not Found | 1 | 84 | 0.3% | 1.000 | 0.00 | 100.0% |
| **Total** | **742** | **25,503** | 100% | 1.001 | 0.12 | 67.0% |

Locale split (title language): English 720 rows / 25,311 views (99.2%); non-English 22 rows / 192 views (0.8%). Non-English by type: home 160 views, trending 29, tool detail 3.

"News detail" is the residual: any title not matched to another type. Tool detail includes 3 views on Persian-language profile titles.

## Reconciliation

- Sum of the page-type views = 25,503 = sum of the Views column. Sum of type rows = 742 = data rows in the export.
- Views per active user column equals views / users on every row (max deviation 0).
- Active users summed over rows = 25,469. This is a sum of per-page users. A user who views two pages counts twice, so it is not the site's unique-user count.
- Event count 78,246 = 3.07 events per view. Key events = 0 and revenue = 0 on every row (no key events recorded in the window).
- Total engagement time = 3,056 s over 25,469 user-rows = 0.12 s per active user.

## Baseline table 2: gate metrics

| Gate metric | Computable from this export? | Baseline value / method |
|---|---|---|
| Human-looking session share (floor 60%) | Not as defined (needs sessions) | Proxy on views: 1 - zero-engagement view share = 1 - 67.0% = **33.0%**. With a stricter "under 1 s average" cut the share is 0.5% (99.5% of views sit on rows under 1 s). Both are below 60%. See "Bot-looking traffic". |
| Engagement | Yes | **0.12 s per active user** site-wide (weighted). Rankings 0.28, home 0.75. |
| Views per user | Partly | Per-page 1.001 (25,503 / 25,469). The site-level figure (views / unique users) needs the unique-user count, which the file lacks. Bounds: between 1.001 (if all users are distinct per page) and 10.1 (if the 2,519 users of the biggest page were all the users). Not usable as a baseline for M7 as it stands. |
| List-to-detail rate | Proxy only | See below. No click data in the export. |
| Search Console metrics (indexed pages, 404 count, clicks, impressions) | No | GAP. Not in a GA4 Pages export. |
| API spend per month | No | GAP. Comes from run records, not GA4. |

**List-to-detail definition used (neither [#174](https://github.com/bobmatnyc/ai-power-rankings/issues/174) nor the gate defines it):** detail views / list views in the same window, on page views, not clicks.
- List pages = rankings + tools directory + best-* + home + trending = 2,532 + 297 + 1,287 + 944 + 96 = 5,156 views.
- Tool detail = 5,471 views. **Tool list-to-detail = 5,471 / 5,156 = 1.06.**
- Including news: detail = tool detail + news detail = 19,175; list = the above + news list = 5,750. **All-content ratio = 3.33.** News alone: 13,704 / 594 = 23.1.
- This ratio is above 1 because most detail views do not come from a list page (search and direct landings). It is a views ratio, not a click-through rate. The `ranking_row_click` event from [#175](https://github.com/bobmatnyc/ai-power-rankings/issues/175) gives the real rate once it has data; this proxy is only a stopgap for the M7 comparison and the gate should say which one it compares.

## Bot-looking traffic (all heuristics are estimates)

Available signals, from per-page averages only:
1. **Zero average engagement time:** 17,075 of 25,503 views (67.0%). Rows at exactly 0: 672 of 742. By type: tool detail 88%, news detail 81%, best-* 65%; rankings, home, news list, tools directory, methodology, about: 0%.
2. **Under 1 s average:** 99.5% of views; under 5 s: 99.9%.
3. **Views per user = 1.00 on essentially every row** (5 rows above 1.05, all with 60 or fewer views). Consistent with one view per user per page.
4. **Events per view = 3.07.** Consistent with each view being a new user's single-page visit (page_view, session_start, first_visit plus a small remainder). This is an inference.
5. **Long tail:** 40 rows with 2 or fewer views (55 views in total); 569 distinct news-detail titles.
6. **Odd titles:** "[TRANSLATE] Historical AI Tool Rankings" (5 views, untranslated placeholder), "Tool Not Found" (84 views, 0 engagement).

Not available: session count, "engaged seconds = 0 and single page" segment, IAB known-bot exclusion state, user agent, source, hostname. The gate's two steps (known-bot exclusion count, bot-filtered segment) are therefore GAPs in this export. The proxy above is page-level, not session-level, and an average of 0 on a row does not prove every user had 0.

Reading against the gate: on every cut available the human-looking proxy is below 60%, so the gate's branch is the bot-filtered one (Search Console clicks, the bot-filtered segment, the first-party events from #175), not raw engagement. This needs confirming with the session-level segment the export cannot produce.

## Gaps (summary)

1. Landing page, path, entry/exit: not in the export.
2. Source/medium, traffic-source split: not in the export.
3. 90-day window: export is 28 days.
4. Session count, session-level human-looking share, known-bot exclusion state: not in the export.
5. Site-level unique users and views per user: not in the export.
6. Search Console indexed pages, 404 count, clicks, impressions: not in the export.
7. API spend per month: not in the export (run records).
8. Landing pages and referrers for "Tool Not Found": not in the export.
9. Locale from path: only title language is available.
