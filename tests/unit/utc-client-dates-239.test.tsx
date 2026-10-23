// @vitest-environment jsdom
/**
 * #239: client-rendered calendar dates name the stored UTC day in every zone.
 *
 * Why: an article dated `2026-10-21T00:00:00Z` rendered "October 20, 2026" in a
 *   browser in America/Los_Angeles, while the server rendered "October 21, 2026",
 *   so React threw hydration error #418.
 * What: Switches the process zone (`process.env.TZ`, which Node applies to Date
 *   and Intl at once) between UTC and America/Los_Angeles, then renders the news
 *   detail header and a news card. A precondition checks the zone took effect.
 * Test: `npx vitest run tests/unit/utc-client-dates-239.test.tsx`.
 */
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import en from "../../i18n/dictionaries/en.json";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("../../components/ui/tool-icon", () => ({ ToolIcon: () => null }));
vi.mock("../../components/news/article-scoring-impact", () => ({ default: () => null }));

import { NewsCard, type NewsItem } from "../../components/news/news-card";
import NewsDetailContent from "../../components/news/news-detail-content";
import { formatUtcDate } from "../../lib/format-utc-date";

const ZONES = ["UTC", "America/Los_Angeles"] as const;
const MIDNIGHT_UTC = "2026-10-21T00:00:00Z";
const originalTz = process.env.TZ;

function setZone(tz: string) {
  process.env.TZ = tz;
  // Precondition: the zone took effect, else the test proves nothing.
  const localDay = new Date(MIDNIGHT_UTC).getDate();
  expect(localDay).toBe(tz === "UTC" ? 21 : 20);
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  if (originalTz === undefined) delete process.env.TZ;
  else process.env.TZ = originalTz;
});

const article = {
  id: "a1",
  slug: "s",
  title: "Title",
  content: "Body",
  published_date: MIDNIGHT_UTC,
  created_at: MIDNIGHT_UTC,
  updated_at: MIDNIGHT_UTC,
};

function detail() {
  return <NewsDetailContent article={article} tool={null} dict={en as never} lang="en" />;
}

function newsItem(event_date: string): NewsItem {
  return {
    id: "n1",
    tool_id: "t1",
    tool_name: "Tool",
    tool_category: "code-editor",
    event_date,
    event_type: "update",
    title: "Item",
    description: "Desc",
  };
}

describe("formatUtcDate", () => {
  it.each(ZONES)("prints the UTC calendar day in %s", (tz) => {
    setZone(tz);
    expect(formatUtcDate(MIDNIGHT_UTC, "en-US", { year: "numeric", month: "long", day: "numeric" })).toBe(
      "October 21, 2026"
    );
  });
});

describe("news detail header (/en/news/<slug>)", () => {
  it.each(ZONES)("shows October 21, 2026 in %s", (tz) => {
    setZone(tz);
    render(detail());
    expect(screen.getByText("October 21, 2026")).toBeTruthy();
  });

  it("client text in America/Los_Angeles equals the UTC server render", () => {
    setZone("UTC");
    const server = renderToString(detail());
    setZone("America/Los_Angeles");
    const client = renderToString(detail());
    expect(client).toBe(server);
  });
});

describe("news card date", () => {
  it.each(ZONES)("shows the stored UTC day for an older item in %s", (tz) => {
    setZone(tz);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-15T12:00:00Z"));
    render(<NewsCard item={newsItem(MIDNIGHT_UTC)} />);
    expect(screen.getByText("Oct 21")).toBeTruthy();
  });

  it.each(ZONES)("keeps the relative label under a week in %s", (tz) => {
    setZone(tz);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-23T12:00:00Z"));
    render(<NewsCard item={newsItem(MIDNIGHT_UTC)} />);
    expect(screen.getByText("2 days ago")).toBeTruthy();
  });

  it("shows the year when the UTC year differs, as of New Year's Day UTC", () => {
    // 2027-01-01T03:00Z is still 2026-12-31 in Los Angeles.
    setZone("America/Los_Angeles");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2027-01-01T03:00:00Z"));
    render(<NewsCard item={newsItem("2026-12-20T00:00:00Z")} />);
    expect(screen.getByText("Dec 20, 2026")).toBeTruthy();
  });
});
