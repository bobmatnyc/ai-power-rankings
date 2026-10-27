import { describe, expect, it } from "vitest";
import {
  AutomatedIngestionService,
  SEMANTIC_DUPLICATE_MIN_WORD_OVERLAP,
} from "./automated-ingestion.service";

/**
 * Regression tests for the daily-news semantic duplicate filter.
 *
 * Why: the 2026-10-27 run marked 13 of 18 candidates as semantic duplicates, all
 * within the batch. Titles that merely shared one "key entity" (claude, copilot,
 * github, agent, ...) scored 0.4 * wordJaccard + 0.6 * 1.0 >= 0.6, over the 0.35
 * threshold, so every Claude Code story collapsed into the first one, which then
 * failed quality. Distinct stories were never assessed.
 *
 * What: drives `filterSemanticDuplicates` with the 10-27 batch (titles rebuilt
 * from the candidate URL slugs; the stored titles were not kept), with true
 * duplicates (including the 10-23 Flint case against a stored article), and with
 * pairs on either side of the word-overlap floor.
 *
 * Test: `npx vitest run lib/services/automated-ingestion.semantic-dedup.test.ts`.
 */

type Candidate = { title: string; url: string };

/** Runs the real filter; returns the titles that survive, in order. */
async function survivors(
  titles: string[],
  stored: string[] = []
): Promise<string[]> {
  const service = new AutomatedIngestionService() as unknown as {
    filterSemanticDuplicates(
      articles: Candidate[],
      existing: { title: string }[]
    ): Promise<Candidate[]>;
  };
  const candidates = titles.map((title, i) => ({
    title,
    url: `https://example.com/${i}`,
  }));
  const kept = await service.filterSemanticDuplicates(
    candidates,
    stored.map((title) => ({ title }))
  );
  return kept.map((a) => a.title);
}

/** The 2026-10-27 candidates in freshness order (newest first), as the run saw them. */
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

describe("semantic duplicate filter: distinct stories about the same tool", () => {
  it("keeps every story in the 10-27 batch (13 of 18 were dropped before the fix)", async () => {
    const kept = await survivors(BATCH_10_27);
    expect(kept).toEqual(BATCH_10_27);
  });

  it.each([
    "Claude Code AI Finds a Cryptominer on a Mac, Says It Didn't Put It There",
    "Codex and Claude Code Hijack",
    "Claude Code's Enterprise 20 to 1",
    "This Claude Code Alternative Knows Your ESP32 Hardware",
    "Codex vs Claude Code: Stack Overflow 65.5% vs 29.5%",
    "GitHub Copilot vs Cursor: A 20% Gap Now Changes the Agent Choice",
  ])("does not drop %s behind an earlier Claude Code story", async (title) => {
    const kept = await survivors([BATCH_10_27[0] as string, title]);
    expect(kept).toContain(title);
  });

  it("lets a single shared generic entity pass when the words otherwise differ", async () => {
    const kept = await survivors([
      "Anthropic ships a new release",
      "Anthropic hires a new chief security officer",
    ]);
    expect(kept).toHaveLength(2);
  });
});

describe("semantic duplicate filter: true duplicates are still caught", () => {
  it("drops the same story from two outlets with near-identical titles", async () => {
    const kept = await survivors([
      "Anthropic Launches Claude Code on the Web",
      "Anthropic launches Claude Code on the web",
    ]);
    expect(kept).toEqual(["Anthropic Launches Claude Code on the Web"]);
  });

  it("drops a rephrased headline for the same story", async () => {
    const kept = await survivors([
      "Cursor Raises $2.3 Billion in New Funding Round",
      "Cursor raises $2.3B in funding round",
    ]);
    expect(kept).toHaveLength(1);
  });

  it("drops an exact re-post", async () => {
    const title = "OpenAI Unveils GPT-6.2 Codex for Developers";
    expect(await survivors([title, title])).toEqual([title]);
  });
});

describe("semantic duplicate filter: stored articles", () => {
  it("drops the 10-23 Flint story against its stored article", async () => {
    const kept = await survivors(
      ["Recursive Launches Flint, a Laptop Coding Model It Says Was Largely Built by AI"],
      ["Recursive launches Flint, a laptop coding model largely built by AI"]
    );
    expect(kept).toEqual([]);
  });

  it("keeps a candidate that only shares an entity with a stored article", async () => {
    const kept = await survivors(
      ["Claude Code's Enterprise 20 to 1"],
      ["Claude Code AI Finds a Cryptominer on a Mac, Says It Didn't Put It There"]
    );
    expect(kept).toHaveLength(1);
  });
});

describe("semantic duplicate filter: word-overlap floor boundary", () => {
  it("uses a floor of 0.5", () => {
    expect(SEMANTIC_DUPLICATE_MIN_WORD_OVERLAP).toBe(0.5);
  });

  // Normalized word sets: {claude, code, pricing} vs {claude, code, plans} -> 2/4 = 0.50.
  it("treats word Jaccard exactly at the floor as a duplicate", async () => {
    const kept = await survivors(["Claude Code Pricing", "Claude Code Plans"]);
    expect(kept).toEqual(["Claude Code Pricing"]);
  });

  // {claude, code, pricing} vs {claude, code, plans, changed} -> 2/5 = 0.40.
  it("treats word Jaccard just below the floor as distinct, despite a shared entity", async () => {
    const kept = await survivors(["Claude Code Pricing", "Claude Code Plans Changed"]);
    expect(kept).toHaveLength(2);
  });

  // 10-27 near-miss: "Install Claude Code in Australia" vs "How to Setup Claude Code in VS Code" -> 0.44.
  it("keeps the highest-overlap distinct pair seen on 10-27 (0.44 < floor)", async () => {
    const kept = await survivors([
      "Install Claude Code in Australia: Setup Guide 2026",
      "How to Setup Claude Code in VS Code: Complete Guide",
    ]);
    expect(kept).toHaveLength(2);
  });
});
