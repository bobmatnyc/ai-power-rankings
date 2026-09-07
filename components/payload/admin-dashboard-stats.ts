/**
 * The response shapes the admin dashboard's four endpoints actually return, and
 * the pure mapping from those bodies to the numbers the cards display.
 *
 * Why: `AdminDashboard` read `totalDocs` off all three list endpoints. That is
 * the Payload CMS collection shape and none of these routes has ever returned
 * it, so every count fell through `|| 0` and the dashboard rendered zeros that
 * were indistinguishable from real ones (#140 follow-up). The interfaces below
 * exist so the next such typo fails `tsc` instead: `totalDocs` is not a member
 * of any of them.
 * What: One interface per endpoint, mirroring the route's own success body, and
 * `buildDashboardStats()` reducing the four bodies to a display model. A count
 * is `null` — rendered as an em dash — only when the body carried no such
 * field, which with the correct field names means the fetch failed. Nothing is
 * coerced to 0, so "zero rows" and "could not read" stay distinguishable.
 * Test: `tests/unit/admin-dashboard-stats.test.ts`.
 */

/**
 * `GET /api/news` — see `app/api/news/route.ts`.
 *
 * The count lives in `total`; the route has never returned `totalDocs`.
 * Fields are optional because a 500/503 from this route answers with
 * `{ error, message }` instead.
 */
export interface NewsListResponse {
  news?: unknown[];
  total?: number;
  hasMore?: boolean;
}

/**
 * `GET /api/tools` — see `app/api/tools/route.ts`.
 *
 * The route accepts no query parameters and returns every active tool, so the
 * length of `tools` is the total. There is no count field to read.
 */
export interface ToolsListResponse {
  tools?: unknown[];
}

/**
 * `GET /api/rankings` — see `app/api/rankings/route.ts`.
 *
 * `stats.total_tools` is the tool count of the current snapshot and is present
 * on both success branches. `period` and `published_at` are absent from the
 * no-rankings-yet branch, which returns `stats.total_tools: 0`.
 */
export interface RankingsResponse {
  rankings?: unknown[];
  stats?: { total_tools?: number };
  period?: string;
  published_at?: string;
}

/**
 * `GET /api/admin/subscribers`.
 *
 * No route implements this path, so the fetch 404s and the subscriber count is
 * always `null`. The shape mirrors what `SubscribersManager` reads from the
 * same endpoint, so it stays correct if the route is added.
 */
export interface SubscribersResponse {
  stats?: { total?: number };
}

/** The four bodies the dashboard reads; `null` means that one fetch failed. */
export interface DashboardResponses {
  tools: ToolsListResponse | null;
  rankings: RankingsResponse | null;
  news: NewsListResponse | null;
  subscribers: SubscribersResponse | null;
}

/** What the cards render. `null` is an em dash, never a zero. */
export interface DashboardStats {
  totalTools: number | null;
  totalRankings: number | null;
  totalNews: number | null;
  totalSubscribers: number | null;
  latestPeriod: string | null;
  lastPublishedAt: string | null;
}

/** Accepts a count only when the body carried a real, finite number. */
function displayableCount(value: number | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Accepts a string only when the body carried a non-empty one. */
function displayableText(value: string | undefined): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Reduces the four endpoint bodies to the dashboard's display model.
 *
 * Why: this mapping is where #140's `totalDocs` bug lived, so it is separated
 * from the component to be tested directly against the real response shapes.
 * What: pure — no fetching, no clock, no locale. `lastPublishedAt` is passed
 * through as the raw ISO string the route emits; the component formats it.
 * Test: `tests/unit/admin-dashboard-stats.test.ts`.
 */
export function buildDashboardStats({
  tools,
  rankings,
  news,
  subscribers,
}: DashboardResponses): DashboardStats {
  const toolList = tools?.tools;

  return {
    totalTools: Array.isArray(toolList) ? toolList.length : null,
    totalRankings: displayableCount(rankings?.stats?.total_tools),
    totalNews: displayableCount(news?.total),
    totalSubscribers: displayableCount(subscribers?.stats?.total),
    latestPeriod: displayableText(rankings?.period),
    lastPublishedAt: displayableText(rankings?.published_at),
  };
}
