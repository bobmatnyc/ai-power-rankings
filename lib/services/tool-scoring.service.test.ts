/**
 * Tests for Tool Scoring Service
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import { ToolScoringService, type ToolScoreFactors } from "./tool-scoring.service";

describe("ToolScoringService", () => {
  let service: ToolScoringService;

  beforeEach(() => {
    service = new ToolScoringService();
  });

  describe("calculateCurrentScore", () => {
    it("should correctly add baseline and delta scores", () => {
      const baseline: ToolScoreFactors = {
        marketTraction: 75,
        technicalCapability: 80,
        developerAdoption: 70,
        developmentVelocity: 65,
        platformResilience: 60,
        communitySentiment: 85,
        overallScore: 72.5,
      };

      const delta: ToolScoreFactors = {
        marketTraction: 5,
        technicalCapability: -10,
        developerAdoption: 15,
        developmentVelocity: 0,
        platformResilience: 8,
        communitySentiment: -5,
        overallScore: 2.5,
      };

      const current = service.calculateCurrentScore(baseline, delta);

      expect(current.marketTraction).toBe(80);
      expect(current.technicalCapability).toBe(70);
      expect(current.developerAdoption).toBe(85);
      expect(current.developmentVelocity).toBe(65);
      expect(current.platformResilience).toBe(68);
      expect(current.communitySentiment).toBe(80);
      expect(current.overallScore).toBe(75);
    });

    it("should handle missing factors in baseline", () => {
      const baseline: ToolScoreFactors = {
        marketTraction: 75,
        overallScore: 75,
      };

      const delta: ToolScoreFactors = {
        technicalCapability: 10,
        developerAdoption: 15,
        overallScore: 5,
      };

      const current = service.calculateCurrentScore(baseline, delta);

      expect(current.marketTraction).toBe(75);
      expect(current.technicalCapability).toBe(10);
      expect(current.developerAdoption).toBe(15);
      expect(current.developmentVelocity).toBe(0);
      expect(current.platformResilience).toBe(0);
      expect(current.communitySentiment).toBe(0);
      expect(current.overallScore).toBe(80);
    });

    it("should handle empty baseline and delta", () => {
      const baseline: ToolScoreFactors = {};
      const delta: ToolScoreFactors = {};

      const current = service.calculateCurrentScore(baseline, delta);

      expect(current.marketTraction).toBe(0);
      expect(current.technicalCapability).toBe(0);
      expect(current.developerAdoption).toBe(0);
      expect(current.developmentVelocity).toBe(0);
      expect(current.platformResilience).toBe(0);
      expect(current.communitySentiment).toBe(0);
      expect(current.overallScore).toBe(0);
    });

    it("should handle negative delta values correctly", () => {
      const baseline: ToolScoreFactors = {
        marketTraction: 50,
        technicalCapability: 60,
        overallScore: 55,
      };

      const delta: ToolScoreFactors = {
        marketTraction: -20,
        technicalCapability: -30,
        overallScore: -25,
      };

      const current = service.calculateCurrentScore(baseline, delta);

      expect(current.marketTraction).toBe(30);
      expect(current.technicalCapability).toBe(30);
      expect(current.overallScore).toBe(30);
    });

    it("should not modify input objects", () => {
      const baseline: ToolScoreFactors = {
        marketTraction: 75,
        overallScore: 75,
      };

      const delta: ToolScoreFactors = {
        marketTraction: 10,
        overallScore: 10,
      };

      const originalBaseline = { ...baseline };
      const originalDelta = { ...delta };

      service.calculateCurrentScore(baseline, delta);

      expect(baseline).toEqual(originalBaseline);
      expect(delta).toEqual(originalDelta);
    });
  });

  // Note: Database-dependent methods would require mocking or integration tests
  // These are unit tests for the pure logic functions
});