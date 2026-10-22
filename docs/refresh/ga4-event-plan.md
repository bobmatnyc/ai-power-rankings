# GA4 event plan (#175, M1-2)

Status: implemented in code. DebugView verification is pending GA4 property access.

Bot-share gate and M7 thresholds: [bot-share-gate.md](bot-share-gate.md) (#176).

Property: `G-5YBL6NPWL6`. All events go through `trackEvent` in
`lib/analytics/track.ts`. The helper does nothing when `window.gtag` is absent
(server render, tests, blocked tags). It never throws. It sends only string,
number and boolean values, and cuts strings to 100 characters (the GA4 limit).

## Loader finding

Two loaders exist in the code. Only one of them sends data.

| Loader | File | Live? |
|---|---|---|
| Inline gtag, ID hard-coded | `app/layout.tsx:81-96` | Yes. Loads `gtag/js?id=G-5YBL6NPWL6` and calls `gtag('config', ...)` on every page. |
| `GoogleAnalytics` (Partytown) | `components/analytics/GoogleAnalytics.tsx`, mounted in `app/[lang]/layout.tsx:85` | Mounted, but inert. |
| `GoogleAnalyticsOptimized` | `components/analytics/GoogleAnalytics-optimized.tsx`, used only by `app/[lang]/layout-optimized.tsx` | Dead. Next.js never routes a file named `layout-optimized.tsx`. |

Evidence, taken from production on 2026-10-22:

- The production `[lang]/layout` client chunk inlines `NEXT_PUBLIC_GA_ID` as
  `"G-5YBL6NPWL6"`. The Partytown component is therefore mounted with the same ID.
- A headless Chrome visit to `https://aipowerranking.com/en`, with a click, a
  scroll and an 8-second wait, gave this result:
  - One `gtag/js` script element.
  - One `gtm-config` element of `type="text/partytown"`. No `gtm-script`
    element was present, and the Partytown runtime did not run.
  - `partytown.js` was preloaded but never executed. Chrome warned
    "preloaded using link preload but not used".
  - No requests went to `/api/proxy`.
  - `dataLayer` held one `js` entry and one `config` entry.
  - Each page path sent one `page_view` (`/en`, then `/en/rankings` after the click navigated).

There is no proven double load or double count, so this change leaves both
loaders as they are. The Partytown component, its `page_load_time` event and
`layout-optimized.tsx` are dead weight. Removing them is a separate cleanup.

`trackEvent` calls the global `gtag` that `app/layout.tsx` defines.

## Events

Each name is distinct from the GA4 automatic and enhanced-measurement events,
so a report never adds two sources together by accident.

### `ranking_row_click`

Fires when a user clicks a tool card on `/{lang}/rankings`.

| Param | Type | Example |
|---|---|---|
| `tool_slug` | string | `cursor` (falls back to the tool id) |
| `rank` | number | `2` |
| `list_name` | string | `rankings` (`RankingCard` `listName` prop) |
| `tool_category` | string | `code-editor` |

Fires at `components/ranking/ranking-card.tsx:80`. The category badge inside the
card stops propagation and sends `filter_use` instead.

Not instrumented: the home-page "Trending" and "Recently Updated" cards in
`app/[lang]/client-rankings-optimized.tsx`. That file is 753 lines, over the
500-line cap, so the change stays out of it. Pass `listName` when those cards move to `RankingCard`.

### `filter_use`

| Param | Type | Values |
|---|---|---|
| `filter_name` | `"category" \| "tag" \| "sort"` | |
| `filter_value` | string | A fixed category, tag or sort id, never free text |
| `page_type` | string | See "page_type values" below |

Fires at:

- `components/layout/app-sidebar.tsx:87`: the shared sender. It is called from
  the sidebar category links (`:277`) and the tag buttons (`:347`).
- `components/ranking/rankings-grid.tsx:392`: rankings sort select.
- `app/[lang]/tools/tools-content.tsx:77`: tools category select.
- `app/[lang]/tools/tools-content.tsx:157`: tools sort select.
- `components/ranking/ranking-card.tsx:147`: category badge on a ranking card.

### `tool_outbound_click`

| Param | Type | Example |
|---|---|---|
| `tool_slug` | string | `cursor` |
| `link_domain` | string | `cursor.com` (host only, `www.` stripped) |
| `link_type` | `"website" \| "github"` | |

The event never carries the full URL, path or query string. Fires at
`app/[lang]/tools/[slug]/tool-detail-client.tsx:184`. It is attached to the
desktop buttons (`:268`, `:275`) and the mobile buttons (`:330`, `:337`).

### `scroll_depth`

| Param | Type | Value |
|---|---|---|
| `percent_scrolled` | number | `75` |
| `page_type` | string | See "page_type values" below |

Fires once per page view, after the window scroll passes 75% of the document
height. Fires at `components/analytics/scroll-depth-tracker.tsx:35`. The
tracker is mounted on every `[lang]` page at
`components/layout/client-layout.tsx:72`. A pathname change counts as a new page
view and re-arms the tracker. A page too short to scroll never fires the event,
which matches the GA4 `scroll` event.

### `site_search`

| Param | Type | Example |
|---|---|---|
| `query_length` | number | `6` |
| `query_length_bucket` | `"1-3" \| "4-10" \| "11-30" \| "31+"` | `4-10` |
| `result_count` | number | `1` |
| `search_location` | `"rankings"` | |

The site has no search box. Its only search entry point is the schema.org
`SearchAction` at `app/[lang]/page.tsx:272-277`, which points to
`/{lang}/rankings?search={term}`. Before this change that URL showed the full,
unfiltered list.

- `components/ranking/use-rankings-search.ts` now filters the list by tool
  name, slug or category.
- `components/ranking/rankings-grid.tsx` shows the term as a clearable badge.
- The hook sends `site_search` once per distinct term, after the rankings load
  (`use-rankings-search.ts:41`, called at `rankings-grid.tsx:260`).
- The raw term is never sent.

PII caveat: the raw term still reaches GA4 in two ways. One is the `page_view`
`page_location`. The other is enhanced measurement "Site search", which
reads the `search` query parameter by default and sends `view_search_results`
with `search_term`. To keep search text out of GA4, the owner must turn off
Site search in enhanced measurement, or remove `search` from its query
parameters. This plan does not change the setting.

### page_type values

`pageTypeFromPath` in `lib/analytics/track.ts` sets `page_type` from the route
shape only, never from a slug. The values are:

- `home`
- `rankings`
- `tools`
- `tool_detail`
- `news`
- `news_article`
- `best_of`
- `trending`
- `whats_new`
- `methodology`
- `about`
- `other`

## Enhanced-measurement overlap

This section assumes the GA4 defaults: enhanced measurement is on, with every
toggle enabled. Confirm this in Admin > Data streams > Web.

| Enhanced event | Overlaps | How this plan avoids double counting |
|---|---|---|
| `click` with `outbound=true` | `tool_outbound_click` | One tool-link click sends both events. Use `tool_outbound_click` for per-tool attribution and `click` for all outbound traffic. Never add the two counts together. |
| `scroll` (90%, once per page) | `scroll_depth` (75%) | They measure different depths. A page view that reaches 90% sends both. |
| `view_search_results` | `site_search` | Both fire on a `?search=` landing. `site_search` adds the result count and leaves out the text. See the PII caveat above. |
| `page_view` on history change | none | No custom event duplicates it. |

## Verifying in DebugView

These steps are for whoever gets access to the GA4 property.

1. In GA4, open Admin > Data streams > Web, and record the state of each
   enhanced-measurement toggle in this document.
2. Open https://tagassistant.google.com and connect it to
   `https://aipowerranking.com/en`. Tag Assistant turns on debug mode for that tab.
3. In GA4, open Admin > DebugView, and select the debug device.
4. Trigger each event, then check its parameters in the event's detail panel:
   1. `ranking_row_click`: on `/en/rankings`, click a tool card. Expect the
      card's `tool_slug`, `rank`, `list_name=rankings` and `tool_category`.
   2. `filter_use`:
      1. Click a category in the sidebar. Expect `filter_name=category`.
      2. Click a feature tag in the sidebar. Expect `filter_name=tag`.
      3. Change the sort on `/en/rankings` and on `/en/tools`. Expect
         `filter_name=sort`.
   3. `tool_outbound_click`: open `/en/tools/cursor`, then click Visit Website.
      Expect `link_domain` to hold the host only. Expect a `click` event with
      `outbound=true` as well.
   4. `scroll_depth`: scroll any long page past three quarters. Expect one
      event with `percent_scrolled=75`. Scroll further: no second event, and a
      `scroll` event appears at 90%.
   5. `site_search`: open `/en/rankings?search=cursor`. Expect `query_length=6`,
      `query_length_bucket=4-10` and a `result_count` equal to the cards shown.
5. Custom parameters appear in standard reports only after they are
   registered. In Admin > Custom definitions, add event-scoped dimensions:
   - `tool_slug`
   - `list_name`
   - `tool_category`
   - `filter_name`
   - `filter_value`
   - `link_type`
   - `page_type`
   - `query_length_bucket`
   - `search_location`

   Add metrics for `rank`, `query_length` and `result_count`. `link_domain`
   and `percent_scrolled` are built-in dimensions.
6. Optionally, mark `tool_outbound_click` as a key event.

## Tests

- `tests/unit/analytics-track.test.ts`: the helper is a no-op without
  `window` or `gtag`, does not throw when `gtag` throws, filters and truncates
  parameters, and has correct parameter helpers.
- `tests/unit/analytics-events.test.tsx` (jsdom): each event fires from its
  real component with the documented name and parameters.
