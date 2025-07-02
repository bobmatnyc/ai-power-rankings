import type { MetricImpact } from "@/components/news/metric-impact-display";

interface AnalysisResult {
  impacts: MetricImpact[];
  extractedMetrics: ExtractedMetric[];
}

interface ExtractedMetric {
  type: string;
  value: string;
  context: string;
}

export class NewsMetricAnalyzer {
  /**
   * Analyze news content to determine impact on ranking factors
   */
  analyzeArticle(content: string, title: string, toolName?: string): AnalysisResult {
    const extractedMetrics = this.extractMetrics(content);
    const impacts = this.calculateImpacts(content, title, extractedMetrics);

    return { impacts, extractedMetrics };
  }

  private extractMetrics(content: string): ExtractedMetric[] {
    const metrics: ExtractedMetric[] = [];
    const text = content.toLowerCase();

    // Funding/Investment metrics
    const fundingMatches = content.matchAll(
      /\$(\d+\.?\d*)\s*(million|billion|M|B)\s*(funding|investment|raised|round|valuation)/gi
    );
    for (const match of fundingMatches) {
      metrics.push({
        type: "funding",
        value: match[0],
        context: this.getContext(content, match.index || 0),
      });
    }

    // User/Customer metrics
    const userMatches = content.matchAll(
      /(\d+\.?\d*)\s*(million|thousand|K|M)?\s*(users|customers|developers|downloads|installs)/gi
    );
    for (const match of userMatches) {
      metrics.push({
        type: "users",
        value: match[0],
        context: this.getContext(content, match.index || 0),
      });
    }

    // Technical metrics (SWE-bench, benchmarks)
    const benchmarkMatches = content.matchAll(
      /(\d+\.?\d*)%?\s*(on\s+)?(SWE-bench|HumanEval|benchmark|accuracy|performance)/gi
    );
    for (const match of benchmarkMatches) {
      metrics.push({
        type: "benchmark",
        value: match[0],
        context: this.getContext(content, match.index || 0),
      });
    }

    // Context window and token limits
    const contextMatches = content.matchAll(/(\d+[,.]?\d*[KM]?)\s*(tokens?|context)/gi);
    for (const match of contextMatches) {
      const value = match[1];
      const numValue = this.parseTokenValue(value);
      if (numValue > 1000) {
        metrics.push({
          type: "context_window",
          value: match[0],
          context: this.getContext(content, match.index || 0),
        });
      }
    }

    // GitHub metrics
    const githubMatches = content.matchAll(/(\d+[,.]?\d*[KM]?)\s*(stars|forks|contributors)/gi);
    for (const match of githubMatches) {
      metrics.push({
        type: "github",
        value: match[0],
        context: this.getContext(content, match.index || 0),
      });
    }

    // Release/Update frequency
    const releaseMatches = content.matchAll(
      /(daily|weekly|monthly|quarterly)\s*(releases?|updates?|deployments?)/gi
    );
    for (const match of releaseMatches) {
      metrics.push({
        type: "release_frequency",
        value: match[0],
        context: this.getContext(content, match.index || 0),
      });
    }

    return metrics;
  }

  private calculateImpacts(
    content: string,
    title: string,
    metrics: ExtractedMetric[]
  ): MetricImpact[] {
    const impacts: MetricImpact[] = [];
    const lowerContent = content.toLowerCase();
    const lowerTitle = title.toLowerCase();

    // Market Traction Analysis
    const fundingMetrics = metrics.filter((m) => m.type === "funding");
    if (fundingMetrics.length > 0) {
      const isSignificant = fundingMetrics.some(
        (m) =>
          m.value.includes("billion") ||
          (m.value.includes("million") && parseInt(m.value.match(/\d+/)?.[0] || "0") >= 50)
      );
      impacts.push({
        factor: "marketTraction",
        impact: "positive",
        magnitude: isSignificant ? "high" : "medium",
        value: fundingMetrics[0].value,
        description: "New funding or valuation milestone demonstrates strong investor confidence",
        evidence: fundingMetrics.map((m) => m.context),
      });
    }

    // Technical Capability Analysis
    const benchmarkMetrics = metrics.filter((m) => m.type === "benchmark");
    const contextMetrics = metrics.filter((m) => m.type === "context_window");

    if (benchmarkMetrics.length > 0) {
      const bestScore = benchmarkMetrics
        .map((m) => parseFloat(m.value.match(/\d+\.?\d*/)?.[0] || "0"))
        .reduce((max, val) => Math.max(max, val), 0);

      impacts.push({
        factor: "technicalCapability",
        impact: bestScore > 20 ? "positive" : "neutral",
        magnitude: bestScore > 50 ? "high" : bestScore > 20 ? "medium" : "low",
        value: `${bestScore}%`,
        description: "Benchmark performance indicates technical advancement",
        evidence: benchmarkMetrics.map((m) => m.context),
      });
    }

    if (contextMetrics.length > 0) {
      impacts.push({
        factor: "technicalCapability",
        impact: "positive",
        magnitude: "medium",
        value: contextMetrics[0].value,
        description: "Expanded context window enhances capability for complex tasks",
        evidence: contextMetrics.map((m) => m.context),
      });
    }

    // Developer Adoption Analysis
    const userMetrics = metrics.filter((m) => m.type === "users");
    const githubMetrics = metrics.filter((m) => m.type === "github");

    if (userMetrics.length > 0) {
      const hasMillions = userMetrics.some((m) => m.value.includes("million"));
      impacts.push({
        factor: "developerAdoption",
        impact: "positive",
        magnitude: hasMillions ? "high" : "medium",
        value: userMetrics[0].value,
        description: "Growing user base indicates strong developer adoption",
        evidence: userMetrics.map((m) => m.context),
      });
    }

    if (githubMetrics.length > 0) {
      impacts.push({
        factor: "developerAdoption",
        impact: "positive",
        magnitude: "medium",
        value: githubMetrics[0].value,
        description: "GitHub activity shows developer engagement",
        evidence: githubMetrics.map((m) => m.context),
      });
    }

    // Development Velocity Analysis
    const releaseMetrics = metrics.filter((m) => m.type === "release_frequency");
    const hasNewFeatures =
      lowerContent.includes("new feature") ||
      lowerContent.includes("introduces") ||
      lowerContent.includes("launches");

    if (releaseMetrics.length > 0 || hasNewFeatures) {
      impacts.push({
        factor: "developmentVelocity",
        impact: "positive",
        magnitude: releaseMetrics.some(
          (m) => m.value.includes("daily") || m.value.includes("weekly")
        )
          ? "high"
          : "medium",
        value: releaseMetrics[0]?.value,
        description: "Active development and feature releases",
        evidence: releaseMetrics.map((m) => m.context),
      });
    }

    // Platform Resilience Analysis
    const hasMultiProvider =
      lowerContent.includes("multi-model") ||
      lowerContent.includes("multiple providers") ||
      lowerContent.includes("provider agnostic");
    const hasOpenSource =
      lowerContent.includes("open source") || lowerContent.includes("open-source");

    if (hasMultiProvider || hasOpenSource) {
      impacts.push({
        factor: "platformResilience",
        impact: "positive",
        magnitude: hasMultiProvider && hasOpenSource ? "high" : "medium",
        description: hasMultiProvider
          ? "Multi-provider support increases platform resilience"
          : "Open source nature enhances platform flexibility",
        evidence: [this.getContext(content, content.indexOf(hasMultiProvider ? "multi" : "open"))],
      });
    }

    // Community Sentiment Analysis
    const positiveSignals = [
      "loved by developers",
      "developers love",
      "community favorite",
      "highly rated",
      "top choice",
      "breakthrough",
      "game-changer",
      "revolutionary",
    ];

    const negativeSignals = [
      "criticism",
      "concerns",
      "issues",
      "problems",
      "backlash",
      "controversy",
      "complaints",
    ];

    const hasPositive = positiveSignals.some((signal) => lowerContent.includes(signal));
    const hasNegative = negativeSignals.some((signal) => lowerContent.includes(signal));

    if (hasPositive || hasNegative) {
      impacts.push({
        factor: "communitySentiment",
        impact: hasPositive && !hasNegative ? "positive" : hasNegative ? "negative" : "neutral",
        magnitude: "medium",
        description: hasPositive
          ? "Positive community reception and developer satisfaction"
          : "Community concerns may affect sentiment scores",
        evidence: [],
      });
    }

    return impacts;
  }

  private getContext(content: string, index: number, windowSize: number = 100): string {
    const start = Math.max(0, index - windowSize);
    const end = Math.min(content.length, index + windowSize);
    const context = content.substring(start, end).trim();
    return `...${context}...`;
  }

  private parseTokenValue(value: string): number {
    const num = parseFloat(value.replace(/[,]/g, ""));
    if (value.includes("K")) {
      return num * 1000;
    }
    if (value.includes("M")) {
      return num * 1000000;
    }
    return num;
  }
}
