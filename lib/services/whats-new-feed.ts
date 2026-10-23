/**
 * What's New feed composition (#231)
 *
 * Why: The feed kept the 20 newest items across news, tools and platform
 * changes. News arrives daily, so platform changes never reached the feed
 * (#231). The supervising ruling reserves 3 of the 20 slots for platform items.
 * What: `composeFeed` gives platform items exactly `reserved` slots (the
 * newest ones) and fills the remaining slots with the newest news and tool
 * items, newest first. Unused platform slots go to other items. Platform items
 * never take more than `reserved` slots: CHANGELOG.md gains many lines a day
 * and would otherwise crowd out the news.
 * Test: `tests/unit/whats-new-feed-231.test.ts`.
 */

import type { ChangelogEntry } from "@/lib/data/changelog-generator";

/** Total feed length. */
export const FEED_LIMIT = 20;
/** Slots held for platform items out of `FEED_LIMIT` (#231 ruling). */
export const PLATFORM_SLOTS = 3;

interface Dated {
  type: string;
  date: string;
}

const newestFirst = (a: Dated, b: Dated) => Date.parse(b.date) - Date.parse(a.date);

export function composeFeed<T extends Dated>(
  items: readonly T[],
  limit: number = FEED_LIMIT,
  reserved: number = PLATFORM_SLOTS
): T[] {
  const sorted = [...items].sort(newestFirst);
  const held = sorted.filter((item) => item.type === "platform").slice(0, reserved);
  const rest = sorted.filter((item) => item.type !== "platform").slice(0, Math.max(0, limit - held.length));
  return [...held, ...rest].sort(newestFirst);
}

/** A feed item for one platform change. */
export function platformFeedItem(entry: ChangelogEntry) {
  return {
    type: "platform" as const,
    date: entry.date,
    id: entry.id,
    title: entry.title,
    description: entry.description,
    category: entry.scope ?? "Platform",
    changeType: entry.changeType,
    version: entry.version,
  };
}
