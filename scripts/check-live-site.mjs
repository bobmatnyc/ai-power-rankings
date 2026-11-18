#!/usr/bin/env node
/**
 * Daily deterministic check of the live site and API.
 *
 * Why: owner ruling, a no-LLM daily read of production with pass/fail output.
 * What: sequential GETs (2 s apart, 15 s timeout, one retry on network error)
 * against BASE_URL / --base (default https://aipowerranking.com); prints one
 * `PASS|WARN|FAIL <name> <detail>` line per check and a summary, exits 1 on any
 * FAIL. Verdicts live in scripts/lib/live-site-checks.mjs.
 * Test: `tests/unit/live-site-check.test.ts`.
 */
import {
  checkDigestPage,
  checkDigestRss,
  checkHomeTitle,
  checkMonthlyInsights,
  checkNewsApi,
  checkRankingsApi,
  checkRankingsPage,
  checkRootRedirect,
  checkStatus200,
  checkTtfb,
  digestWeekKey,
  formatResult,
  previousMonthKey,
  summarize,
} from "./lib/live-site-checks.mjs";

const USER_AGENT = "aipr-live-check";
const TIMEOUT_MS = 15000;
const DELAY_MS = 2000;

function baseUrl(argv, env) {
  const i = argv.indexOf("--base");
  const raw = (i >= 0 ? argv[i + 1] : env.BASE_URL) || "https://aipowerranking.com";
  return raw.replace(/\/+$/, "");
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchOnce(url) {
  const started = performance.now();
  const res = await fetch(url, {
    redirect: "manual",
    headers: { "user-agent": USER_AGENT },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const ttfbMs = Math.round(performance.now() - started);
  const body = await res.text();
  const headers = {};
  res.headers.forEach((v, k) => (headers[k.toLowerCase()] = v));
  return { status: res.status, headers, body, ttfbMs };
}

let first = true;
const samples = [];

async function get(base, path) {
  if (!first) await sleep(DELAY_MS);
  first = false;
  let res;
  try {
    res = await fetchOnce(base + path);
  } catch {
    // One retry on a network error or timeout only; a bad status is never retried.
    await sleep(DELAY_MS);
    try {
      res = await fetchOnce(base + path);
    } catch (err) {
      res = { error: err?.name === "TimeoutError" ? "timeout" : String(err?.message || err) };
    }
  }
  samples.push({ path, ttfbMs: res.ttfbMs });
  return res;
}

async function main() {
  const base = baseUrl(process.argv.slice(2), process.env);
  const now = new Date();
  const week = digestWeekKey(now);
  const month = previousMonthKey(now);
  console.log(`live-site-check ${base} at ${now.toISOString()}`);

  const results = [];
  const record = (r) => {
    results.push(r);
    console.log(formatResult(r));
  };

  record(checkRootRedirect(await get(base, "/")));
  record(checkHomeTitle(await get(base, "/en")));
  record(checkRankingsPage(await get(base, "/en/rankings")));
  record(checkStatus200("tool-page-claude-code", await get(base, "/en/tools/claude-code")));
  record(checkRankingsApi(await get(base, "/api/rankings/current"), now));
  record(checkNewsApi(await get(base, "/api/news"), now));
  record(checkDigestPage(await get(base, `/en/whats-new/weekly/${week}`), week));
  record(checkDigestRss(await get(base, "/en/whats-new/rss.xml"), week));
  record(checkMonthlyInsights(await get(base, `/en/insights/monthly/${month}`), month));
  record(checkStatus200("sitemap", await get(base, "/sitemap.xml")));
  record(checkStatus200("robots", await get(base, "/robots.txt")));
  record(checkTtfb(samples));

  const { line, exitCode } = summarize(results);
  console.log(line);
  process.exitCode = exitCode;
}

main().catch((err) => {
  console.log(`FAIL runner ${err?.stack || err}`);
  process.exitCode = 1;
});
