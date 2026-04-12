# Article Auto-Discovery Ingestion Stall Investigation

**Date:** 2026-03-19
**Symptom:** Last article is 5 days old (circa 2026-03-14); cron should run daily.

---

## 1. Cron Schedule

File: `vercel.json`

```json
{
  "path": "/api/cron/daily-news",
  "schedule": "0 6 * * *"
}
```

Runs every day at **06:00 UTC**. The monthly-summary cron (`/api/cron/monthly-summary`) runs at `0 8 1 * *` (08:00 UTC on the 1st of each month) — not relevant here.

---

## 2. Cron Route Auth Mechanism

File: `app/api/cron/daily-news/route.ts`, lines 35–50

The current auth is **Bearer token only**:

```ts
function isAuthorizedCronRequest(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env["CRON_SECRET"];

  if (!cronSecret) {
    loggers.api.error("Cron: CRON_SECRET environment variable not configured");
    return false;          // <-- returns false immediately, blocks all cron calls
  }

  if (authHeader === `Bearer ${cronSecret}`) {
    loggers.api.info("Cron: Authorized via Bearer token");
    return true;
  }

  return false;
}
```

- **What it checks:** `Authorization: Bearer <CRON_SECRET>` header only.
- **What Vercel sends:** According to Vercel docs, the cron scheduler sends `Authorization: Bearer <CRON_SECRET>` — so this is correct IF `CRON_SECRET` is set in the Vercel project's environment variables.
- **Hard failure mode:** If `CRON_SECRET` is missing from the production environment, `isAuthorizedCronRequest` returns `false` immediately and the endpoint returns HTTP 401. The cron job silently fails every day.

---

## 3. Article Ingestion Service

File: `lib/services/automated-ingestion.service.ts`

The pipeline is:
1. `AutomatedIngestionService.runDailyDiscovery()` called from the cron route.
2. Checks `TavilySearchService.isConfigured()` (reads `TAVILY_API_KEY`).
3. Falls back to `BraveSearchService.isAvailable()` (reads `BRAVE_SEARCH_API_KEY`).
4. If **neither** is configured → logs error and returns `status: "failed"` immediately.
5. Article content extraction chain: Tavily Extract → Jina Reader → basic HTML fetch.
6. Quality assessment via OpenRouter LLM call.
7. Writes to DB via `ArticleIngestionService`.

Key code (`automated-ingestion.service.ts` lines 285–296):

```ts
const useTavily = this.tavilySearchService.isConfigured();
const useBrave = this.braveSearchService.isAvailable();

if (!useTavily && !useBrave) {
  const errorMsg = "No search API configured (Tavily or Brave) - cannot discover articles";
  loggers.api.error("[AutomatedIngestion] " + errorMsg);
  errors.push(errorMsg);
  // returns IngestionResult with status: "failed"
}
```

`TavilySearchService.isConfigured()` (line 68): returns `!!this.apiKey`, where `this.apiKey = apiKey || process.env.TAVILY_API_KEY || ''`.

---

## 4. Environment Variable Status

### `.env.local` (local dev — does NOT affect production):
- `TAVILY_API_KEY`: **NOT SET** (absent from file)
- `CRON_SECRET`: **NOT SET** (absent from file)
- `OPENROUTER_API_KEY`: Set
- `DATABASE_URL`: Set

### `.env.production.local` (production snapshot pulled via Vercel CLI):
- `TAVILY_API_KEY`: **SET** — `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`
- `BRAVE_SEARCH_API_KEY`: **SET** — `BSAQQh-MpVe_EZlRV8yQgiw88BfCZms`
- `CRON_SECRET`: **SET** — `cron-secret-aipowerranking-2026-v2-a65HfuSHbwxkXkhn`
- `OPENROUTER_API_KEY`: Set
- `DATABASE_URL`: **EMPTY STRING** in this snapshot (likely populated from Doppler/secrets in actual deploy)

This snapshot is what Vercel CLI pulled. The `DATABASE_URL` being empty here may just mean it is managed via a Vercel integration (Neon) and not stored in the env file directly.

---

## 5. Article DB Schema

File: `lib/db/article-schema.ts`, lines 98–100

```ts
createdAt: timestamp("created_at").defaultNow().notNull(),
updatedAt: timestamp("updated_at").defaultNow().notNull(),
```

The `articles` table has `created_at` (set on insert). There is also `ingested_at` (line 83) and `published_date` (line 82 — nullable, sourced from the article's actual publication date).

The news API route (`app/api/news/route.ts`) uses `published_at || publishedAt || created_at || createdAt` as the effective display date, so both fields matter.

---

## 6. Recent Auth-Related Git History

Two commits are directly relevant:

| Commit | Date | Message |
|--------|------|---------|
| `9c92a822` | 2026-02-24 | `fix(cron): enable Vercel cron scheduler authentication` — Added x-vercel-cron header, user-agent, and Vercel env checks |
| `abaecf71` | 2026-02-25 | `fix(security): remove insecure cron auth methods — endpoint was open to public` — Removed all methods except Bearer token |

The commit `abaecf71` (2026-02-25) stripped the auth back to **Bearer token only**. This is the correct pattern per Vercel docs. However, it creates a new dependency: `CRON_SECRET` **must** be set as a Vercel Environment Variable in the project dashboard and also set correctly in the `vercel.json`-based cron context.

---

## 7. Manual Trigger / Test Endpoint

File: `scripts/trigger-ingestion.ts`

Can be run locally:
```bash
npx tsx scripts/trigger-ingestion.ts --dry-run
npx tsx scripts/trigger-ingestion.ts --max-articles=5
npx tsx scripts/trigger-ingestion.ts --days=7
```

Requires `TAVILY_API_KEY` (or `BRAVE_SEARCH_API_KEY`) and `DATABASE_URL` in the local environment. The script bypasses HTTP auth entirely — it calls `AutomatedIngestionService` directly. This is the fastest way to test whether the pipeline itself works independently of the cron auth issue.

The admin UI also has a trigger at `/[lang]/(authenticated)/admin/automated-ingestion/`.

---

## 8. Root Cause Analysis

### Most Likely Cause: CRON_SECRET not set in Vercel production environment

The security fix commit (`abaecf71`, 2026-02-25) is 22 days before the reported stall (last article ~2026-03-14). This timeline does not match — the stall would have started on 2026-02-25 if it were the sole cause. However, if `CRON_SECRET` was set in Vercel at the time of commit `9c92a822` but was not carried forward or was accidentally cleared, the stall could appear later.

The key logic is:
```ts
if (!cronSecret) {
  loggers.api.error("Cron: CRON_SECRET environment variable not configured");
  return false;  // auth fails, 401 returned, nothing ingested
}
```

If `CRON_SECRET` is missing from Vercel's environment variables for production, every daily cron invocation returns 401 and the pipeline never runs.

### Secondary Cause: TAVILY_API_KEY quota/expiry

`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` is set in the production env snapshot. However, Tavily API keys can hit monthly quota limits (the free tier caps at 1,000 calls/month; even paid tiers can exhaust). If the key expired or quota was exhausted, `TavilySearchService.isConfigured()` would return `true` but all search calls would return 401/429 errors. The pipeline would then also check `BraveSearchService.isAvailable()` — Brave key is set in `.env.production.local` so it should fall back. Unless Brave Search API key also expired/was removed from the live Vercel env.

### Tertiary Cause: maxDuration timeout

The cron route sets `maxDuration = 800` (800 seconds = ~13 min). Vercel Pro plan supports up to 800s. If the account plan changed or the pipeline consistently exceeds this, functions would be killed silently. Less likely but worth noting.

---

## 9. Recommended Fixes

### Immediate: Verify CRON_SECRET in Vercel Dashboard

1. Open Vercel dashboard → Project settings → Environment Variables.
2. Confirm `CRON_SECRET` is set for the **Production** environment.
3. The value must match what the cron scheduler sends. Per Vercel docs, Vercel automatically sends the value of `CRON_SECRET` as a Bearer token when it invokes a cron route.
4. If it is not set, add it: `CRON_SECRET=cron-secret-aipowerranking-2026-v2-a65HfuSHbwxkXkhn` (value from `.env.production.local`).
5. Redeploy after adding the variable (env var changes require a new deployment to take effect on serverless functions).

### Verify TAVILY_API_KEY quota

1. Log into https://app.tavily.com and check usage/quota for `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`.
2. If exhausted, upgrade plan or rotate key and update in Vercel.

### Test the pipeline directly (bypasses auth)

```bash
cd /Users/masa/Projects/aipowerranking
# Requires TAVILY_API_KEY and DATABASE_URL in local shell
TAVILY_API_KEY=tvly-prod-... DATABASE_URL=postgresql://... npx tsx scripts/trigger-ingestion.ts --dry-run --max-articles=3
```

### Test the HTTP endpoint manually

```bash
curl -i -X GET \
  -H "Authorization: Bearer cron-secret-aipowerranking-2026-v2-a65HfuSHbwxkXkhn" \
  https://aipowerranking.com/api/cron/daily-news
```

If this returns 401, `CRON_SECRET` is not set in Vercel production (or does not match).
If it returns 500, the pipeline runs but throws an error (check Vercel function logs).
If it returns 200 with `articlesIngested: 0`, the pipeline ran but found nothing new.

---

## Summary Table

| Item | Status | Notes |
|------|--------|-------|
| Cron schedule | `0 6 * * *` (daily 06:00 UTC) | Correctly configured in vercel.json |
| Auth mechanism | Bearer token only | `Authorization: Bearer <CRON_SECRET>` |
| Auth check file/line | `app/api/cron/daily-news/route.ts` lines 35–50 | `isAuthorizedCronRequest()` |
| TAVILY_API_KEY in .env.local | NOT SET | Local dev only; production has it |
| TAVILY_API_KEY in production | SET | `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` |
| CRON_SECRET in .env.local | NOT SET | Not needed for local dev |
| CRON_SECRET in production | SET in snapshot | Must be confirmed in live Vercel dashboard |
| Manual trigger script | Available | `scripts/trigger-ingestion.ts` |
| Most likely root cause | CRON_SECRET missing from Vercel production env OR Tavily quota exhausted | Verify in Vercel dashboard |
