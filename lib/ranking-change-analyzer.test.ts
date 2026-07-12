/**
 * Unit coverage for RankingChangeAnalyzer.
 *
 * Why: This analyzer classifies month-over-month movement, attributes it to the
 * highest-impact factor, and produces the narrative shown in the UI. It was
 * untested. These specs pin the change categorisation bands, factor-impact
 * ordering (change * weight), reason selection, and the aggregate report.
 *
 * Test: Pure — no DB, no clock. Feeds RankingData + factor-score maps directly.
 */

import { describe, expect, it } from "vitest";
import {
  RankingChangeAnalyzer,
  type RankingData,
} from "./ranking-change-analyzer";

const analyzer = new RankingChangeAnalyzer();

function ranking(overrides: Partial<RankingData> & { tool_id: string; tool_name: string }): RankingData {
  return { ...overrides };
}

describe("RankingChangeAnalyzer", () => {
  describe("analyzeRankingChange", () => {
    it("classifies a first-time tool as a new entry", () => {
      const result = analyzer.analyzeRankingChange(
        ranking({ tool_id: "t1", tool_name: "Cursor", position: 3, score: 80 }),
        null,
        { developerAdoption: 70, innovation: 60 }
      );

      expect(result.changeCategory).toBe("new_entry");
      expect(result.previousRank).toBe(999); // sentinel for "not previously ranked"
      expect(result.currentRank).toBe(3);
      expect(result.primaryReason).toBe("New entry to rankings");
      expect(result.percentScoreChange).toBe(100); // previousScore 0 → 100%
      expect(result.narrativeExplanation).toContain("Cursor");
    });

    it("flags a >=5 rank gain as a major rise and attributes the top factor", () => {
      const result = analyzer.analyzeRankingChange(
        ranking({ tool_id: "t1", tool_name: "Cursor", position: 1, score: 90 }),
        ranking({ tool_id: "t1", tool_name: "Cursor", position: 10, score: 70 }),
        { developerAdoption: 85, marketTraction: 80 },
        { developerAdoption: 60, marketTraction: 78 }
      );

      expect(result.rankChange).toBe(9);
      expect(result.scoreChange).toBeCloseTo(20);
      expect(result.changeCategory).toBe("major_rise");
      // developerAdoption moved +25 (impact 25*0.125) vs marketTraction +2 → ordered first.
      expect(result.factorChanges[0]!.factor).toBe("developerAdoption");
      expect(result.primaryReason.toLowerCase()).toContain("developer adoption");
      expect(result.narrativeExplanation).toContain("surged");
    });

    it("flags a <=-5 rank loss as a major decline", () => {
      const result = analyzer.analyzeRankingChange(
        ranking({ tool_id: "t2", tool_name: "Legacy IDE", position: 15, score: 55 }),
        ranking({ tool_id: "t2", tool_name: "Legacy IDE", position: 5, score: 82 }),
        { marketTraction: 40 },
        { marketTraction: 70 }
      );

      expect(result.rankChange).toBe(-10);
      expect(result.changeCategory).toBe("major_decline");
      expect(result.narrativeExplanation).toContain("dropped");
    });

    it("treats a held position with a tiny score delta as stable", () => {
      const result = analyzer.analyzeRankingChange(
        ranking({ tool_id: "t3", tool_name: "Steady", position: 7, score: 75.05 }),
        ranking({ tool_id: "t3", tool_name: "Steady", position: 7, score: 75.0 }),
        { innovation: 60 },
        { innovation: 60 }
      );

      expect(result.rankChange).toBe(0);
      expect(result.changeCategory).toBe("stable");
      expect(result.narrativeExplanation).toContain("held steady");
    });

    it("orders factor changes by absolute weighted impact", () => {
      const result = analyzer.analyzeRankingChange(
        ranking({ tool_id: "t4", tool_name: "Tool", position: 2, score: 88 }),
        ranking({ tool_id: "t4", tool_name: "Tool", position: 3, score: 80 }),
        { agenticCapability: 90, developmentVelocity: 90 },
        { agenticCapability: 80, developmentVelocity: 80 }
      );

      // Both moved +10, but agenticCapability weight (0.3) >> velocity (0.05),
      // so agenticCapability must have the larger |impact| and sort first.
      expect(result.factorChanges[0]!.factor).toBe("agenticCapability");
      const impacts = result.factorChanges.map((fc) => Math.abs(fc.impact));
      for (let i = 0; i < impacts.length - 1; i++) {
        expect(impacts[i]!).toBeGreaterThanOrEqual(impacts[i + 1]!);
      }
    });

    it("reports minor adjustments when no factor moves significantly", () => {
      const result = analyzer.analyzeRankingChange(
        ranking({ tool_id: "t5", tool_name: "Flat", position: 4, score: 80.0 }),
        ranking({ tool_id: "t5", tool_name: "Flat", position: 4, score: 80.0 }),
        { innovation: 60.1 },
        { innovation: 60.0 }
      );

      expect(result.primaryReason).toBe("Minor adjustments across multiple factors");
      expect(result.secondaryReasons).toEqual([]);
    });
  });

  describe("generateChangeReport", () => {
    it("summarises movers and per-factor trends across analyses", () => {
      const rise = analyzer.analyzeRankingChange(
        ranking({ tool_id: "t1", tool_name: "Riser", position: 1, score: 92 }),
        ranking({ tool_id: "t1", tool_name: "Riser", position: 9, score: 70 }),
        { developerAdoption: 90 },
        { developerAdoption: 65 }
      );
      const decline = analyzer.analyzeRankingChange(
        ranking({ tool_id: "t2", tool_name: "Faller", position: 12, score: 50 }),
        ranking({ tool_id: "t2", tool_name: "Faller", position: 4, score: 78 }),
        { developerAdoption: 45 },
        { developerAdoption: 75 }
      );

      const report = analyzer.generateChangeReport([rise, decline]);

      expect(report.summary).toContain("2 tools analyzed");
      expect(report.majorMovers.rises).toHaveLength(1);
      expect(report.majorMovers.rises[0]!.toolName).toBe("Riser");
      expect(report.majorMovers.declines).toHaveLength(1);
      expect(report.majorMovers.declines[0]!.toolName).toBe("Faller");
      expect(report.factorTrends).toHaveProperty("developerAdoption");
      expect(report.factorTrends.developerAdoption!.improving).toBe(1);
      expect(report.factorTrends.developerAdoption!.declining).toBe(1);
      expect(report.narrativeSummary).toContain("Riser");
    });

    it("returns an empty-ish report for no analyses", () => {
      const report = analyzer.generateChangeReport([]);
      expect(report.summary).toContain("0 tools analyzed");
      expect(report.majorMovers.rises).toEqual([]);
      expect(report.majorMovers.declines).toEqual([]);
    });
  });
});
