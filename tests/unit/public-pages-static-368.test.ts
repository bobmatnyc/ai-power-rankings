import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * #368: the public pages are static or ISR, never request-time dynamic.
 *
 * Why: `force-dynamic`, a request API or a route with no static params made
 *   every public page a per-request render the edge could not cache.
 * What: reads each public page's source and checks it exports no `dynamic`
 *   setting, calls no `headers()`/`cookies()`/`auth()`, takes no
 *   `searchParams` prop, does no server-side `fetch(`, exports
 *   `generateStaticParams`, and keeps its revalidate window
 *   (null: static until the next deploy). `next build` showing these routes
 *   as ○/● is the end-to-end check.
 * Test: `npx vitest run tests/unit/public-pages-static-368.test.ts`.
 */

const APP = path.resolve(__dirname, "../../app/[lang]");

const PAGES: Array<[string, number | null]> = [
  ["page.tsx", 300],
  ["rankings/page.tsx", 300],
  ["rankings/[list]/page.tsx", 300],
  ["tools/page.tsx", 3600],
  ["tools/[slug]/page.tsx", 1800],
  ["news/page.tsx", 60],
  ["news/[slug]/page.tsx", 60],
  ["whats-new/page.tsx", 1800],
  ["whats-new/[period]/page.tsx", 1800],
  ["whats-new/weekly/[week]/page.tsx", 1800],
  ["about/page.tsx", null],
  ["methodology/page.tsx", null],
  ["privacy/page.tsx", null],
  ["terms/page.tsx", null],
  ["trending/page.tsx", null],
  ...[
    "best-ai-app-builders",
    "best-ai-code-editors",
    "best-ai-coding-tools",
    "best-autonomous-agents",
    "best-code-review-tools",
    "best-devops-assistants",
    "best-ide-assistants",
    "best-open-source-frameworks",
    "best-testing-tools",
  ].map((p): [string, number] => [`${p}/page.tsx`, 86400]),
];

describe("#368: public pages render statically", () => {
  it.each(PAGES)("%s is static or ISR", (file, revalidate) => {
    const src = readFileSync(path.join(APP, file), "utf8");
    expect(src).not.toMatch(/export const dynamic\b/);
    expect(src).not.toMatch(/\b(headers|cookies|auth)\(\)/);
    expect(src).not.toMatch(/searchParams/);
    expect(src).not.toMatch(/\bfetch\(/);
    expect(src).toMatch(/export (async )?function generateStaticParams/);
    const window = /export const revalidate = (\d+)/.exec(src)?.[1];
    expect(window === undefined ? null : Number(window)).toBe(revalidate);
  });
});
