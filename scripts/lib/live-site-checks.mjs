/**
 * Pure pass/fail logic for the daily live-site check.
 *
 * Why: the owner wants a deterministic (no LLM) daily read of the live site and
 * API. Keeping the verdicts free of I/O lets the unit tests feed fixture
 * responses and a fixed clock.
 * What: each `check*` takes fetched responses `{ status, headers, body, ttfbMs }`
 * (headers keyed lower-case) and returns `{ level, name, detail }` with level
 * PASS, WARN or FAIL. `digestWeekKey` picks the ISO week the digest must cover,
 * `summarize` folds results into a summary line and an exit code.
 * Test: `tests/unit/live-site-check.test.ts`.
 */

export const TTFB_WARN_MS = 3000;
export const TTFB_FAIL_MS = 10000;
export const MIN_RANKING_LINKS = 20;
export const MIN_RANKING_ENTRIES = 50;
export const NEWS_MAX_AGE_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

const pass = (name, detail) => ({ level: "PASS", name, detail });
const warn = (name, detail) => ({ level: "WARN", name, detail });
const fail = (name, detail) => ({ level: "FAIL", name, detail });

/** One output line: `PASS|WARN|FAIL <name> <detail>`. */
export function formatResult(result) {
  return `${result.level} ${result.name} ${result.detail}`;
}

/** `YYYY-MM` of `date` in UTC. */
export function monthKey(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** `YYYY-MM` of the UTC month before the one holding `now`. */
export function previousMonthKey(now) {
  return monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)));
}

/** Monday 00:00 UTC of the ISO week containing `date`. */
function mondayOf(date) {
  const day = date.getUTCDay() || 7;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - (day - 1)));
}

/** ISO-8601 week key `YYYY-Www`; same rule as `isoWeekKey` in lib/weekly-digest-window.ts. */
export function isoWeekKey(date) {
  const thursday = new Date(mondayOf(date).getTime() + 3 * DAY_MS);
  const year = thursday.getUTCFullYear();
  const week = Math.floor((thursday.getTime() - Date.UTC(year, 0, 1)) / DAY_MS / 7) + 1;
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/**
 * The week whose digest must be live at `now`.
 *
 * From Monday 09:00Z it is the previous ISO week (`previousIsoWeek`); before
 * that the new digest may not be written yet, so it is the week before that.
 */
export function digestWeekKey(now) {
  const monday = mondayOf(now);
  const cutoff = monday.getTime() + 9 * 60 * 60 * 1000;
  const weeksBack = now.getTime() >= cutoff ? 1 : 2;
  return isoWeekKey(new Date(monday.getTime() - weeksBack * 7 * DAY_MS));
}

/**
 * The insights month that must be live at `now`.
 *
 * /api/cron/monthly-summary runs `0 8 1 * *` (vercel.json), so before 09:00Z on
 * the 1st last month's page may not exist; check two months back then.
 */
export function monthlyInsightsKey(now) {
  const early = now.getUTCDate() === 1 && now.getUTCHours() < 9;
  return monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (early ? 2 : 1), 1)));
}

/** True for a gateway status worth one retry; a persistent one still FAILs. */
export function isRetryableStatus(status) {
  return status === 502 || status === 503 || status === 504;
}

/** Run one check; a thrown error becomes that check's FAIL so the rest still run. */
export async function runCheck(name, fn) {
  try {
    return await fn();
  } catch (err) {
    return fail(name, `check threw: ${err?.message || err}`);
  }
}

function statusIs(name, res, expected) {
  if (res.error) return fail(name, `request failed: ${res.error}`);
  if (res.status !== expected) return fail(name, `status ${res.status}, want ${expected}`);
  return null;
}

function parseJson(name, res) {
  try {
    const json = JSON.parse(res.body);
    if (json === null || typeof json !== "object") return { result: fail(name, "JSON body is not an object") };
    return { json };
  } catch {
    return { result: fail(name, "body is not JSON") };
  }
}

/** a. `/` redirects (307/308, no follow) to `/en`. */
export function checkRootRedirect(res) {
  const name = "root-redirect";
  if (res.error) return fail(name, `request failed: ${res.error}`);
  if (res.status !== 307 && res.status !== 308) return fail(name, `status ${res.status}, want 307/308`);
  const location = res.headers.location || "";
  if (!/\/en\/?$/.test(location)) return fail(name, `location "${location}" does not end /en`);
  return pass(name, `${res.status} -> ${location}`);
}

/** a. `/en` is 200 with a non-empty `<title>`. */
export function checkHomeTitle(res) {
  const name = "home-title";
  const bad = statusIs(name, res, 200);
  if (bad) return bad;
  const match = /<title[^>]*>([^<]*)<\/title>/i.exec(res.body);
  const title = match ? match[1].trim() : "";
  if (!title) return fail(name, "no non-empty <title>");
  return pass(name, `title "${title.slice(0, 60)}"`);
}

/** b. `/en/rankings` is 200 with at least 20 distinct tool links. */
export function checkRankingsPage(res) {
  const name = "rankings-page";
  const bad = statusIs(name, res, 200);
  if (bad) return bad;
  const slugs = new Set();
  for (const m of res.body.matchAll(/\/en\/tools\/([a-z0-9][a-z0-9-]*)/gi)) slugs.add(m[1].toLowerCase());
  if (slugs.size < MIN_RANKING_LINKS) return fail(name, `${slugs.size} tool links, want >= ${MIN_RANKING_LINKS}`);
  return pass(name, `${slugs.size} tool links`);
}

/** c, g-pre, h: a plain status-200 check. */
export function checkStatus200(name, res) {
  return statusIs(name, res, 200) || pass(name, "200");
}

/** d. `/api/rankings/current`: success, >= 50 entries, current or previous month. */
export function checkRankingsApi(res, now) {
  const name = "api-rankings-current";
  const bad = statusIs(name, res, 200);
  if (bad) return bad;
  const parsed = parseJson(name, res);
  if (parsed.result) return parsed.result;
  const { json } = parsed;
  if (json.success !== true) return fail(name, "success is not true");
  const rankings = json.data?.rankings;
  const count = Array.isArray(rankings) ? rankings.length : 0;
  if (count < MIN_RANKING_ENTRIES) return fail(name, `${count} entries, want >= ${MIN_RANKING_ENTRIES}`);
  const period = json.data?.period;
  const allowed = [monthKey(now), previousMonthKey(now)];
  if (!allowed.includes(period)) return fail(name, `period "${period}" not in ${allowed.join("/")}`);
  return pass(name, `${count} entries, period ${period}`);
}

/** e. `/api/news`: newest `event_date` within 7 days of `now`. */
export function checkNewsApi(res, now) {
  const name = "api-news";
  const bad = statusIs(name, res, 200);
  if (bad) return bad;
  const parsed = parseJson(name, res);
  if (parsed.result) return parsed.result;
  const news = Array.isArray(parsed.json.news) ? parsed.json.news : [];
  const times = news.map((n) => Date.parse(n?.event_date)).filter((t) => Number.isFinite(t));
  if (times.length === 0) return fail(name, "no news item with an event_date");
  const newest = Math.max(...times);
  const ageDays = (now.getTime() - newest) / DAY_MS;
  const iso = new Date(newest).toISOString();
  if (ageDays > NEWS_MAX_AGE_DAYS) return fail(name, `newest ${iso} is ${ageDays.toFixed(1)} days old`);
  return pass(name, `newest ${iso}`);
}

/** f. The weekly digest page for `week` is 200. */
export function checkDigestPage(res, week) {
  const name = "weekly-digest-page";
  return statusIs(name, res, 200) || pass(name, `${week} 200`);
}

/** f. The What's New RSS feed is 200 and names `week`. */
export function checkDigestRss(res, week) {
  const name = "whats-new-rss";
  const bad = statusIs(name, res, 200);
  if (bad) return bad;
  if (!res.body.includes(week)) return fail(name, `feed does not contain ${week}`);
  return pass(name, `contains ${week}`);
}

/** g. Monthly insights page is 200 and publicly cacheable (#470). */
export function checkMonthlyInsights(res, month) {
  const name = "monthly-insights";
  const bad = statusIs(name, res, 200);
  if (bad) return bad;
  const cc = res.headers["cache-control"] || "";
  if (!cc.includes("public")) return fail(name, `${month} cache-control "${cc}" lacks public`);
  return pass(name, `${month} cache-control "${cc}"`);
}

/** i. Slowest time to first byte across page requests. */
export function checkTtfb(samples) {
  const name = "ttfb";
  const timed = samples.filter((s) => Number.isFinite(s.ttfbMs));
  if (timed.length === 0) return fail(name, "no timed requests");
  const slowest = timed.reduce((a, b) => (b.ttfbMs > a.ttfbMs ? b : a));
  const detail = `slowest ${slowest.path} ${slowest.ttfbMs}ms over ${timed.length} requests`;
  if (slowest.ttfbMs >= TTFB_FAIL_MS) return fail(name, detail);
  if (slowest.ttfbMs >= TTFB_WARN_MS) return warn(name, detail);
  return pass(name, detail);
}

/** Summary line and exit code: 1 when any result is FAIL, else 0. */
export function summarize(results) {
  const count = (level) => results.filter((r) => r.level === level).length;
  const failed = count("FAIL");
  return {
    line: `SUMMARY ${count("PASS")} pass, ${count("WARN")} warn, ${failed} fail`,
    exitCode: failed > 0 ? 1 : 0,
  };
}
