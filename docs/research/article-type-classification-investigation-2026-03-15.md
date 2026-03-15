# Article Type Classification Investigation

**Date:** 2026-03-15
**Status:** Complete
**Classification:** Informational — identifies root cause with actionable fix recommendations

---

## Summary

Articles on the AI Power Ranking site are over-classified as "announcement" due to a weak, order-dependent keyword matching system in the `/api/news` route. The system defaults to `"update"` and only upgrades to a more specific type when specific keywords are found — but the `"announcement"` bucket catches many articles that would better fit `"feature"` or `"update"`, because the keyword sets are too narrow for `"feature"` and `"milestone"` and the `"announcement"` branch sweeps in common AI-news vocabulary (`"hiring"`, `"ceo"`, `"leadership"`, `"rebrand"`).

---

## 1. Where Classification Happens

### Primary location: `/app/api/news/route.ts`, lines 82–145

This is where `event_type` is determined for every article returned from the database. There is no DB-stored event type — the classification is computed on every API request by inspecting article tags and title/summary text.

```
app/api/news/route.ts   lines 82-145   — main classification logic
```

### Secondary location (rendering/display only)

- `components/news/news-content.tsx` line 255 — defines the valid filter tabs: `["all", "milestone", "feature", "partnership", "update", "announcement"]`
- `components/news/news-card.tsx` lines 36-51 — maps type to badge colour

Neither component influences classification; they just display what the API returns.

### Ingestion / AI prompt

- `lib/services/article-ingestion.service.ts` lines 536-643 — the LLM prompt (Claude Sonnet 4 via OpenRouter)

The LLM prompt does **not** ask the model to classify article type/event type at all. It returns a `category` field (e.g., `"Code Assistant"`, `"LLM"`) which is stored in `articles.category` in the database. The `event_type` displayed on the site is **never stored** — it is re-computed dynamically in the API route.

---

## 2. Valid Article Types

Defined by the UI filter tab list (`news-content.tsx` line 255):

| Type           | UI colour (badge)         |
|----------------|---------------------------|
| `milestone`    | primary                   |
| `feature`      | secondary                 |
| `partnership`  | accent                    |
| `update`       | blue                      |
| `announcement` | orange                    |

There is no database enum or schema constraint enforcing these values.

---

## 3. How Type Is Determined — Current Logic

The classification is **keyword matching** applied sequentially in `app/api/news/route.ts`.

### Step 1: Default
```ts
let eventType = "update";
```

### Step 2: Tag-based override (lines 87-108)
Joins all tags into a string, then checks:

| Keyword in tags                                   | Sets type to     |
|---------------------------------------------------|------------------|
| `launch`, `beta`, `general-availability`          | `feature`        |
| `milestone`, `revenue`, `funding`, `growth`       | `milestone`      |
| `benchmark`, `performance`                        | `feature`        |
| `rebrand`, `acquisition`                          | `announcement`   |
| `partnership`                                     | `partnership`    |

### Step 3: Content fallback — only runs if `eventType` is still `"update"` (lines 112-145)
Checks `title + summary` text:

| Keyword in text                                                    | Sets type to     |
|--------------------------------------------------------------------|------------------|
| `funding`, `raised`, `investment`, `valuation`, `arr`             | `milestone`      |
| `launch`, `released`, `feature`, `introduces`                     | `feature`        |
| `partnership`, `acquired`, `acquisition`                          | `partnership`    |
| `hiring`, `ceo`, `leadership`, `rebrand`                          | `announcement`   |

**No further fallback.** If none of the Step 3 keywords match, the type stays as `"update"`.

---

## 4. Why "announcement" Is Over-Used

Several compounding issues:

### Issue A: The "announcement" keyword net is too broad

The Step 3 `announcement` branch fires on `"ceo"`, `"hiring"`, `"leadership"` — words that appear in many AI news articles even when the primary news is a product launch or funding round. For example:
- "GitHub Copilot CEO on new feature launches" → `ceo` fires → `announcement`
- "Cursor announces leadership changes alongside v2 launch" → `leadership` fires → `announcement`; the `launch` keyword in Step 3 never gets checked because the `announcement` branch is checked **after** `feature` and `partnership` — if `feature` didn't match first (and the keywords are in different clauses), `announcement` can still win

### Issue B: The Step 3 branches are evaluated in order without priority

The current code is a series of `else if` blocks:
```ts
if (text.includes("funding") ...) { eventType = "milestone" }
else if (text.includes("launch") ...) { eventType = "feature" }
else if (text.includes("partnership") ...) { eventType = "partnership" }
else if (text.includes("hiring") || text.includes("ceo") ...) { eventType = "announcement" }
```

An article that mentions both "launch" and "leadership" will get classified as `feature` (good). But an article that primarily announces a new feature but doesn't use the word "launch", "released", "feature", or "introduces" — yet does mention a "CEO quote" — will land on `announcement`.

### Issue C: Step 3 only runs if Step 2 left the type as `"update"`

Articles that matched a tag keyword in Step 2 bypass Step 3 entirely. If a tag contains `acquisition`, the type is set to `announcement` even if the title says "acquires X to launch new AI feature".

### Issue D: The LLM stores no event type

The ingestion prompt (`article-ingestion.service.ts` lines 582-643) never asks the AI to classify article type. The `AIAnalysisSchema` (lines 51-85) has no `event_type` or `news_type` field. All the rich context the LLM has when processing the article is discarded for classification purposes.

### Issue E: The `category` field (stored by LLM) is not used in classification

The database `articles.category` stores the LLM's AI category (e.g., `"Code Assistant"`). The `event_type` logic in the API route never reads `article.category`, making the stored LLM analysis completely unused for classification.

---

## 5. Data Distribution

The database has no dedicated `event_type` column — it cannot be queried directly. All classification is computed at API call time. The `category` column (stored by LLM) reflects AI product categories, not article event types.

To get a live distribution, run:
```sql
SELECT category, COUNT(*) FROM articles WHERE status = 'active' GROUP BY category ORDER BY count DESC;
```

The `event_type` distribution on the frontend depends entirely on what the keyword logic produces. Given the broad "announcement" net (ceo, hiring, leadership), a significant fraction of tech news articles will hit that branch.

---

## 6. Recent Changes to Classification Logic

Based on git log, the classification logic in `app/api/news/route.ts` has not been independently modified. The most recent changes to this file were:
- `812f258e` — mobile cache-busting (no classification change)
- `5cdaf284` — v0.4.0 automated ingestion feature (classification logic was introduced here or in a prior commit)

The LLM prompt was last significantly changed around `6be66986` and `95206d5c` (summary length changes), but the prompt never included event type classification.

---

## 7. Fix Recommendations

### Recommendation 1 (Best): Add `news_type` to LLM prompt and store it in DB (High impact)

Extend the AI analysis schema to include a `news_type` field classified by the LLM at ingest time:

**In `article-ingestion.service.ts` user prompt (line 597), add:**
```json
"news_type": "One of: feature|milestone|partnership|update|announcement",
```

**Guidance to add to system prompt:**
```
- "feature": New product feature, capability launch, or technical release
- "milestone": Funding round, revenue milestone, user growth, acquisition
- "partnership": Strategic partnership, integration announcement, collaboration
- "update": General product update, minor improvement, maintenance release
- "announcement": Executive/leadership news, company rebranding, policy change, hiring
```

**Store in DB:** Add `news_type varchar(50)` column to `articles` table, populate from LLM at ingest.

**Use in API:** Replace the keyword logic in `app/api/news/route.ts` with `article.newsType || "update"`.

This eliminates the fragile keyword matching entirely and leverages the LLM's contextual understanding.

---

### Recommendation 2 (Quick fix): Tighten keyword matching rules

If DB schema changes are not immediate, improve the existing keyword logic:

**In `app/api/news/route.ts`, Step 3 (lines 112-145):**

1. Move `announcement` to be checked **only after all other types fail** (currently it is last but the keyword net is too wide).

2. Remove `"ceo"` and `"hiring"` from the announcement keywords — these are common in AI news articles and should not override a neutral article into `announcement`. Reserve `announcement` for truly announcement-specific language.

3. Expand the `feature` keyword set:
   ```ts
   text.includes("launch") || text.includes("released") || text.includes("feature") ||
   text.includes("introduces") || text.includes("new model") || text.includes("announces") ||
   text.includes("unveils") || text.includes("debuts")
   ```

4. Add keyword priority: if an article matches both `feature` keywords and `announcement` keywords, prefer `feature`.

---

### Recommendation 3 (Quick win): Use `article.category` as a signal

The LLM already stores a category like `"Code Assistant"` or `"LLM"`. This is not the same as event type but articles with `category === "LLM"` are often feature/milestone releases. It could serve as a tie-breaker.

---

## Files to Change

| File | Purpose | Change Needed |
|------|---------|---------------|
| `app/api/news/route.ts` | Event type classification | Tighten keyword logic or read from DB |
| `lib/services/article-ingestion.service.ts` | LLM prompt | Add `news_type` field to prompt |
| `lib/db/article-schema.ts` | DB schema | Add `news_type` column to `articles` table |
| `lib/db/repositories/news.ts` | DB repository | Include `news_type` in `NewsArticle` mapping |
