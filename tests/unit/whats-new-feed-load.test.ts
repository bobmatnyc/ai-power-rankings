import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadList } from "../../lib/load-list";

/**
 * Regression tests for #152 — both `/api/whats-new` consumers tell a failed
 * read from an empty feed.
 *
 * Why: the recent-updates page and the What's New modal turned a 503 (or a
 * network error) into an empty list, so users saw "no updates" instead of an
 * error.
 * What: the page is a server component, so it is rendered to markup with a
 * stub global `fetch`. The modal reads in an effect and the repo has no DOM
 * test setup (no testing-library, no jsdom), so its read is driven through
 * `loadList` with a stub `fetch`, and its wiring — the error branch, with a
 * retry, before the empty state — is pinned on its source, as
 * `tests/unit/news-content-load.test.ts` does for the news page.
 * Test: `npx vitest run tests/unit/whats-new-feed-load.test.ts`. No network.
 */

// `server-only` throws outside the react-server export condition that Next.js
// resolves for server components; the page reads its dictionary through it.
vi.mock("server-only", () => ({}));

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function stubFetch(response: Response | Error) {
  return vi.fn(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
}

const EMPTY_STATE = "No Recent Updates";

async function renderRecentPage(response: Response | Error) {
  const fetchMock = stubFetch(response);
  vi.stubGlobal("fetch", fetchMock);
  const { default: RecentUpdatesPage } = await import(
    "../../app/[lang]/whats-new/recent/page"
  );
  const element = await RecentUpdatesPage({ params: Promise.resolve({ lang: "en" }) });
  return { html: renderToStaticMarkup(element), fetchMock };
}

describe("whats-new recent page (#152)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    ["a 503", json({ error: "News temporarily unavailable" }, 503)],
    ["a network error", new TypeError("fetch failed")],
  ])("renders the error state, not the empty state, on %s", async (_label, response) => {
    const { html } = await renderRecentPage(response);

    expect(html).toContain('role="alert"');
    expect(html).toContain("Try Again");
    expect(html).not.toContain(EMPTY_STATE);
  });

  it("renders the empty state for a successful empty feed, uncached", async () => {
    const { html, fetchMock } = await renderRecentPage(json({ feed: [] }));

    expect(html).toContain(EMPTY_STATE);
    expect(html).not.toContain('role="alert"');
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/api\/whats-new\?days=7$/), {
      cache: "no-store",
    });
  });
});

describe("What's New modal feed read (#152)", () => {
  it("reports a 503 as a failure, not as an empty feed", async () => {
    const result = await loadList("/api/whats-new?days=7", "feed", undefined, stubFetch(
      json({ error: "News temporarily unavailable" }, 503)
    ) as unknown as typeof fetch);

    expect(result.ok).toBe(false);
    expect(result).not.toHaveProperty("items");
  });

  it("reports a successful empty feed as success with no items", async () => {
    const result = await loadList("/api/whats-new?days=7", "feed", undefined, stubFetch(
      json({ feed: [] })
    ) as unknown as typeof fetch);

    expect(result).toEqual({ ok: true, items: [] });
  });

  it("renders the error card, with a retry, before the empty state on a 503", () => {
    const source = readFileSync(
      join(__dirname, "..", "..", "components/ui/whats-new-modal.tsx"),
      "utf8"
    );

    expect(source).toContain('loadList<UnifiedFeedItem>("/api/whats-new?days=7", "feed")');

    const errorBranch = source.indexOf("{feedFailed ? (");
    const retry = source.indexOf("{dict.common.tryAgain}");
    const empty = source.indexOf("No recent updates to show");
    expect(errorBranch).toBeGreaterThan(-1);
    expect(retry).toBeGreaterThan(errorBranch);
    expect(empty).toBeGreaterThan(retry);
  });
});
