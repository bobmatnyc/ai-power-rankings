# Content and IA audit (M1-4, #177)

Audit date: 2026-10-22. Read-only against production. No GA4 access yet (pending with the owner); every view-based column is blank and marked for #174.

Companion file: `docs/refresh/content-ia-audit.csv` (123 rows: 114 tools + 9 category pages). M3-1 and M5-1 consume it.

## 1. Method

| Step | Source |
| --- | --- |
| Tool list | `GET https://aipowerranking.com/api/tools` (handler `app/api/tools/route.ts`, `findByStatus("active")`) |
| Cross-check | `GET /api/rankings` (`app/api/rankings/route.ts`) and `/sitemap.xml` (`lib/sitemap.ts`, skips non-active) |
| Page state | One GET each of `/en/tools/<slug>` for all 114 tools and the 9 `/en/best-*` pages, 1 request per second, to read HTTP status, `<title>` and robots meta |
| News links | `GET /api/news?limit=100`, paged through all 631 articles, collecting `tool_slug` |
| Tag rules | Owner ruling Q3 = A (brief line 261): merge duplicates, non-AI entities `unlisted` + `noindex`, keep the data. Brief section 2(b) (lines 107-124) for the category pages |
| Inputs read | #109, `scripts/delete-invalid-tools.ts` |

No database was touched.

## 2. Count reconciliation: ~114 vs 130

- Real active tool count: **114**. Four production sources agree: `/api/tools` returns 114, all `status: "active"`; `/api/rankings` returns 114 ranked tools (`stats.total_tools: 114`, same slug set, none unranked); `/sitemap.xml` holds 114 tool URLs per locale (10 locales); all 114 `/en/tools/<slug>` pages return 200 with a real title.
- The brief's "~114" is correct for the catalog. The GA4 figure of 130 is "titles ending Review & Rankings" over 28 days, so it counts titles, not catalog rows. The 16-title gap cannot be closed without GA4. Candidate causes, none verified:
  1. Tools retired from the catalog but still receiving views. `ToolsRepository.findBySlug` does not filter on status, and the March 2026 cleanup deleted 9 tools plus an earlier batch (`scripts/delete-invalid-tools.ts`).
  2. Title variants for the same tool (locale, truncation, a renamed tool).
  3. Tools added or removed inside the 28-day window.
- To close it, #174 exports the 130 titles; diff against the 114 names in the CSV. Any title not in the CSV is a retired or renamed entity.

## 3. Summary and tag totals

| Type | keep | merge | noindex | cut | total |
| --- | --- | --- | --- | --- | --- |
| Tools | 80 | 10 | 24 | 0 | 114 |
| Category pages | 0 | 9 | 0 | 0 | 9 |
| All | 80 | 19 | 24 | 0 | 123 |

- **cut = 0.** The Q3 ruling forbids cut-with-data-loss for non-AI entities, and every duplicate is a merge. Nothing in the audit justifies deleting data.
- Of the 80 keeps, 22 are provisional (`tag_basis=provisional`): all sit at the default score 24.2 and are noindex candidates if views < 10 per 28 days (brief line 119, needs #174). Five of them also have an unclear identity (epic, frontier, marble, reload, crossbeam; no description or links in the data).
- After the 10 merges the catalog is 104 profiles; after the 24 noindex marks, 80 stay listed.
- Data quality: 92 of 114 tools have no description in the API. 60 of 114 (53%) have DB category `other`. 52 tools sit at the identical default score 24.2 (rank 63-114): 22 keep, 21 noindex, 9 merge.
- Non-AI entities are live today: all 24 noindex tools are in the public rankings (rank 57-114), in the sitemap, and serve `robots: index, follow`.
- No `unlisted` mechanism exists in code (grep of `app/`, `lib/`: no hit). Q3 needs a new flag or status value, and `lib/seo/utils.ts` already supports `noIndex` but `generateToolMetadata` does not pass it. This is M3 work.
- No redirect mechanism for retired tool slugs exists (`next.config.js` has no redirects; middleware handles auth only). The 10 merges need one.

Tool kind mapping for M3-1 is in the `proposed_kind` column. Across the 114 tools: coding-harness 82, non-ai 19, model 9, benchmark 2, company 1, protocol 1. Category pages are `category-page`. Treat `proposed_kind` as a first pass from slug and name knowledge.

## 4. Duplicate-entity list

Eight groups, ten retired slugs. Survivor is the shorter canonical slug (all tie at score 24.2 except OpenClaw lineage, so no rank tie-breaker applies).

| Survivor | Merge in | Basis |
| --- | --- | --- |
| `deepseek` | `deepseek-r1`, `deepseek-v3-2` | Model family split across three profiles |
| `kimi-2-5` | `moonshot-kimi-2-5` | Vendor-prefixed duplicate |
| `glm-5-0` | `zhipu-glm-5-0` | Vendor-prefixed duplicate |
| `seedance-2-0` | `bytedance-seedance-2-0` | Vendor-prefixed duplicate (survivor is also noindex, a video model) |
| `model-context-protocol` | `model-context-protocol-mcp-` | Same entity; slug has a trailing hyphen |
| `cowork` | `cowork-ai` | Same product, longer name |
| `openclaw` | `clawdbot`, `moltbot` | Rename lineage Clawdbot, MoltBot, OpenClaw. From general knowledge, verify before executing |
| `opus-4-6` | `opus-4-5` | Version duplicate. Owner to decide version-per-profile vs one Opus family slug |

Brief line 83 also names "several Opus and Grok versions". Only one Grok entity exists (`grok`), so there is no Grok merge. Only two Opus entities exist.

Related pairs reviewed and **not** merged (distinct enough, flag for the owner): `openai-codex` / `openai-codex-cli`; `gitlab-duo` / `gitlab-duo-agent-platform`; `anything` (AnythingLLM) / `anything-max`; `claude-code` / `claude-desktop-extensions`; `opus-4-6` / `sonnet-4-5` (Claude models, kept as separate models).

## 5. Broken-link list (without GA4)

### 5.1 The "Tool Not Found" render path

- `app/[lang]/tools/[slug]/metadata.ts`: when `findBySlug(slug)` returns null, metadata is `title: "Tool Not Found"` with no robots override.
- `app/[lang]/tools/[slug]/page.tsx`: renders the client component without calling `notFound()`; `tool-detail-client.tsx:154-163` shows `dict.tools.notFound` plus a back link.
- Verified on production: `/en/tools/no-such-tool-zzz`, `/en/tools/claude`, `/en/tools/chatgpt` all return **HTTP 200** with `<title>Tool Not Found</title>`. This is a soft 404: crawlers may index it, and GA4 counts the view under the title "Tool Not Found" (84 views in 28 days in the brief).

### 5.2 Tool slugs linked from the site that resolve to Tool Not Found

| Slug | Linked from | Evidence |
| --- | --- | --- |
| `nvidia-nim-agent-blueprints` | News list "View Tool" button (`components/news/news-content.tsx:506-514`) on one article | `/api/news` returns it as `tool_slug`; `/en/tools/nvidia-nim-agent-blueprints` is Tool Not Found |
| `nim-agent-blueprints` | Same, a second article | Same |

Of 631 articles, 4 carry a `tool_slug`; 2 are valid (`github-copilot`, `claude-code`) and 2 are broken. Cause: `app/api/news/route.ts:134-149` builds `tool_slug` from `findToolByText` (the 15-entry hardcoded list, #109) or from slugifying the first `toolMentions` name, and never checks the catalog. Latent cases: the matcher can emit `claude`, `chatgpt`, `gemini`, `codeium`, `amazon-codewhisperer`, `replit-ai`, `cody`, `bolt`, `v0`. Of the 15 matcher slugs, the 9 not in the catalog (`codeium`, `amazon-codewhisperer`, `replit-ai`, `cody`, `claude`, `chatgpt`, `gemini`, `v0`, `bolt`) land on Tool Not Found whenever the matcher fires. `claude` and `chatgpt` confirmed 200 + Tool Not Found. Real catalog slugs for these are `claude-code`/`claude-artifacts`, `chatgpt-canvas`, `replit-agent`, `sourcegraph-cody`, `bolt-new`, `v0-vercel`.

Counted broken links: **2 live (news API), 9 latent (matcher slugs)**.

### 5.3 Category and rankings pages

- The 9 `/en/best-*` pages contain no `/tools/<slug>` links (grep found none); they link only to `/rankings?category=` and `/tools?category=`. No broken tool links from them.
- All 114 rankings entries resolve; none point to a missing slug.
- Article-detail pages link tools through `findBySlug` results only (`news-detail-content.tsx:692`), so they cannot link to a missing slug.

### 5.4 Referrer-based list: pending #174

The 84 "Tool Not Found" views and their referrers/landing paths need GA4. Column `tool_not_found_referrers_pending_174` in the CSV is blank for that purpose. The likely sources are slugs from sections 5.2 and retired entities (section 2, cause 1).

## 6. Open items

For #174 (GA4):
1. Fill `views_90d` (blank in CSV; brief used a 28-day window, use whichever #174 exports, and rename the column if it is 28d).
2. Export the 130 profile titles and diff against the 114 names (section 2).
3. Pull landing page and referrer for the "Tool Not Found" title; confirm 5.2 slugs and find retired slugs.
4. Apply the brief's rule: noindex tools under about 10 views per 28 days with no score movement. Candidates are rows with `default-score-24.2` in `flags` and `tag_basis=provisional`.

For the owner / M3:
5. Confirm the 5 unclear entities (epic, frontier, marble, reload, crossbeam) and the low-confidence rows (`confidence=low`).
6. Decide Opus: per-version profiles or one family; verify the OpenClaw lineage.
7. Build `unlisted` plus noindex wiring and slug 301s before applying tags (section 3).
8. Make unknown tool slugs return a real 404 or at least `noindex`, and make `/api/news` drop `tool_slug` values not in the catalog (fixes 5.2 at the source with #109).
9. The category merge target `/rankings/coding-harnesses` does not exist yet; the 9 merge rows apply only after M3.
10. Auto-create path still has no allowlist (`createAutoTool()`); the 24 noindex rows include entities created by it, and the same would recur. Found by code inspection of `createAutoTool()`.

## 7. CSV columns

Required: `slug, name, type (tool|category_page), kind_or_category, tag (keep|merge|noindex|cut), merge_target, reason, views_90d`.
Added: `proposed_kind`, `rank_2026_10`, `score`, `http_status`, `robots_meta` (from the live GET), `tag_basis` (decided|provisional), `confidence` (normal|low), `flags` (no-description, default-score-24.2), `tool_not_found_referrers_pending_174`. For category pages `merge_target` is the route filter on `/rankings/coding-harnesses`. For tool merges it is the surviving slug.
