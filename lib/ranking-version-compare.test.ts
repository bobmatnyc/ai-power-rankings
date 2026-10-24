/**
 * Table-building coverage for the read-only v7.9 → v7.10 compare (#101).
 * Fixture-driven; no database.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildComparisonTable,
  connectionStringLiterals,
  formatComparisonTable,
  redactSecrets,
} from "./ranking-version-compare";
import { computeRankings, type RankingSourceTool } from "./services/ranking-generation.service";

const ROOT = join(__dirname, "..");
const DATE = new Date("2026-10-01T00:00:00Z");
const TOOLS = JSON.parse(
  readFileSync(join(ROOT, "tests", "fixtures", "ranking-compare-101.json"), "utf8")
) as RankingSourceTool[];

describe("buildComparisonTable", () => {
  const rows = buildComparisonTable(TOOLS, DATE);

  it("lists every tool once", () => {
    expect(rows.map((r) => r.slug).sort()).toEqual(TOOLS.map((t) => t.slug).sort());
  });

  it("orders movers first, then by absolute rank delta, then by new rank", () => {
    const firstStill = rows.findIndex((r) => r.rankDelta === 0);
    expect(firstStill).toBeGreaterThan(0);
    expect(rows.slice(firstStill).every((r) => r.rankDelta === 0)).toBe(true);
    for (let i = 1; i < firstStill; i++) {
      const prev = rows[i - 1]!;
      const cur = rows[i]!;
      const prevKey = [-Math.abs(prev.rankDelta), prev.newRank];
      const curKey = [-Math.abs(cur.rankDelta), cur.newRank];
      expect(prevKey[0]! < curKey[0]! || (prevKey[0] === curKey[0] && prevKey[1]! < curKey[1]!)).toBe(true);
    }
  });

  it("new columns match what the publish path (computeRankings) would produce", () => {
    const published = computeRankings(TOOLS, new Map(), DATE);
    for (const entry of published) {
      const row = rows.find((r) => r.slug === entry.tool_slug)!;
      expect(row.newRank).toBe(entry.rank);
      expect(row.newScore).toBe(entry.score);
    }
  });

  it("old columns use the v7.9 logic: flat tools keep their score, nested technical data gains", () => {
    const bySlug = new Map(rows.map((r) => [r.slug, r]));
    expect(bySlug.get("flat-rich")!.scoreDelta).toBe(0);
    expect(bySlug.get("nested-empty")!.scoreDelta).toBe(0);
    expect(bySlug.get("nested-tech")!.scoreDelta).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.rankDelta).toBe(r.oldRank - r.newRank);
    }
  });
});

// #101: an empty table would clear a release without comparing anything.
describe("buildComparisonTable on an empty source", () => {
  it("throws instead of returning an empty table", () => {
    expect(() => buildComparisonTable([], DATE)).toThrow(/0 tools/);
  });
});

describe("formatComparisonTable", () => {
  it("prints a header, one row per tool and a summary", () => {
    const text = formatComparisonTable(buildComparisonTable(TOOLS, DATE));
    const lines = text.split("\n");
    expect(lines[0]).toBe(
      "| Tool | Old rank (v7.9) | New rank (v7.10) | Delta | Old score | New score | Score delta |"
    );
    expect(lines.filter((l) => l.startsWith("| ") && !l.startsWith("| Tool"))).toHaveLength(TOOLS.length);
    expect(lines.at(-1)).toMatch(new RegExp(`^${TOOLS.length} tools, \\d+ change rank\\.$`));
  });
});

describe("read-only guarantees", () => {
  it("redacts connection strings and credential-like pairs", () => {
    const out = redactSecrets("connect failed for postgresql://u:p@db.example/x?sslmode=require (password=hunter2)");
    expect(out).not.toMatch(/postgresql:|hunter2|db\.example/);
  });

  it("redacts the connection string's host, user and password given without a scheme", () => {
    const url = "postgresql://reader:s3cr3tpass@db-host.internal.example/app?sslmode=require";
    const out = redactSecrets(
      "getaddrinfo ENOTFOUND db-host.internal.example for reader (s3cr3tpass)",
      connectionStringLiterals(url)
    );
    expect(out).not.toMatch(/db-host|reader|s3cr3tpass/);
    expect(connectionStringLiterals(undefined)).toEqual([]);
    expect(connectionStringLiterals("not a url")).toEqual(["not a url"]);
  });

  // #101: a driver error can echo the password still URL-encoded.
  it("redacts the URL-encoded password on its own", () => {
    const url = "postgresql://reader:p%40ss%2Fw0rd@db.example.test/app";
    const out = redactSecrets("auth failed for p%40ss%2Fw0rd and p@ss/w0rd", connectionStringLiterals(url));
    expect(out).not.toMatch(/p%40ss%2Fw0rd|p@ss\/w0rd/);
  });

  it("the script calls no write path", () => {
    const source = readFileSync(join(ROOT, "scripts", "compare-ranking-versions.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    // #101: the database read goes through the READ ONLY transaction loader.
    expect(source).toContain("loadActiveToolsReadOnly(");
    expect(source).not.toMatch(/getDb|createDbPersistence|lib\/db\/connection/);
    expect(source).not.toMatch(
      /saveSnapshot|regenerateRankings|\.insert\(|\.update\(|\.delete\(|writeFile|appendFile|cache/i
    );
  });
});
