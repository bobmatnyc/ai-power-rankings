/**
 * Ambiguous tool names never appear bare in a discovery query (#476).
 *
 * Why: on 2026-11-25, 10 of 13 publisher candidates were off-topic (sports,
 * robotics, markets, gadget sites, relevance 0-6). Queries OR'd bare names
 * such as "Cursor", "Devin" and "Windsurf", which match far more than the tools.
 * What: Builds queries from a realistic catalogue and asserts: no ambiguous name
 * appears as a bare quoted term, every tool is covered within one rotation
 * cycle, output is deterministic per UTC day, and every query fits the provider
 * limits (400 characters, 50 words).
 * Test: `npx vitest run tests/unit/discovery-queries-precision-476.test.ts`.
 * Pure function; no network, no database.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("../../lib/db/connection", () => ({ getDb: () => null }));

import {
  AMBIGUOUS_TOOL_TERMS,
  FALLBACK_TOOL_NAMES,
  MAX_QUERY_CHARS,
  MAX_QUERY_WORDS,
  buildToolAnchoredQueries,
  isAmbiguousToolName,
  searchTermsFor,
} from "../../lib/services/discovery-queries";

// Display names from data/historical-metrics/2026-06.json (ChatGPT Canvas now
// merged into ChatGPT, #488), plus bare names a catalogue edit could add.
const CATALOGUE = [
  "Aider", "Amazon Q Developer", "Augment Code", "Bolt.new", "ChatGPT", "Claude Artifacts",
  "Claude Code", "Cline", "CodeRabbit", "Continue", "Cursor", "Devin", "Diffblue Cover",
  "GitHub Copilot", "Google Gemini Code Assist", "Google Jules", "JetBrains AI Assistant",
  "Kiro", "Lovable", "Microsoft IntelliCode", "OpenAI Codex CLI", "OpenHands", "Qodo Gen",
  "Replit Agent", "Snyk Code", "Sourcegraph Cody", "Sourcery", "Tabnine", "Windsurf", "Zed",
  "v0", "Codex", "Crush", "Tempo",
].sort();

const DAY_MS = 86_400_000;
const START = new Date("2026-11-25T06:00:00.000Z");

/** Quoted terms of a query, in order. */
function quotedTerms(query: string): string[] {
  return [...query.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

function cycle(names: readonly string[], days: number): string[] {
  const out: string[] = [];
  for (let d = 0; d < days; d++) out.push(...buildToolAnchoredQueries(names, new Date(START.getTime() + d * DAY_MS), 2));
  return out;
}

describe("discovery query precision (#476)", () => {
  it("classifies common-word names as ambiguous and coined or multi-word names as not", () => {
    for (const n of ["Cursor", "Devin", "Windsurf", "Zed", "Kiro", "Lovable", "Continue", "v0", "Crush"]) {
      expect(isAmbiguousToolName(n), n).toBe(true);
    }
    for (const n of ["Tabnine", "CodeRabbit", "OpenHands", "GitHub Copilot", "Claude Code", "Bolt.new", "Tool07"]) {
      expect(isAmbiguousToolName(n), n).toBe(false);
    }
  });

  it("never puts an ambiguous name bare in any query, and qualifies unknown ones", () => {
    const ambiguous = CATALOGUE.filter(isAmbiguousToolName).map((n) => n.toLowerCase());
    expect(ambiguous).toEqual(expect.arrayContaining(["cursor", "devin", "windsurf", "crush"]));
    for (const q of cycle(CATALOGUE, 10)) {
      for (const term of quotedTerms(q)) expect(ambiguous, `bare "${term}" in: ${q}`).not.toContain(term.toLowerCase());
    }
    expect(searchTermsFor("Cursor")).toEqual(["Cursor AI", "Cursor IDE", "Anysphere"]);
    expect(searchTermsFor("crush")).toEqual(["crush AI"]);
    expect(searchTermsFor("Tabnine")).toEqual(["Tabnine"]);
  });

  it("curated phrases are never themselves an ambiguous bare name", () => {
    for (const phrases of Object.values(AMBIGUOUS_TOOL_TERMS)) {
      for (const p of phrases) expect(isAmbiguousToolName(p), p).toBe(false);
    }
  });

  it("covers every catalogue tool within one rotation cycle", () => {
    // 34 names at 4 per query -> 9 groups -> 5 days at 2 queries/day.
    const terms = new Set(cycle(CATALOGUE, 5).flatMap(quotedTerms));
    for (const name of CATALOGUE) {
      expect(searchTermsFor(name).some((t) => terms.has(t)), name).toBe(true);
    }
  });

  it("is deterministic for a UTC day and changes across days", () => {
    const a = buildToolAnchoredQueries(CATALOGUE, new Date("2026-11-25T00:00:01.000Z"), 2);
    const b = buildToolAnchoredQueries(CATALOGUE, new Date("2026-11-25T23:59:59.000Z"), 2);
    const next = buildToolAnchoredQueries(CATALOGUE, new Date("2026-11-26T00:00:01.000Z"), 2);
    expect(a).toEqual(b);
    expect(a).toHaveLength(2);
    expect(next).not.toEqual(a);
  });

  it("keeps every query within 400 characters and 50 words, splitting long groups", () => {
    // 13 words each: four in one query would exceed 50 words.
    const wordy = Array.from({ length: 8 }, (_, i) => `A B C D E F G H I J K Wordy${String(i).padStart(2, "0")} Tool`);
    // ~100 characters each: four in one query would exceed 400 characters.
    const long = Array.from({ length: 12 }, (_, i) => `${"Enterprise".repeat(9)} Edition ${String(i).padStart(2, "0")}`);
    for (const names of [CATALOGUE, [...FALLBACK_TOOL_NAMES], wordy, long, ["Cursor", "Devin", "Windsurf", "Zed"]]) {
      for (const q of cycle(names, 10)) {
        expect(q.length, q).toBeLessThanOrEqual(MAX_QUERY_CHARS);
        expect(q.split(/\s+/).length, q).toBeLessThanOrEqual(MAX_QUERY_WORDS);
        expect(q.endsWith(" AI coding news")).toBe(true);
      }
    }
    // Both oversized catalogues split below 4 tools per query and drop no tool.
    for (const names of [wordy, long]) {
      const queries = cycle(names, 10);
      expect(Math.max(...queries.map((q) => quotedTerms(q).length))).toBeLessThan(4);
      const terms = new Set(queries.flatMap(quotedTerms));
      for (const n of names) expect(terms.has(n), n).toBe(true);
    }
  });
});
