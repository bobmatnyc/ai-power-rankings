# Productivity metrics, notes (#314, D80)

Data: `docs/refresh/productivity-metrics.json`. Checked 2026-11-10. Path A only: WebSearch, WebFetch, and the free public GitHub and pypistats APIs. No paid provider, no database.

## Threshold for migration 0033

A row is included only when all three hold:

1. At least one of users, monthly_arr, github.stars is verified.
2. At least one more engine-scored figure is verified (users, monthly_arr, valuation, funding, github.stars, pypi downloads). Parent figures count (D80.1).
3. At least one pricing fact is verified on a fetched page.

Valuation and funding alone describe a company, not the product's usage.

| Slug | In 0033 | Reason |
|---|---|---|
| chatgpt | yes | users (product) + revenue, valuation, funding (parent) |
| genspark | yes | ARR, valuation, funding |
| grok-app | yes | users + funding (+ valuation, low confidence) |
| hermes-agent | yes | GitHub stars, PyPI downloads, funding/valuation (low confidence) |
| manus | yes | ARR (vendor), valuation, funding |
| microsoft-copilot | yes | two Microsoft parent figures; no consumer-only figure exists |
| notion-ai | yes | users (stale), valuation, ARR estimate |
| gemini-app | no | only one figure (950M MAU, vendor). One short of the threshold; the owner can waive it |
| mistral-vibe | no | only company valuation and funding; no usage figure |

## Sources (host, type)

| Tool | Metric | Source host | Type |
|---|---|---|---|
| chatgpt | users, valuation, funding | thenextweb.com | third party (credits OpenAI) |
| chatgpt | annualised revenue | investinglive.com | third party |
| chatgpt | plans, features | chatgpt.com | vendor (no prices shown) |
| gemini-app | users | blog.google | vendor |
| gemini-app | plans, features | gemini.google | vendor |
| genspark | ARR, valuation, funding | techintelpro.com (+ boursorama.com, Reuters) | third party |
| genspark | plans | genspark.ai/helpcenter | vendor |
| grok-app | users | pulse2.com (+ socialmediatoday.com) | third party (credits SpaceX filing) |
| grok-app | funding | x.ai | vendor |
| grok-app | valuation | theweek.in | third party, xAI unconfirmed |
| grok-app | plans | eesel.ai | third party |
| hermes-agent | stars | api.github.com | vendor API |
| hermes-agent | PyPI | pypistats.org | third party API |
| hermes-agent | funding, valuation | dealroom.co | third party (credits WSJ) |
| hermes-agent | features, plans | hermes-agent.nousresearch.com | vendor |
| manus | ARR | manus.im | vendor |
| manus | valuation, funding | sacra.com | third party estimate |
| microsoft-copilot | users | equibles.com (Microsoft call transcript) | third party |
| microsoft-copilot | AI run rate | uctoday.com | third party |
| microsoft-copilot | plans, features | microsoft.com | vendor |
| mistral-vibe | valuation, funding | mistral.ai | vendor |
| notion-ai | users, valuation | notion.com | vendor |
| notion-ai | ARR | sacra.com | third party estimate |

## Not verified or not obtained

- Blocked to the fetcher (HTTP 403): openai.com, businesswire.com, genspark.ai home and pricing, x.ai/grok, techleap. OpenAI and Genspark figures therefore come from fetched press.
- ChatGPT base_price, Grok official pricing, Manus dollar prices: not read from a vendor page. Fields left null or marked low confidence.
- news_mentions for all nine: needs the site's news corpus (database).
- Gemini 1 billion MAU (August 2026), Mistral ARR and user estimates, Manus Meta deal status after June 2026, Grok S-1 text, Genspark total funding ($485M vs $545M vs $645M by source): seen only in search snippets or conflicting pages.
- Currency: Mistral figures are EUR. Everything else is USD.
- Month-granularity as_of values (Grok users, Manus valuation, Notion ARR) use the month end.
