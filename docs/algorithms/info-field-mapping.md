# Ranking engine: `info.*` field mapping (#241)

Where each tool-data field that the v7.x ranking engine reads is stored, which function reads it, and what a malformed value does today. Line numbers refer to `lib/ranking-algorithm-v76.ts` on `main` at 4a9448b3, before the #241 guard. PR #243 (v7.10, not merged) is cited for the fields it folds.

## Path terms

`computeRankings()` (`lib/services/ranking-generation.service.ts:161`) passes the stored `tool.data` as the engine's `info`, and `tool.data.metrics` as the engine's `metrics`.

| Term | Stored at | Engine expression |
|---|---|---|
| top-level | `tool.data.metrics` | `metrics.metrics` |
| `info.*` | `tool.data.X` | `metrics.info.X` |
| nested `info.info.*` | `tool.data.info.X` (the double-nested tools) | `metrics.info.info.X` |

Most read sites use `metrics.info.X`, which is the `info.*` path. Two factors, `calculateDeveloperAdoption` (:794) and `calculateMarketTraction` (:889), read through `getData()` (:567). For a double-nested tool `getData()` returns `info.info`, so those two factors read the nested path. A field read in both places can resolve to two different values for one double-nested tool.

The test fixture in #243 (`tests/fixtures/ranking-compare-101.json`) shows double-nested tools carrying `description`, `technical`, `business`, `metrics` and an object-valued `company` at `info.info.*`. The full set of keys in live data is not in the repository.

## Field table

| Field | Path(s) | Reader (main `file:line`) | Expected type | Malformed value today | Folded by #243 | Candidate for folding |
|---|---|---|---|---|---|---|
| `company` | `info.*` (read); `info.info.*` (carried as an object, never read) | `calculateDataCompleteness` :282; `calculateCompanyBacking` :422, `.includes` at :433; called from `calculateMarketTraction` :968 and `calculatePlatformResilience` :1081 | string | Object, number or `true` threw a TypeError at :433 and aborted the run; #241 scores these as absent and logs one warning. An array does not throw: `.includes` matches whole elements and it counts as company info, unchanged by #241 | No | No: the nested value is an object; folding needs a ruling on its shape, and #241 forbids reading its properties |
| `company_name` | `info.*` | same as `company` (fallback when `company` is falsy, or, since #241, an object, number or `true`) | string | Same as `company`. #241 applies the same guard | No | No: no evidence it is carried at `info.info.*` |
| `description` | `info.*`; `info.info.*` (carried) | `calculateDataCompleteness` :275; `calculateDescriptionQuality` :315; `calculateAgenticCapability` :663; `calculateInnovation` :710 | string | No throw. An object reads as the text `[object Object]` in templates and length 0 at :275; an array counts elements at :275 | No | Yes: carried at `info.info.*` but read only at `info.*`, so nested-only text scores as missing |
| `summary` | `info.*` | :276, :316, :663, :710 | string | As `description` | No | Yes, if carried nested: same reason as `description` |
| `overview` | `info.*` | `calculateDescriptionQuality` :317; `calculateAgenticCapability` :663 | string | As `description` | No | Yes, if carried nested: same reason as `description` |
| `features` | `info.*` | `calculateDataCompleteness` :279; `calculateInnovation` :690; `calculateDevelopmentVelocity` :1033; `calculateTiebreakers` :1097 | string[] | No throw. A string counts characters; an object counts 0 | No | Yes, if carried nested: read only at `info.*` |
| `launch_year` | `info.*` | `calculateMaturityBonus` :459, called from `calculateInnovation` :726 | number | No throw. A numeric string coerces through subtraction; an object gives NaN and scores 0 | No | Yes, if carried nested: read only at `info.*` |
| `pricing_model` | `info.*` | `calculateDataCompleteness` :285; `calculatePricingTier` :359; `calculateMarketTraction` :913 through `getData()` | string | No throw: compared with `===` or tested for truthiness | No (the scalar; `business.pricing_model` folds) | Yes: :285 and :359 read `info.*`, :913 reads `info.info.*` for double-nested tools |
| `user_count` | `info.*` | `calculateDataCompleteness` :259; `calculateDeveloperAdoption` :829 through `getData()`; `calculateBusinessSentiment` :1013 | number or string | No throw: coerced by `hasPositiveNumeric` / `parseNumericOr` | No | Yes: :259 and :1013 read `info.*`, :829 reads `info.info.*` |
| `annual_recurring_revenue` | `info.*` | `calculateDataCompleteness` :264; `calculateMarketTraction` :906 through `getData()`; `calculateBusinessSentiment` :1011 | number or string | No throw: coerced at read | No | Yes: same two-path split as `user_count` |
| `github_stats.stars` | `info.*` | `calculateDataCompleteness` :243; `calculateDeveloperAdoption` :865 and `calculateMarketTraction` :956 through `getData()` | number | No throw: `hasPositiveNumeric` at :243; `>=` comparisons elsewhere | No | Yes: same two-path split |
| `vscode_installs` | `info.*` | `calculateDataCompleteness` :247 | number | No throw: `hasPositiveNumeric` | No | No: a legacy fallback behind `metrics.vscode.installs`, which v7.8 already resolves |
| `npm_downloads` | `info.*` | `calculateDataCompleteness` :251 | number | No throw: `hasPositiveNumeric` | No | No: same as `vscode_installs` |
| `swe_bench_score` | `info.*` | `calculateDataCompleteness` :271 | number or string | No throw: `hasPositiveNumeric` | No | No: a legacy fallback behind `metrics.swe_bench`, already canonical |
| `recent_updates_2025` | `info.*` | `calculateDevelopmentVelocity` :1043 | array | No throw: guarded by `Array.isArray` | No | No: dated one-off field; no evidence it is carried nested |
| `technical.*` | `info.*`; `info.info.*` | :270, :651, :656, :718, :738-739, :754, :764, :776, :1059 | object of typed leaves | `technical.ide_integration` as an object, number or `true` throws at :776 (`.includes`). #243 adds a guard there. Other leaves do not throw | Yes | Already folded by #243 |
| `business.*` | `info.*`; `info.info.*` | :285, :359-362, :913-915 through `getData()`, :1076 | object of typed leaves | No throw | Yes | Already folded by #243 |
| `metrics.*` | top-level; `info.*`; `info.info.*` | many; resolved once by `canonicalizeMetricPaths` (:502) in `normalizeInput` (:529) | object | Numeric leaves coerced by `parseNumeric*` | Not a fold: canonicalized since v7.8 | No: already canonical |

## Folding candidates for a possible v7.11 issue

Each needs a read-only count of live tools that carry the field only at `info.info.*` before anyone decides.

- `pricing_model`, `user_count`, `annual_recurring_revenue`, `github_stats.stars`: different factors read different paths for one double-nested tool.
- `description`, `summary`, `overview`: carried at `info.info.*`, read only at `info.*`.
- `features`, `launch_year`: read only at `info.*`; nested presence unknown.
- `company`: not a candidate until the owner rules on what an object-valued company means.
