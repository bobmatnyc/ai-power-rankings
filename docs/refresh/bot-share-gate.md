# Bot-share gate and M7 thresholds (#176, M1-3)

Status: DRAFT — freezes after #174
Frozen on: <date, set when #174 supplies the baseline>

Every number here is PROVISIONAL until the owner decides it (see "Decisions log").
Cells marked "baseline from #174" take their value from the M1-1 baseline.

## 1. Bot-share estimation

Raw GA4 engagement can include automated traffic. The share is estimated in
two steps, using the M1-1 baseline (#174) and the events from #175
(`docs/refresh/ga4-event-plan.md`).

1. Known-bot exclusion. GA4 already excludes traffic from the IAB known-bot
   list. Record the baseline period's session count with that exclusion on.
2. Bot-filtered segment. In GA4, build a segment of sessions with 0 engaged
   seconds and a single page. Treat it as the automated-looking share.

Human-looking share = 1 − (segment sessions ÷ all sessions), measured on the
same period and the same property as the M1 baseline.

## 2. The rule

If human-looking sessions are below 60% (PROVISIONAL), M7 does not judge by raw
engagement. It judges by:

- Search Console clicks,
- the bot-filtered segment,
- the new #175 events (`ranking_row_click`, `filter_use`,
  `tool_outbound_click`, `scroll_depth`, `site_search`).

At 60% or above, M7 judges by the thresholds in section 3 as written.

The rule is fixed before M4 starts. Freezing happens after #174.

## 3. M7 pass/fail thresholds

Metrics come from #201 (M7-1) and #202 (M7-2). "M1 baseline" is the value
recorded by #174.

| Metric | Pass | Fail |
|---|---|---|
| Engagement | ≥ +10% vs the M1 baseline (baseline from #174) | Drop of more than 10% vs the M1 baseline (baseline from #174) |
| Views per user | ≥ +10% vs the M1 baseline (baseline from #174) | Drop of more than 10% vs the M1 baseline (baseline from #174) |
| List-to-detail rate | ≥ +10% vs the M1 baseline (baseline from #174) | Drop of more than 10% vs the M1 baseline (baseline from #174) |
| Insights traffic | > 0 and rising week over week | 0, or not rising week over week |
| Search Console indexed pages | No decrease vs baseline (baseline from #174) | Any decrease vs baseline (baseline from #174) |
| Search Console 404 count | No increase vs baseline (baseline from #174) | Any increase vs baseline (baseline from #174) |
| Search Console clicks and impressions | Not below baseline −5% (baseline from #174) | Below baseline −5% (baseline from #174) |
| API spend per month | ≤ +10% vs run records (before/after per run) | More than +10% vs run records (before/after per run) |
| /rankings recommendation | Keep the table unless the sub-pages beat it on Search Console clicks | Sub-pages beat the table on Search Console clicks: recommend the three-list overview (a separate ticket, if the owner rules it) |

For engagement, views per user and list-to-detail rate, a change between −10%
and +10% is neither pass nor fail. M7 reports it as inconclusive. This follows
from the two stated bounds; it is not a separate number.

## 4. Reporting order

The M7 readout (#201) states the bot-share result first, then each row of
section 3. Under the rule in section 2, the readout says which basis it used.

## 5. Decisions log

All numbers below await the owner's decision.

| Number | Provisional value | Decision |
|---|---|---|
| Human-looking share floor | 60% | Awaiting owner's decision |
| Engagement, views per user, list-to-detail: pass | ≥ +10% vs M1 baseline | Awaiting owner's decision |
| Engagement, views per user, list-to-detail: fail | Drop of more than 10% | Awaiting owner's decision |
| Insights traffic | > 0 and rising week over week | Awaiting owner's decision |
| Search Console indexed pages | No decrease | Awaiting owner's decision |
| Search Console 404 count | No increase | Awaiting owner's decision |
| Search Console clicks and impressions | Not below baseline −5% | Awaiting owner's decision |
| API spend per month | ≤ +10% vs run records | Awaiting owner's decision |
| /rankings recommendation | Keep the table unless sub-pages beat it on clicks | Awaiting owner's decision |
