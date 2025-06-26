
export interface FactorChange {
  factor: string;
  previousValue: number;
  currentValue: number;
  change: number;
  percentChange: number;
  impact: number; // How much this contributed to overall score change
}

export interface RankingChangeAnalysis {
  toolId: string;
  toolName: string;
  previousRank: number;
  currentRank: number;
  rankChange: number;
  previousScore: number;
  currentScore: number;
  scoreChange: number;
  percentScoreChange: number;
  primaryReason: string;
  secondaryReasons: string[];
  factorChanges: FactorChange[];
  narrativeExplanation: string;
  changeCategory: "major_rise" | "rise" | "stable" | "decline" | "major_decline" | "new_entry" | "dropped";
}

export class RankingChangeAnalyzer {
  private readonly FACTOR_NAMES: Record<string, string> = {
    agenticCapability: "Agentic Capability",
    innovation: "Innovation",
    technicalPerformance: "Technical Performance",
    developerAdoption: "Developer Adoption",
    marketTraction: "Market Traction",
    businessSentiment: "Business Sentiment",
    developmentVelocity: "Development Velocity",
    platformResilience: "Platform Resilience",
  };

  private readonly FACTOR_WEIGHTS: Record<string, number> = {
    agenticCapability: 0.3,
    innovation: 0.15,
    technicalPerformance: 0.125,
    developerAdoption: 0.125,
    marketTraction: 0.125,
    businessSentiment: 0.075,
    developmentVelocity: 0.05,
    platformResilience: 0.05,
  };

  analyzeRankingChange(
    currentRanking: any,
    previousRanking: any,
    currentFactorScores: Record<string, number>,
    previousFactorScores?: Record<string, number>
  ): RankingChangeAnalysis {
    const currentRank = currentRanking.position || currentRanking.new_position;
    const previousRank = previousRanking?.position || previousRanking?.current_position || 999;
    const currentScore = currentRanking.score || currentRanking.new_score;
    const previousScore = previousRanking?.score || previousRanking?.current_score || 0;

    const rankChange = previousRank - currentRank;
    const scoreChange = currentScore - previousScore;
    const percentScoreChange = previousScore > 0 ? (scoreChange / previousScore) * 100 : 100;

    // Determine change category
    const changeCategory = this.categorizeChange(rankChange, scoreChange, !previousRanking);

    // Analyze factor changes
    const factorChanges = this.analyzeFactorChanges(
      currentFactorScores,
      previousFactorScores || {}
    );

    // Identify primary and secondary reasons
    const { primaryReason, secondaryReasons } = this.identifyChangeReasons(
      factorChanges,
      changeCategory
    );

    // Generate narrative explanation
    const narrativeExplanation = this.generateNarrativeExplanation(
      currentRanking.tool_name || currentRanking.toolName,
      changeCategory,
      rankChange,
      scoreChange,
      factorChanges,
      primaryReason
    );

    return {
      toolId: currentRanking.tool_id || currentRanking.toolId,
      toolName: currentRanking.tool_name || currentRanking.toolName,
      previousRank,
      currentRank,
      rankChange,
      previousScore,
      currentScore,
      scoreChange,
      percentScoreChange,
      primaryReason,
      secondaryReasons,
      factorChanges,
      narrativeExplanation,
      changeCategory,
    };
  }

  private categorizeChange(
    rankChange: number,
    scoreChange: number,
    isNew: boolean
  ): RankingChangeAnalysis["changeCategory"] {
    if (isNew) {return "new_entry";}
    if (rankChange >= 5) {return "major_rise";}
    if (rankChange >= 1) {return "rise";}
    if (rankChange <= -5) {return "major_decline";}
    if (rankChange <= -1) {return "decline";}
    if (Math.abs(scoreChange) < 0.1) {return "stable";}
    return "stable";
  }

  private analyzeFactorChanges(
    currentScores: Record<string, number>,
    previousScores: Record<string, number>
  ): FactorChange[] {
    const changes: FactorChange[] = [];

    for (const [factor, weight] of Object.entries(this.FACTOR_WEIGHTS)) {
      const currentValue = currentScores[factor] || 0;
      const previousValue = previousScores[factor] || 0;
      const change = currentValue - previousValue;
      const percentChange = previousValue > 0 ? (change / previousValue) * 100 : 100;
      const impact = change * weight; // How much this factor contributed to overall score change

      changes.push({
        factor,
        previousValue,
        currentValue,
        change,
        percentChange,
        impact,
      });
    }

    // Sort by absolute impact
    return changes.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
  }

  private identifyChangeReasons(
    factorChanges: FactorChange[],
    changeCategory: RankingChangeAnalysis["changeCategory"]
  ): { primaryReason: string; secondaryReasons: string[] } {
    const significantChanges = factorChanges.filter(fc => Math.abs(fc.change) > 0.5);
    
    if (changeCategory === "new_entry") {
      return {
        primaryReason: "New entry to rankings",
        secondaryReasons: significantChanges
          .slice(0, 3)
          .map(fc => `Strong ${this.FACTOR_NAMES[fc.factor]} (${fc.currentValue.toFixed(1)}/10)`),
      };
    }

    if (significantChanges.length === 0) {
      return {
        primaryReason: "Minor adjustments across multiple factors",
        secondaryReasons: [],
      };
    }

    // Primary reason is the factor with highest impact
    const primaryFactor = significantChanges[0];
    if (!primaryFactor) {
      return {
        primaryReason: "Minor score adjustments",
        secondaryReasons: [],
      };
    }
    const primaryReason = this.generateFactorChangeReason(primaryFactor);

    // Secondary reasons are other significant changes
    const secondaryReasons = significantChanges
      .slice(1, 4)
      .map(fc => this.generateFactorChangeReason(fc));

    return { primaryReason, secondaryReasons };
  }

  private generateFactorChangeReason(factorChange: FactorChange): string {
    const factorName = this.FACTOR_NAMES[factorChange.factor];
    const direction = factorChange.change > 0 ? "improved" : "declined";
    const magnitude = Math.abs(factorChange.change) > 2 ? "significantly" : "";

    // Special handling for specific factors
    switch (factorChange.factor) {
      case "agenticCapability":
        if (factorChange.change > 0) {
          return `${magnitude} improved agentic capabilities (${factorChange.previousValue.toFixed(1)} → ${factorChange.currentValue.toFixed(1)})`;
        } else {
          return `${magnitude} weaker agentic performance (${factorChange.previousValue.toFixed(1)} → ${factorChange.currentValue.toFixed(1)})`;
        }

      case "innovation":
        if (factorChange.change < 0) {
          return `Innovation score decayed over time (${factorChange.previousValue.toFixed(1)} → ${factorChange.currentValue.toFixed(1)})`;
        } else {
          return `New innovations boosted score (${factorChange.previousValue.toFixed(1)} → ${factorChange.currentValue.toFixed(1)})`;
        }

      case "marketTraction":
        return `Market traction ${direction} ${magnitude} (${factorChange.previousValue.toFixed(1)} → ${factorChange.currentValue.toFixed(1)})`;

      case "developerAdoption":
        return `Developer adoption ${direction} ${magnitude} (${factorChange.previousValue.toFixed(1)} → ${factorChange.currentValue.toFixed(1)})`;

      case "technicalPerformance":
        return `Technical benchmarks ${direction} ${magnitude} (${factorChange.previousValue.toFixed(1)} → ${factorChange.currentValue.toFixed(1)})`;

      default:
        return `${factorName} ${direction} ${magnitude} (${factorChange.previousValue.toFixed(1)} → ${factorChange.currentValue.toFixed(1)})`;
    }
  }

  private generateNarrativeExplanation(
    toolName: string,
    changeCategory: RankingChangeAnalysis["changeCategory"],
    rankChange: number,
    scoreChange: number,
    factorChanges: FactorChange[],
    primaryReason: string
  ): string {
    const significantImprovements = factorChanges.filter(fc => fc.change > 1);
    const significantDeclines = factorChanges.filter(fc => fc.change < -1);
    const topImprovements = significantImprovements.slice(0, 3);
    const topDeclines = significantDeclines.slice(0, 3);

    switch (changeCategory) {
      case "major_rise":
        return `${toolName} surged ${Math.abs(rankChange)} positions due to ${primaryReason.toLowerCase()}. ${
          topImprovements.length > 1
            ? `Multiple factors contributed to this rise, including improvements in ${topImprovements
                .slice(0, 2)
                .map(fc => this.FACTOR_NAMES[fc.factor]?.toLowerCase() || fc.factor)
                .join(" and ")}.`
            : ""
        }`;

      case "rise":
        return `${toolName} climbed ${Math.abs(rankChange)} position${Math.abs(rankChange) > 1 ? "s" : ""} primarily due to ${primaryReason.toLowerCase()}.`;

      case "major_decline":
        return `${toolName} dropped ${Math.abs(rankChange)} positions. ${primaryReason}. ${
          topDeclines.length > 1
            ? `Additional factors include declining ${topDeclines
                .slice(1, 3)
                .map(fc => this.FACTOR_NAMES[fc.factor]?.toLowerCase() || fc.factor)
                .join(" and ")}.`
            : ""
        }`;

      case "decline":
        return `${toolName} fell ${Math.abs(rankChange)} position${Math.abs(rankChange) > 1 ? "s" : ""} due to ${primaryReason.toLowerCase()}.`;

      case "stable":
        if (Math.abs(scoreChange) > 0.1) {
          return `${toolName} maintained its position despite ${scoreChange > 0 ? "improvements" : "declines"} in ${primaryReason.toLowerCase()}.`;
        }
        return `${toolName} held steady with minimal changes across all ranking factors.`;

      case "new_entry":
        return `${toolName} enters the rankings with strong scores in ${topImprovements
          .map(fc => this.FACTOR_NAMES[fc.factor]?.toLowerCase() || fc.factor)
          .join(", ")}.`;

      default:
        return `${toolName} experienced changes due to ${primaryReason.toLowerCase()}.`;
    }
  }

  /**
   * Generate a summary report of all ranking changes
   */
  generateChangeReport(analyses: RankingChangeAnalysis[]): {
    summary: string;
    majorMovers: {
      rises: RankingChangeAnalysis[];
      declines: RankingChangeAnalysis[];
    };
    factorTrends: Record<string, { improving: number; declining: number }>;
    narrativeSummary: string;
  } {
    const majorRises = analyses
      .filter(a => a.changeCategory === "major_rise")
      .sort((a, b) => b.rankChange - a.rankChange);
    
    const majorDeclines = analyses
      .filter(a => a.changeCategory === "major_decline")
      .sort((a, b) => a.rankChange - b.rankChange);

    // Analyze factor trends
    const factorTrends: Record<string, { improving: number; declining: number }> = {};
    for (const factor of Object.keys(this.FACTOR_WEIGHTS)) {
      factorTrends[factor] = { improving: 0, declining: 0 };
    }

    for (const analysis of analyses) {
      for (const factorChange of analysis.factorChanges) {
        const trend = factorTrends[factorChange.factor];
        if (trend) {
          if (factorChange.change > 0.5) {
            trend.improving++;
          } else if (factorChange.change < -0.5) {
            trend.declining++;
          }
        }
      }
    }

    // Generate narrative summary
    const narrativeSummary = this.generateReportNarrative(
      analyses,
      majorRises,
      majorDeclines,
      factorTrends
    );

    return {
      summary: `${analyses.length} tools analyzed. ${majorRises.length} major rises, ${majorDeclines.length} major declines.`,
      majorMovers: {
        rises: majorRises.slice(0, 5),
        declines: majorDeclines.slice(0, 5),
      },
      factorTrends,
      narrativeSummary,
    };
  }

  private generateReportNarrative(
    analyses: RankingChangeAnalysis[],
    majorRises: RankingChangeAnalysis[],
    majorDeclines: RankingChangeAnalysis[],
    factorTrends: Record<string, { improving: number; declining: number }>
  ): string {
    const newEntries = analyses.filter(a => a.changeCategory === "new_entry");
    
    let narrative = `This month's rankings show significant movement across the AI coding tools landscape. `;

    if (majorRises.length > 0 && majorRises[0]) {
      narrative += `${majorRises[0].toolName} led the gains, climbing ${majorRises[0].rankChange} positions. `;
    }

    if (majorDeclines.length > 0 && majorDeclines[0]) {
      narrative += `On the other side, ${majorDeclines[0].toolName} experienced the largest drop, falling ${Math.abs(majorDeclines[0].rankChange)} positions. `;
    }

    // Identify trending factors
    const trendingFactors = Object.entries(factorTrends)
      .map(([factor, trend]) => ({
        factor,
        netTrend: trend.improving - trend.declining,
      }))
      .sort((a, b) => Math.abs(b.netTrend) - Math.abs(a.netTrend));

    const topTrend = trendingFactors[0];
    if (topTrend && topTrend.netTrend > 5) {
      const factorName = this.FACTOR_NAMES[topTrend.factor] || topTrend.factor;
      const improving = factorTrends[topTrend.factor]?.improving || 0;
      narrative += `${factorName} emerged as a key differentiator this month, with ${improving} tools showing improvement. `;
    }

    if (newEntries.length > 0) {
      narrative += `${newEntries.length} new tool${newEntries.length > 1 ? "s" : ""} entered the rankings, including ${newEntries
        .slice(0, 2)
        .map(e => e.toolName)
        .join(" and ")}. `;
    }

    return narrative;
  }
}