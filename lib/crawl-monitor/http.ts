/**
 * Response helpers for the crawl monitor routes (#325).
 *
 * Why: every crawl-monitor response, including auth refusals and errors, must
 *   carry `Cache-Control: no-store` so no CDN or browser keeps admin data.
 * What: `noStore` sets the header on any response; `crawlMonitorJson` builds a
 *   no-store JSON response.
 * Test: the no-store cases in `tests/unit/crawl-monitor-325.test.ts`.
 */

import { NextResponse } from "next/server";

export function noStore<T extends Response>(response: T): T {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export function crawlMonitorJson(body: unknown, status = 200): NextResponse {
  return noStore(NextResponse.json(body, { status }));
}
