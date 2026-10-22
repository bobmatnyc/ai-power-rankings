/**
 * #175: lib/analytics/track.ts — no-op and safety contract, plus the
 * PII-reducing parameter helpers. Runs in the Node environment, where
 * `window` is absent unless a test installs one.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  linkDomain,
  pageTypeFromPath,
  queryLengthBucket,
  trackEvent,
} from "../../lib/analytics/track";

const g = globalThis as unknown as { window?: unknown };

function installWindow(gtag: unknown): void {
  g.window = { gtag };
}

afterEach(() => {
  delete g.window;
});

const params = { percent_scrolled: 75 as const, page_type: "home" as const };

describe("trackEvent", () => {
  it("is a no-op on the server (no window)", () => {
    expect(typeof window).toBe("undefined");
    expect(() => trackEvent("scroll_depth", params)).not.toThrow();
  });

  it("is a no-op when gtag is absent or not a function", () => {
    installWindow(undefined);
    expect(() => trackEvent("scroll_depth", params)).not.toThrow();
    installWindow("not-a-function");
    expect(() => trackEvent("scroll_depth", params)).not.toThrow();
  });

  it("forwards the event name and params to gtag", () => {
    const gtag = vi.fn();
    installWindow(gtag);
    trackEvent("ranking_row_click", {
      tool_slug: "cursor",
      rank: 1,
      list_name: "rankings",
      tool_category: "code-editor",
    });
    expect(gtag).toHaveBeenCalledWith("event", "ranking_row_click", {
      tool_slug: "cursor",
      rank: 1,
      list_name: "rankings",
      tool_category: "code-editor",
    });
  });

  it("never throws when gtag throws", () => {
    installWindow(() => {
      throw new Error("blocked by extension");
    });
    expect(() => trackEvent("scroll_depth", params)).not.toThrow();
  });

  it("drops non-primitive values and truncates strings to 100 characters", () => {
    const gtag = vi.fn();
    installWindow(gtag);
    // Casts simulate a caller bypassing the types at runtime.
    trackEvent("filter_use", {
      filter_name: "category",
      filter_value: "x".repeat(150),
      page_type: "tools",
      extra: { email: "a@b.c" },
      nan: Number.NaN,
    } as never);
    expect(gtag).toHaveBeenCalledWith("event", "filter_use", {
      filter_name: "category",
      filter_value: "x".repeat(100),
      page_type: "tools",
    });
  });
});

describe("linkDomain", () => {
  it.each([
    ["https://www.cursor.com/pricing?utm_source=apr&ref=abc#plans", "cursor.com"],
    ["http://github.com/org/repo", "github.com"],
    ["mailto:sales@example.com", null],
    ["not a url", null],
    [undefined, null],
  ])("%s -> %s", (input, expected) => {
    expect(linkDomain(input)).toBe(expected);
  });
});

describe("queryLengthBucket", () => {
  it.each([
    [1, "1-3"],
    [3, "1-3"],
    [4, "4-10"],
    [10, "4-10"],
    [11, "11-30"],
    [30, "11-30"],
    [31, "31+"],
  ])("%i -> %s", (length, expected) => {
    expect(queryLengthBucket(length)).toBe(expected);
  });
});

describe("pageTypeFromPath", () => {
  it.each([
    ["/en", "home"],
    ["/", "home"],
    ["/en/rankings", "rankings"],
    ["/ja/tools", "tools"],
    ["/en/tools/cursor", "tool_detail"],
    ["/en/news/some-article", "news_article"],
    ["/en/best-ai-code-editors", "best_of"],
    ["/en/whats-new", "whats_new"],
    ["/en/admin/news", "other"],
    [null, "home"],
  ])("%s -> %s", (path, expected) => {
    expect(pageTypeFromPath(path)).toBe(expected);
  });
});
