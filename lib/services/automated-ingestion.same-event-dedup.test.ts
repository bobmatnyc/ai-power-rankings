import { describe, expect, it } from "vitest";
import { AutomatedIngestionService } from "./automated-ingestion.service";
import { SAME_EVENT_WINDOW_DAYS, isSameEvent } from "./same-event-dedup";

/**
 * Regression tests for same-event dedup in daily-news ingestion (#366).
 *
 * Why: five outlets reported one event (a malicious Claude Code-branded
 * extension on Cursor's marketplace, 2026-10-29/30) and all five were stored,
 * because their headlines sit below the #319 word-overlap floor. #319 must
 * still hold: distinct stories about the same tool stay separate.
 *
 * What: drives the real `filterSemanticDuplicates` with the five stored
 * headlines (taken from the public /api/news feed), with the #319 2026-10-27
 * batch and the 10-30 feed placed on one date, and checks `isSameEvent`'s
 * date-window and missing-date rules.
 *
 * Test: `npx vitest run lib/services/automated-ingestion.same-event-dedup.test.ts`.
 */

type Candidate = { title: string; url: string; publishedDate: string | null };
type Stored = { title: string; publishedDate: string | null };

/** Runs the real filter on dated candidates; returns the surviving titles in order. */
async function survivors(candidates: Array<[string, string | null]>, stored: Stored[] = []) {
  const service = new AutomatedIngestionService() as unknown as {
    filterSemanticDuplicates(articles: Candidate[], existing: Stored[]): Promise<Candidate[]>;
  };
  const kept = await service.filterSemanticDuplicates(
    candidates.map(([title, publishedDate], i) => ({
      title,
      publishedDate,
      url: `https://outlet-${i}.example.com/story`,
    })),
    stored
  );
  return kept.map((a) => a.title);
}

const OCT_29 = "2026-10-29T12:00:00Z";
const OCT_30 = "2026-10-30T09:00:00Z";

/** The #366 cluster: one event, five outlets, as stored (public /api/news, 2026-10-30). */
const CURSOR_EXTENSION_EVENT: Array<[string, string]> = [
  ["Hijacked Claude Code Extension on Cursor Marketplace Planted Persistent Backdoor", OCT_29],
  ["Anthropic VS Code Extension on Cursor Backdoored for Nearly 12 Hours", OCT_29],
  ["Inside the Malicious Claude Code-Branded Cursor Extension and Its Persistent SSH Backdoor", OCT_30],
  ["Malicious Claude Code Extension in Cursor's Marketplace Attempted Remote Access and Data Theft", OCT_30],
];

/**
 * The fifth #366 headline shares one event term ("extension") with the others.
 * The rule needs two, so it stays a separate entry: an accepted false negative.
 */
const ONE_TERM_HEADLINE = "Anthropic: That Claude Code extension compromise… couldn't be us";

/** Distinct stories from the same 10-30 feed, many about Claude Code, Cursor or Copilot. */
const DISTINCT_10_30 = [
  "Unauthorized AI Relay Service Installs Codex and Claude Code CLIs While Disabling Sandboxes",
  "I installed 3 Claude Code mods, and now the default version feels unfinished",
  "Jellyfish: Claude Code Bills Hit $252 a Month per Developer as Software Factories Automate Code Production Among Early Adopters",
  "GitHub Copilot supports server-to-server authentication",
  "Anthropic Makes Code Review for Claude Code Generally Available",
  "Grok, Cursor And X Premium Now Come In One Subscription: What Users Need To Know",
  "GitHub Copilot Customization Guide: Teaching AI About Your Codebase",
  "Claude Code vs Codex vs Copilot: 65.5% Dev Share [2026]",
  "JetBrains Mellum 2.1 Debuts: SWE-Bench Jumps to 47%",
  "Pi 1.0 Debuts: Open Coding Agent Cuts Tokens 40% [2026]",
  "AI Developer Creates Open Source Adobe Alternatives Using Claude Opus 5.5",
];

/** The #319 2026-10-27 batch (see automated-ingestion.semantic-dedup.test.ts). */
const BATCH_10_27 = [
  "Install Claude Code in Australia: Setup Guide 2026",
  "I Built a Claude Code Toolkit That Checks Copy Traders Before You Copy Them",
  "I Tried Claude Code Mods, and Now Waiting for It to Finish Is Actually Fun",
  "GPT-6.1 Terra is now available in GitHub Copilot",
  "Codex and Claude Code Hijack",
  "This Claude Code Alternative Knows Your ESP32 Hardware",
  "Codex vs Claude Code: Stack Overflow 65.5% vs 29.5%",
  "GitHub Copilot vs Cursor: A 20% Gap Now Changes the Agent Choice",
  "Claude Code's Enterprise 20 to 1",
  "Claude Code AI Finds a Cryptominer on a Mac, Says It Didn't Put It There",
  "Cursor Origin: GitHub Outage Launch",
  "How to Setup Claude Code in VS Code: Complete Guide",
  "GitHub Copilot models deprecated on October 19, 2026",
  "Connect Joplin to Claude Code for a Productivity Boost",
  "GitHub Copilot Pricing, AI Credits, Claude and Codex Agents",
  "GitHub Copilot Retires 6 Models Including GPT-5.6",
  "Cognition: What Is the Devin AI Coding Agent",
  "Delegate Shared Business Processes to Agents with Microsoft Copilot Studio",
];

const [FIRST_REPORT] = CURSOR_EXTENSION_EVENT[0] as [string, string];

describe("same-event dedup: one event from several sources (#366)", () => {
  it("collapses the same event from two sources into one entry", async () => {
    const kept = await survivors(CURSOR_EXTENSION_EVENT.slice(0, 2));
    expect(kept).toEqual([FIRST_REPORT]);
  });

  it("collapses the four multi-term #366 headlines into the first one", async () => {
    expect(await survivors(CURSOR_EXTENSION_EVENT)).toEqual([FIRST_REPORT]);
  });

  it("drops a later report of an event already stored", async () => {
    const kept = await survivors(CURSOR_EXTENSION_EVENT.slice(1), [
      { title: FIRST_REPORT, publishedDate: OCT_29 },
    ]);
    expect(kept).toEqual([]);
  });

  it("keeps a headline that shares only one event term (accepted false negative)", async () => {
    const kept = await survivors([...CURSOR_EXTENSION_EVENT, [ONE_TERM_HEADLINE, OCT_30]]);
    expect(kept).toEqual([FIRST_REPORT, ONE_TERM_HEADLINE]);
  });
});

describe("same-event dedup: distinct stories about the same tool stay separate (#319)", () => {
  it("keeps two distinct Claude Code stories published the same day", async () => {
    const kept = await survivors([
      ["Anthropic Makes Code Review for Claude Code Generally Available", OCT_30],
      ["I installed 3 Claude Code mods, and now the default version feels unfinished", OCT_30],
    ]);
    expect(kept).toHaveLength(2);
  });

  it("keeps every 10-27 story when all carry the same publish date", async () => {
    const kept = await survivors(BATCH_10_27.map((t): [string, string] => [t, OCT_29]));
    expect(kept).toEqual(BATCH_10_27);
  });

  it("keeps every distinct 10-30 story next to the #366 cluster", async () => {
    const feed: Array<[string, string]> = [
      ...CURSOR_EXTENSION_EVENT,
      ...DISTINCT_10_30.map((t): [string, string] => [t, OCT_30]),
    ];
    expect(await survivors(feed)).toEqual([FIRST_REPORT, ...DISTINCT_10_30]);
  });

  it("keeps a new candidate that only shares a tool with a stored story", async () => {
    const kept = await survivors(
      [["Anthropic Makes Code Review for Claude Code Generally Available", OCT_30]],
      [{ title: FIRST_REPORT, publishedDate: OCT_29 }]
    );
    expect(kept).toHaveLength(1);
  });
});

describe("isSameEvent: date rules", () => {
  const [a, b] = CURSOR_EXTENSION_EVENT.map(([title]) => title) as [string, string];

  it("matches within the window, in either order", () => {
    expect(isSameEvent({ title: a, publishedDate: OCT_29 }, { title: b, publishedDate: OCT_30 })).toBe(true);
    expect(isSameEvent({ title: b, publishedDate: OCT_30 }, { title: a, publishedDate: OCT_29 })).toBe(true);
  });

  it("does not match outside the window", () => {
    const later = new Date(Date.parse(OCT_29) + (SAME_EVENT_WINDOW_DAYS + 1) * 86_400_000);
    expect(isSameEvent({ title: a, publishedDate: OCT_29 }, { title: b, publishedDate: later })).toBe(false);
  });

  it.each([null, "", "not a date", undefined])(
    "keeps both when a publish date is %s",
    (missing) => {
      expect(isSameEvent({ title: a, publishedDate: missing }, { title: b, publishedDate: OCT_29 })).toBe(false);
    }
  );
});
