
import { hasPositiveNumeric, parseNumericOr, parseNumeric } from "./parse-numeric";
import { calculateToolNewsImpact, type NewsArticle } from "./ranking-news-impact";
import {
  scoreArrContribution,
  scoreTerminalBenchContribution,
  scoreUsersContribution,
} from "./ranking-metric-curves";

/**
 * Single source of truth for the ranking algorithm version.
 *
 * Bumped v7.6 → v7.7: continuous ARR/users curves (replacing step bands),
 * robust numeric coercion at metric read sites, and populated historical
 * business metrics (ARR, users, SWE-bench, valuation, funding).
 *
 * Bumped v7.7 → v7.8: canonicalizeMetricPaths() fixes metric-path shadowing
 * so every factor reads one canonical value per field instead of silently
 * picking data.info.metrics.* vs data.metrics.* per factor.
 *
 * Bumped v7.8 → v7.9: Terminal-Bench (terminal-bench 2.1) blended into the
 * agentic-capability factor as a SECOND benchmark signal alongside SWE-bench
 * (see calculateAgenticCapability + TB_BLEND_WEIGHT). Calibrated so the blend
 * actually differentiates leaders: the SWE-bench anchor moved 70 → 88
 * (SWE_BENCH_ANCHOR) to de-saturate today's top scores, and heuristic bonuses
 * now fill remaining headroom instead of adding-then-clipping at 100
 * (AGENTIC_BONUS_HEADROOM_SCALE) so a strong benchmark blend is never re-capped
 * away. Factor WEIGHTS are unchanged; this only reshapes the agentic base.
 *
 * NOTE: existing v76 content slugs (e.g. `algorithm-v76-november-2025-rankings`)
 * are historical references and intentionally keep their v7.6 naming.
 */
export const ALGORITHM_VERSION = "v7.9";

/**
 * Blend weight for Terminal-Bench when BOTH benchmarks are present on a tool.
 *
 * Agentic base = (1 - TB_BLEND_WEIGHT) · sweBenchScore
 *                     + TB_BLEND_WEIGHT · terminalBenchScore
 *
 * where each *Score is that benchmark's normalized 0–100 contribution. At the
 * default 0.4 this is `0.6·SWE + 0.4·Terminal-Bench`. When only one benchmark is
 * present the tool uses whichever exists (no blend). This is the single knob the
 * algorithm owner retunes to weight Terminal-Bench more or less heavily; it does
 * NOT touch ALGORITHM_V76_WEIGHTS (the cross-factor proportions).
 */
export const TB_BLEND_WEIGHT = 0.4;

/**
 * SWE-bench Verified normalization anchor (percent), i.e. the accuracy that maps
 * to a normalized contribution of 100.
 *
 * v7.9 raised this from 70 → 88 (calibration). At 70 every current leader
 * saturated (Claude Opus 4.5 @ 80.9% → 115 → capped 100), which erased the
 * SWE↔Terminal-Bench blend: two tools both pinned at 100 cannot be separated by
 * a ≤100 second benchmark. 88 is chosen so today's best real SWE-bench (80.9%)
 * lands at 80.9/88 ≈ 91.9 — de-saturated, in the low-90s, with headroom above —
 * while no tool in the current field (max 80.9%) reaches the anchor. This
 * changes the SWE-bench contribution for ALL tools, not just Terminal-Bench
 * matches; that is intended and surfaced in the impact analysis.
 */
export const SWE_BENCH_ANCHOR = 88;

/**
 * Headroom scale for the agentic HEURISTIC bonuses (category / multi-file /
 * subprocess / capability-keyword).
 *
 * v7.9 stopped these bonuses from ADDING raw points and clipping the factor at
 * 100 — which re-saturated any tool whose benchmark base was already high and so
 * erased the retuned blend. Instead each unit of bonus now FILLS a fraction of
 * the remaining headroom between the benchmark base and 100:
 *
 *     factor = base + (100 - base) · min(1, bonusPoints / AGENTIC_BONUS_HEADROOM_SCALE)
 *
 * Because the fill fraction is < 1 for any realistic bonus stack (the richest
 * plausible stack is category 20 + multi-file 10 + subprocess ~10 + keyword ~9
 * ≈ 49 < 60), a higher benchmark base ALWAYS yields a higher final factor —
 * the SWE+Terminal-Bench blend can never be flattened away by the bonus/cap.
 * 60 leaves that guaranteed margin; lowering it toward ~49 would risk
 * re-saturating a maximally-endowed tool. Set to reproduce the legacy additive
 * behavior only via the `additive` calibration model (used to compute the A
 * baseline in the impact analysis).
 */
export const AGENTIC_BONUS_HEADROOM_SCALE = 60;

/**
 * Tunable agentic-capability calibration. Defaults reproduce the shipped v7.9
 * behavior; the impact-analysis script overrides these to reconstruct the v7.8
 * baseline (anchor 70 + legacy additive-then-clip bonuses) without resurrecting
 * old code.
 */
export interface AgenticCalibration {
  /** SWE-bench Verified anchor; default {@link SWE_BENCH_ANCHOR} (88). */
  sweBenchAnchor?: number;
  /**
   * How heuristic bonuses combine with the benchmark base:
   * - `"headroom"` (default, v7.9): fill remaining headroom, never masks the blend.
   * - `"additive"` (legacy v7.8): add raw points then clip at 100.
   */
  bonusModel?: "headroom" | "additive";
}

export interface RankingWeightsV76 {
  agenticCapability: number;
  innovation: number;
  technicalPerformance: number;
  developerAdoption: number;
  marketTraction: number;
  businessSentiment: number;
  developmentVelocity: number;
  platformResilience: number;
}

export const ALGORITHM_V76_WEIGHTS: RankingWeightsV76 = {
  agenticCapability: 0.12,      // ↓ from 0.35 - reduce theory-based scoring
  innovation: 0.10,              // ↓ from 0.10 - reduce hype-based scoring
  technicalPerformance: 0.18,    // ↓ from 0.10 - maintain benchmark value
  developerAdoption: 0.18,       // ↑ from 0.125 - MAJOR INCREASE for real users
  marketTraction: 0.12,          // ↑ from 0.125 - MAJOR INCREASE for market validation
  businessSentiment: 0.12,       // ↓ from 0.125 - maintain enterprise signals
  developmentVelocity: 0.12,     // ↑ from 0.05 - reward active development
  platformResilience: 0.08,      // ↑ from 0.025 - reward stability
};

export interface ToolMetricsV76 {
  tool_id: string;
  name: string;
  slug: string;
  category?: string;
  status?: string;

  // Available metrics from data
  info?: {
    features?: string[];
    description?: string;
    summary?: string;
    overview?: string;
    company?: string;
    company_name?: string;
    launch_year?: number;
    pricing_model?: string;
    technical?: {
      context_window?: number;
      max_context_window?: number;
      multi_file_support?: boolean;
      language_support?: string[];
      llm_providers?: string[];
      swe_bench_score?: number;
      ide_integration?: string;
      performance?: {
        indexing_speed?: string;
        caching_strategy?: string;
        mixture_of_experts?: boolean;
        speculative_decoding?: boolean;
      };
      subprocess_support?: Record<string, boolean>;
    };
    business?: {
      pricing_model?: string;
      base_price?: number;
      free_tier?: boolean;
      pricing_details?: Record<string, string>;
      enterprise_pricing?: boolean;
    };
    // NOTE: the numeric fields below are widened to `number | string` because
    // live `tools` rows can store human-written values (Devin's valuation is
    // "$10.2B (September 2025)"). They are coerced at read time via
    // `parseNumeric`/`parseNumericOr`; stored data is never mutated.
    metrics?: {
      swe_bench?: {
        verified?: number | string;
        lite?: number | string;
        full?: number | string;
      };
      // Terminal-Bench accuracy (percent, 0–100) for this tool's BEST scaffold+model
      // row. Canonical top-level path only (data.metrics.terminal_bench) — NEVER
      // the nested data.info.metrics copy (v7.8 path-shadowing). May be string-
      // stored; coerced via parseNumeric at read time.
      terminal_bench?: number | string;
      news_mentions?: number;
      users?: number | string;
      monthly_arr?: number | string;
      annual_recurring_revenue?: number | string;
      valuation?: number | string;
      funding?: number | string;
      github_stars?: number;
      employees?: number | string;
    };
    // Additional metrics that might be present
    github_stats?: {
      stars?: number;
      forks?: number;
      watchers?: number;
    };
    vscode_installs?: number;
    npm_downloads?: number;
    user_count?: number | string;
    annual_recurring_revenue?: number | string;
    swe_bench_score?: number | string;
  };
}

export interface ToolScoreV76 {
  tool_id: string;
  tool_slug: string;
  overallScore: number;
  factorScores: Record<string, number>;
  tiebreakers: {
    featureCount: number;
    descriptionQuality: number;
    pricingTier: number;
    alphabeticalOrder: number;
  };
  dataCompleteness: number;
  confidenceMultiplier: number;
  sentimentAnalysis?: {
    rawSentiment: number;
    adjustedSentiment: number;
    newsImpact: number;
  };
  algorithm_version: string;
}

/**
 * NEW: Calculate data completeness percentage
 * Returns 0-100 based on availability of real-world metrics
 */
function calculateDataCompleteness(metrics: ToolMetricsV76): number {
  // Helper to safely check numeric values.
  // Delegates to `hasPositiveNumeric` so string-stored metrics ("$10.2B") count
  // as present. The previous inline `value > 0` was false for every string,
  // under-reporting completeness and depressing the confidence multiplier.
  const hasValue = (value: unknown): boolean => hasPositiveNumeric(value);

  // Access the actual metrics data location
  const metricsData = (metrics as any).metrics || {}; // NEW: actual storage location

  const dataPoints = {
    // High-value metrics (20 points each) - Real-world verification
    // GitHub stars - check NEW location first, then legacy paths
    hasGitHubStars: hasValue(metricsData.github?.stars) ||              // NEW: actual path
                     hasValue(metrics.info?.metrics?.github_stars) ||   // OLD: legacy
                     hasValue(metrics.info?.github_stats?.stars),       // OLD: alt legacy

    // VS Code marketplace installs - check NEW location first, then legacy
    hasVSCodeInstalls: hasValue(metricsData.vscode?.installs) ||        // NEW: actual path
                       hasValue(metrics.info?.vscode_installs),         // OLD: legacy

    // npm package downloads - check NEW location first, then legacy
    hasnpmDownloads: hasValue(metricsData.npm?.downloads_last_month) || // NEW: actual path
                     hasValue(metrics.info?.npm_downloads),             // OLD: legacy

    // PyPI downloads - NEW metric from actual data
    hasPyPIDownloads: hasValue(metricsData.pypi?.downloads_last_month), // NEW

    // Medium-value metrics (15 points each) - Business validation
    // User count - strong market validation
    hasUserCount: hasValue(metrics.info?.metrics?.users) ||
                  hasValue(metrics.info?.user_count),

    // Revenue/ARR - strong business validation
    hasRevenue: hasValue(metrics.info?.metrics?.monthly_arr) ||
                hasValue(metrics.info?.metrics?.annual_recurring_revenue) ||
                hasValue(metrics.info?.annual_recurring_revenue),

    // SWE-bench scores - technical validation
    hasSWEBench: hasValue(metrics.info?.metrics?.swe_bench?.verified) ||
                 hasValue(metrics.info?.metrics?.swe_bench?.lite) ||
                 hasValue(metrics.info?.metrics?.swe_bench?.full) ||
                 hasValue(metrics.info?.technical?.swe_bench_score) ||
                 hasValue(metrics.info?.swe_bench_score),

    // Low-value metrics (10 points each) - Descriptive data
    // Detailed description indicates quality documentation
    hasDescription: (metrics.info?.description?.length || 0) > 100 ||
                    (metrics.info?.summary?.length || 0) > 100,

    // Feature list indicates mature product
    hasFeatures: (metrics.info?.features?.length || 0) > 5,

    // Company backing indicates stability
    hasCompanyInfo: !!(metrics.info?.company || metrics.info?.company_name),

    // Pricing model indicates go-to-market strategy
    hasPricing: !!(metrics.info?.business?.pricing_model || metrics.info?.pricing_model),
  };

  let score = 0;

  // High-value data (20 points each, adjusted to make room for PyPI)
  if (dataPoints.hasGitHubStars) score += 20;
  if (dataPoints.hasVSCodeInstalls) score += 20;
  if (dataPoints.hasnpmDownloads) score += 20;
  if (dataPoints.hasPyPIDownloads) score += 15; // NEW: PyPI downloads

  // Medium-value data (15 points each)
  if (dataPoints.hasUserCount) score += 15;
  if (dataPoints.hasRevenue) score += 15;
  if (dataPoints.hasSWEBench) score += 15;

  // Low-value data (10 points each)
  if (dataPoints.hasDescription) score += 10;
  if (dataPoints.hasFeatures) score += 10;
  if (dataPoints.hasCompanyInfo) score += 10;
  if (dataPoints.hasPricing) score += 10;

  return Math.min(100, score); // Max 170 possible, capped at 100
}

/**
 * Helper function to calculate description quality score
 * Considers length, detail, and keyword richness
 */
function calculateDescriptionQuality(metrics: ToolMetricsV76): number {
  const description = metrics.info?.description || "";
  const summary = metrics.info?.summary || "";
  const overview = metrics.info?.overview || "";

  // Combine all text fields
  const allText = `${description} ${summary} ${overview}`;
  const textLength = allText.length;

  // Base score from text length
  let score = 0;
  if (textLength >= 1000) score = 20;
  else if (textLength >= 500) score = 15;
  else if (textLength >= 250) score = 10;
  else if (textLength >= 100) score = 5;
  else score = 1;

  // Bonus for rich keywords (indicates detailed documentation)
  const qualityKeywords = [
    "autonomous",
    "enterprise",
    "scalable",
    "production",
    "integration",
    "architecture",
    "performance",
    "security",
    "workflow",
    "collaboration",
  ];

  const keywordMatches = qualityKeywords.filter((kw) =>
    allText.toLowerCase().includes(kw)
  ).length;

  score += keywordMatches * 2;

  return Math.min(50, score); // Cap at 50 to use as microtiebreaker
}

/**
 * Helper function to calculate pricing tier score
 * Higher price = more market validation
 */
function calculatePricingTier(metrics: ToolMetricsV76): number {
  const pricingModel = metrics.info?.business?.pricing_model || metrics.info?.pricing_model;
  const basePrice = metrics.info?.business?.base_price || 0;
  const hasFree = metrics.info?.business?.free_tier;
  const hasEnterprise = metrics.info?.business?.enterprise_pricing;

  let score = 0;

  // Base pricing model score
  if (pricingModel === "subscription" || pricingModel === "freemium") {
    score = 10;
  } else if (pricingModel === "enterprise") {
    score = 15;
  } else if (pricingModel === "paid") {
    score = 8;
  } else if (pricingModel === "free") {
    score = 5;
  }

  // Price point bonus (market validation)
  if (basePrice >= 100) score += 20;
  else if (basePrice >= 50) score += 15;
  else if (basePrice >= 20) score += 10;
  else if (basePrice >= 10) score += 5;

  // Freemium indicates traction
  if (hasFree && basePrice > 0) score += 5;

  // Enterprise tier indicates serious business
  if (hasEnterprise) score += 10;

  return Math.min(50, score); // Cap at 50
}

/**
 * Helper function to extract capability indicators from description
 */
function extractCapabilityScore(text: string): number {
  const capabilityKeywords = [
    "autonomous",
    "agent",
    "multi-file",
    "planning",
    "reasoning",
    "orchestration",
    "workflow",
    "debugging",
    "refactoring",
    "testing",
    "deployment",
    "monitoring",
  ];

  const matches = capabilityKeywords.filter((kw) =>
    text.toLowerCase().includes(kw)
  ).length;

  return Math.min(30, matches * 3); // Up to 30 points
}

/**
 * Helper function to calculate company backing score
 */
function calculateCompanyBacking(metrics: ToolMetricsV76): number {
  const company = metrics.info?.company || metrics.info?.company_name || "";
  // Coerce at read time: these can arrive as human-written strings
  // (e.g. Devin's "$575M+ total raised"), which previously read as 0.
  const funding = parseNumericOr(metrics.info?.metrics?.funding);
  const valuation = parseNumericOr(metrics.info?.metrics?.valuation);
  const employees = parseNumericOr(metrics.info?.metrics?.employees);

  let score = 0;

  // Major tech companies
  const majorCompanies = ["Google", "Microsoft", "Meta", "Amazon", "GitHub", "Anthropic", "OpenAI"];
  if (majorCompanies.some((c) => company.includes(c))) {
    score += 20;
  }

  // Funding indicates serious backing
  if (funding >= 100000000) score += 15; // $100M+
  else if (funding >= 10000000) score += 10; // $10M+
  else if (funding >= 1000000) score += 5; // $1M+

  // Valuation indicates market validation
  if (valuation >= 1000000000) score += 15; // $1B+
  else if (valuation >= 100000000) score += 10; // $100M+

  // Team size indicates maturity
  if (employees >= 100) score += 10;
  else if (employees >= 50) score += 7;
  else if (employees >= 20) score += 5;
  else if (employees >= 10) score += 3;

  return Math.min(40, score);
}

/**
 * Helper function to calculate launch maturity bonus
 */
function calculateMaturityBonus(metrics: ToolMetricsV76): number {
  const launchYear = metrics.info?.launch_year;
  if (!launchYear) return 0;

  const currentYear = new Date().getFullYear();
  const age = currentYear - launchYear;

  // Sweet spot: 1-3 years (established but modern)
  if (age >= 1 && age <= 3) return 10;
  if (age >= 4 && age <= 5) return 5;
  if (age < 1) return 3; // New but unproven
  return 0; // Too old might be outdated
}

/** Narrow an unknown to a plain object (spread-safe), else undefined. */
function asPlainObject(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/**
 * Canonical metric-path resolution (fixes metric-path shadowing).
 *
 * Some tools store business metrics at `data.metrics.*` (top level), some at
 * `data.info.metrics.*` (the 34 "double-nested" tools), and some at BOTH.
 * Historically, factor read sites split into two groups that read the SAME
 * logical field from DIFFERENT paths, so a value present at only one path was
 * silently invisible to half the factors.
 *
 * Precedence rule: per top-level metric key, `data.metrics.*` (top level) WINS
 * over `data.info.metrics.*`; keys present only at the nested path are kept.
 * Rationale:
 * - Historical metric overrides (`applyHistoricalMetricsOverride`) merge into
 *   `data.metrics.*` — they must be authoritative for every factor.
 * - `data.metrics` is where the migration/collectors write current values
 *   (github/vscode/npm/pypi and refreshed business metrics); the nested
 *   `data.info.metrics` copy is legacy authored data.
 * - Every pre-fix Group-A read already preferred the top-level value on
 *   conflicts (e.g. swe_bench), so top-wins preserves those published scores.
 *
 * The merge is SHALLOW (whole top-level key wins) so each field resolves from
 * exactly one source — one value, once; never double-counted, never dropped.
 */
export function canonicalizeMetricPaths(
  topMetrics: Record<string, unknown> | undefined,
  nestedMetrics: Record<string, unknown> | undefined
): Record<string, unknown> {
  return { ...(nestedMetrics ?? {}), ...(topMetrics ?? {}) };
}

export class RankingEngineV76 {
  constructor(
    private weights: RankingWeightsV76 = ALGORITHM_V76_WEIGHTS,
    private calibration: AgenticCalibration = {}
  ) {}

  /**
   * Single normalization step at load: canonicalize the tool's METRICS subtree
   * so that every factor — whether it reads `metrics.info.metrics.*` directly
   * (data completeness, company backing, agentic, business sentiment) or goes
   * through `getData()` (developer adoption, market traction) — resolves the
   * same logical field to the same single value.
   *
   * Only the metrics subtree is canonicalized. Non-metric info fields
   * (features, description, technical, business, …) keep their existing
   * per-group resolution exactly, so this fix cannot move scores for any tool
   * whose metric paths already agreed (all 80 flat tools score identically).
   *
   * Does not mutate the input (or the underlying tool.data).
   */
  private normalizeInput(metrics: ToolMetricsV76): ToolMetricsV76 {
    const outer = asPlainObject(metrics.info);
    if (!outer) return metrics;

    const hasDoubleNesting = "info" in outer;
    const nestedInfo = hasDoubleNesting ? asPlainObject(outer["info"]) : outer;

    const topMetrics =
      asPlainObject(outer["metrics"]) ??
      asPlainObject((metrics as { metrics?: unknown }).metrics);
    const nestedMetrics = asPlainObject(nestedInfo?.["metrics"]);

    const canonical = canonicalizeMetricPaths(topMetrics, nestedMetrics);

    const normalizedOuter: Record<string, unknown> = hasDoubleNesting
      ? {
          ...outer,
          metrics: canonical,
          info: { ...(nestedInfo ?? {}), metrics: canonical },
        }
      : { ...outer, metrics: canonical };

    return {
      ...metrics,
      info: normalizedOuter,
      metrics: canonical,
    } as ToolMetricsV76;
  }

  /**
   * Helper to safely access nested data
   * Problem: scripts pass `info: toolData` where toolData = {info: {...}, metrics: {...}}
   * So we need to check both metrics.info.* and metrics.info.info.* paths
   *
   * NOTE: inputs are pre-normalized by `normalizeInput()` in
   * `calculateToolScore`, so both branches of `metrics` below — and
   * `info.metrics` — resolve to the same canonical metrics object.
   */
  private getData(metrics: ToolMetricsV76): {
    info: any;
    metrics: any;
  } {
    // If metrics.info has an 'info' property, it means we have double nesting
    const hasDoubleNesting = metrics.info && 'info' in metrics.info;

    return {
      info: hasDoubleNesting ? (metrics.info as any).info : metrics.info,
      metrics: hasDoubleNesting ? (metrics.info as any).metrics : (metrics as any).metrics,
    };
  }

  /**
   * Calculate agentic capability with enhanced differentiation
   */
  private calculateAgenticCapability(metrics: ToolMetricsV76): number {
    const sweBenchAnchor = this.calibration.sweBenchAnchor ?? SWE_BENCH_ANCHOR;

    // ---- Benchmark base: SWE-bench blended with Terminal-Bench --------------
    // Two independent benchmark signals feed the agentic base. Each is
    // normalized to a 0–100 contribution against its anchor; when both exist
    // they are combined via TB_BLEND_WEIGHT, otherwise the tool uses whichever
    // it has. The blend operates on the UNSATURATED normalized values (the
    // v7.9 anchor keeps today's leaders below 100), so Terminal-Bench can
    // actually separate them. No factor weight changes here.

    // SWE-bench normalized contribution (or null when absent).
    // Values may be stored as strings ("72%", "49.2"); coerce first so a real
    // benchmark result isn't discarded as non-numeric.
    const sweBench = metrics.info?.metrics?.swe_bench;
    const verified = parseNumeric(sweBench?.verified);
    const lite = parseNumeric(sweBench?.lite);
    const full = parseNumeric(sweBench?.full);
    let sweBenchScore: number | null = null;
    if (verified !== null && verified > 0) {
      sweBenchScore = Math.min(100, (verified / sweBenchAnchor) * 100);
    } else if ((lite !== null && lite > 0) || (full !== null && full > 0)) {
      const benchScore = (lite ?? 0) > 0 ? (lite as number) : (full as number);
      sweBenchScore = Math.min(100, (benchScore / 30) * 80);
    }

    // Terminal-Bench normalized contribution (or null when absent). Read from the
    // CANONICAL top-level path data.metrics.terminal_bench only (normalizeInput
    // has already canonicalized info.metrics to it) — never a nested copy.
    const terminalBenchAccuracy = parseNumeric(metrics.info?.metrics?.terminal_bench);
    const terminalBenchScore =
      terminalBenchAccuracy !== null && terminalBenchAccuracy > 0
        ? scoreTerminalBenchContribution(terminalBenchAccuracy)
        : null;

    // Blend the two signals into the agentic base (50 = neutral, no benchmark).
    let benchmarkBase = 50;
    if (sweBenchScore !== null && terminalBenchScore !== null) {
      benchmarkBase =
        (1 - TB_BLEND_WEIGHT) * sweBenchScore + TB_BLEND_WEIGHT * terminalBenchScore;
    } else if (sweBenchScore !== null) {
      benchmarkBase = sweBenchScore;
    } else if (terminalBenchScore !== null) {
      benchmarkBase = terminalBenchScore;
    }

    // ---- Heuristic bonuses --------------------------------------------------
    // Accumulate raw bonus points from the non-benchmark signals, then combine
    // them with the benchmark base per the calibration model (see below). These
    // are the same signals/points as before; only how they fold into the final
    // factor changed in v7.9.
    let bonusPoints = 0;

    // Category bonuses - MORE GRANULAR
    const categoryBonus: Record<string, number> = {
      "autonomous-agent": 20,
      "code-editor": 15,
      "proprietary-ide": 15,
      "ide-assistant": 10,
      "devops-assistant": 10,
      "open-source-framework": 5,
      "app-builder": 3,
    };
    if (metrics.category && metrics.category in categoryBonus) {
      bonusPoints += categoryBonus[metrics.category];
    }

    // Multi-file support bonus
    if (metrics.info?.technical?.multi_file_support) {
      bonusPoints += 10;
    }

    // Subprocess/automation capabilities
    const subprocess = metrics.info?.technical?.subprocess_support;
    if (subprocess) {
      const subprocessFeatures = Object.values(subprocess).filter(Boolean).length;
      bonusPoints += subprocessFeatures * 2;
    }

    // Extract capability keywords from description
    const allText = `${metrics.info?.description || ""} ${metrics.info?.summary || ""} ${metrics.info?.overview || ""}`;
    bonusPoints += extractCapabilityScore(allText) * 0.3;

    // ---- Combine base + bonuses --------------------------------------------
    if (this.calibration.bonusModel === "additive") {
      // Legacy v7.8: add raw points and clip at 100. When the benchmark base is
      // already high this re-saturates the factor and erases the SWE↔TB blend —
      // reproduced here only to compute the v7.8 baseline in the impact analysis.
      return Math.min(100, benchmarkBase + bonusPoints);
    }

    // v7.9 default: bonuses FILL a fraction of the remaining headroom above the
    // benchmark base rather than adding-then-clipping. Because that fraction is
    // < 1 for any realistic bonus stack, a higher benchmark base (stronger
    // SWE+TB blend) always yields a higher final agentic score — the blend is
    // never flattened away by the cap. Result stays within [benchmarkBase, 100].
    const fill = Math.min(1, bonusPoints / AGENTIC_BONUS_HEADROOM_SCALE);
    return benchmarkBase + (100 - benchmarkBase) * fill;
  }

  /**
   * Calculate innovation with better defaults
   */
  private calculateInnovation(metrics: ToolMetricsV76): number {
    let score = 30; // Base score

    // Feature count as innovation proxy
    const featureCount = metrics.info?.features?.length || 0;
    if (featureCount > 0) {
      score = Math.min(85, 30 + featureCount * 3);
    }

    // Innovation keywords
    const innovativeKeywords = [
      "specification-driven",
      "autonomous",
      "agent",
      "mcp",
      "scaffolding",
      "multi-modal",
      "reasoning",
      "planning",
      "orchestration",
      "background agent",
      "speculative",
    ];

    const description = `${metrics.info?.summary || ""} ${metrics.info?.description || ""}`;
    const matchedKeywords = innovativeKeywords.filter((keyword) =>
      description.toLowerCase().includes(keyword)
    ).length;

    score = score + matchedKeywords * 8;

    // Performance innovations
    const performance = metrics.info?.technical?.performance;
    if (performance) {
      if (performance.mixture_of_experts) score += 5;
      if (performance.speculative_decoding) score += 5;
      if (performance.indexing_speed) score += 3;
    }

    // Launch year recency bonus
    score += calculateMaturityBonus(metrics);

    return Math.min(100, score);
  }

  /**
   * Calculate technical performance with max context window
   */
  private calculateTechnicalPerformance(metrics: ToolMetricsV76): number {
    let score = 40; // Base score

    // Use max context window if available, fallback to regular
    const contextWindow = metrics.info?.technical?.max_context_window ||
      metrics.info?.technical?.context_window || 0;

    if (contextWindow >= 1000000) {
      score = 95;
    } else if (contextWindow >= 500000) {
      score = 90;
    } else if (contextWindow >= 200000) {
      score = 85;
    } else if (contextWindow >= 100000) {
      score = 70;
    } else if (contextWindow > 0) {
      score = 50 + (contextWindow / 100000) * 20;
    }

    // Language support
    const languageCount = metrics.info?.technical?.language_support?.length || 0;
    if (languageCount >= 20) {
      score = Math.min(100, score + 15);
    } else if (languageCount >= 10) {
      score = Math.min(100, score + 10);
    } else if (languageCount > 0) {
      score = Math.min(100, score + languageCount * 0.8);
    }

    // LLM provider diversity
    const llmProviders = metrics.info?.technical?.llm_providers?.length || 0;
    if (llmProviders >= 10) {
      score = Math.min(100, score + 15);
    } else if (llmProviders >= 5) {
      score = Math.min(100, score + 10);
    } else if (llmProviders >= 3) {
      score = Math.min(100, score + 7);
    } else if (llmProviders > 0) {
      score = Math.min(100, score + llmProviders * 2);
    }

    // IDE integration type matters
    const ideIntegration = metrics.info?.technical?.ide_integration;
    if (ideIntegration?.includes("Proprietary") || ideIntegration?.includes("Fork")) {
      score = Math.min(100, score + 5);
    }

    return score;
  }

  /**
   * Calculate developer adoption with market-realistic thresholds
   *
   * MARKET REALITY:
   * - GitHub Copilot: 57M VS Code installs, 1.8M users, 265K npm downloads
   * - Cursor: 447K VS Code installs, 360K users, 16 news mentions
   * - Jules: 233 VS Code installs, 0 users, 9K npm downloads
   *
   * Strategy: Heavily reward proven adoption, penalize tools with minimal data
   */
  private calculateDeveloperAdoption(metrics: ToolMetricsV76): number {
    let score = 0; // Start at 0 - must earn all points

    // Use helper to get correctly nested data
    const { info, metrics: metricsData } = this.getData(metrics);

    // VS Code installs - PRIMARY signal (most reliable)
    const vscodeInstalls = metricsData?.vscode?.installs || 0;
    if (vscodeInstalls >= 50000000) {
      score += 40; // GitHub Copilot level
    } else if (vscodeInstalls >= 10000000) {
      score += 35;
    } else if (vscodeInstalls >= 1000000) {
      score += 30; // Claude Code level
    } else if (vscodeInstalls >= 500000) {
      score += 25;
    } else if (vscodeInstalls >= 100000) {
      score += 20; // Meaningful adoption
    } else if (vscodeInstalls >= 10000) {
      score += 10; // Early traction
    } else if (vscodeInstalls >= 1000) {
      score += 5; // Minimal adoption
    }
    // < 1000 installs = 0 points (Jules at 233 = 0)

    // User count (strong validation signal)
    //
    // CHANGED (v7.6): step bands replaced with a continuous log-interpolated
    // curve calibrated THROUGH the original band anchors
    // (5K->5, 10K->10, 50K->15, 100K->20, 500K->25, 1M->30).
    // Exact anchor values score identically to before; only intermediate values
    // smooth out, and the 0-below-5K / 30-above-1M clamps are unchanged.
    // See lib/ranking-metric-curves.ts.
    // `||` (not `??`) preserves the original fallback: a 0 user count defers to
    // the legacy `user_count` field.
    const users = parseNumericOr(info?.metrics?.users || info?.user_count);
    score += scoreUsersContribution(users);

    // npm downloads - secondary signal
    const npmDownloads = metricsData?.npm?.downloads_last_month || 0;
    if (npmDownloads >= 1000000) {
      score += 15;
    } else if (npmDownloads >= 500000) {
      score += 12;
    } else if (npmDownloads >= 100000) {
      score += 10; // Copilot level
    } else if (npmDownloads >= 50000) {
      score += 7;
    } else if (npmDownloads >= 10000) {
      score += 3; // Claude Code level
    }
    // < 10K downloads = 0 points (Jules at 9K = 0)

    // News mentions - market awareness indicator
    const newsMentions = info?.metrics?.news_mentions || 0;
    if (newsMentions >= 20) {
      score += 10; // Copilot level
    } else if (newsMentions >= 15) {
      score += 8; // Cursor level
    } else if (newsMentions >= 10) {
      score += 6;
    } else if (newsMentions >= 5) {
      score += 4;
    } else if (newsMentions >= 2) {
      score += 2;
    }
    // 1 mention = 0 points (Jules = 0)

    // GitHub stars - community validation
    const githubStars = metricsData?.github?.stars ||
                       info?.metrics?.github_stars ||
                       info?.github_stats?.stars || 0;
    if (githubStars >= 50000) {
      score += 5;
    } else if (githubStars >= 20000) {
      score += 4;
    } else if (githubStars >= 10000) {
      score += 3;
    } else if (githubStars >= 5000) {
      score += 2;
    }

    return Math.min(100, score);
  }

  /**
   * Calculate market traction with business reality
   *
   * MARKET REALITY:
   * - GitHub Copilot: $400M ARR, 1.8M users
   * - Cursor: $500M ARR, 360K users
   * - Jules: $0 ARR, 0 users, free tier only
   *
   * Strategy: Reward proven business models and revenue
   */
  private calculateMarketTraction(metrics: ToolMetricsV76): number {
    let score = 0; // Start at 0 - must prove market traction

    // Use helper to get correctly nested data
    const { info, metrics: metricsData } = this.getData(metrics);

    // ARR is PRIMARY signal - actual revenue proves market validation
    //
    // CHANGED (v7.6): step bands replaced with a continuous log-interpolated
    // curve calibrated THROUGH the original band anchors
    // (100K->15, 1M->25, 10M->35, 50M->40, 100M->45, 400M->50).
    // Exact anchor values score identically to before; only intermediate values
    // smooth out, and the 0-below-100K / 50-above-400M clamps are unchanged.
    // See lib/ranking-metric-curves.ts.
    const monthlyArr = parseNumericOr(
      info?.metrics?.monthly_arr ||
      info?.metrics?.annual_recurring_revenue ||
      info?.annual_recurring_revenue
    );
    score += scoreArrContribution(monthlyArr);
    // No revenue = 0 points (Jules = 0)

    // Pricing model as proxy ONLY if no revenue data
    if (monthlyArr === 0) {
      const pricingModel = info?.business?.pricing_model || info?.pricing_model;
      const basePrice = info?.business?.base_price || 0;
      const hasEnterprise = info?.business?.enterprise_pricing;

      if (hasEnterprise) {
        score += 20; // Enterprise pricing shows serious intent
      } else if (pricingModel === "subscription" && basePrice >= 50) {
        score += 15;
      } else if (pricingModel === "subscription" && basePrice >= 20) {
        score += 12;
      } else if (pricingModel === "freemium" && basePrice > 0) {
        score += 10; // Has paid tier
      } else if (pricingModel === "subscription") {
        score += 8;
      } else if (pricingModel === "freemium") {
        score += 5; // Free with no paid tier
      } else if (pricingModel === "free") {
        score += 0; // Jules: free only = 0 points
      }
    }

    // Valuation/funding - investor validation
    // Coerce at read time: e.g. Devin stores valuation as
    // "$10.2B (September 2025)" and funding as "$575M+ total raised", both of
    // which previously compared false against every threshold and scored 0.
    const valuation = parseNumericOr(info?.metrics?.valuation);
    const funding = parseNumericOr(info?.metrics?.funding);

    if (valuation >= 5000000000) {
      score += 20;
    } else if (valuation >= 1000000000) {
      score += 15;
    } else if (valuation >= 100000000) {
      score += 10;
    } else if (funding >= 100000000) {
      score += 8;
    } else if (funding >= 10000000) {
      score += 5;
    }

    // GitHub stars - community traction signal
    const githubStars = metricsData?.github?.stars ||
                       info?.metrics?.github_stars ||
                       info?.github_stats?.stars || 0;
    if (githubStars >= 50000) {
      score += 10;
    } else if (githubStars >= 20000) {
      score += 7;
    } else if (githubStars >= 10000) {
      score += 5;
    } else if (githubStars >= 5000) {
      score += 3;
    }

    // Company backing - stability indicator
    const companyBonus = calculateCompanyBacking(metrics) * 0.2; // Reduced weight
    score += companyBonus;

    return Math.min(100, score);
  }

  /**
   * Calculate business sentiment with news impact
   */
  private calculateBusinessSentiment(
    metrics: ToolMetricsV76,
    newsImpact?: ReturnType<typeof calculateToolNewsImpact>
  ): number {
    let score = 60; // Neutral base

    // News mentions as sentiment proxy
    const newsMentions = metrics.info?.metrics?.news_mentions || 0;
    if (newsMentions >= 15) {
      score = 80;
    } else if (newsMentions >= 10) {
      score = 75;
    } else if (newsMentions >= 5) {
      score = 70;
    } else if (newsMentions >= 1) {
      score = 65;
    }

    // Apply news impact if available
    if (newsImpact && !Number.isNaN(newsImpact.totalImpact)) {
      const impactModifier = newsImpact.totalImpact * 10;
      score = Math.max(0, Math.min(100, score + impactModifier));
    }

    // Category sentiment adjustments
    if (metrics.category === "autonomous-agent" || metrics.category === "code-editor") {
      score = Math.min(100, score + 10);
    }

    // Growth metrics indicate positive sentiment
    // Coerced at read time; these may be string-stored.
    const arr = parseNumericOr(
      metrics.info?.metrics?.monthly_arr ||
      metrics.info?.metrics?.annual_recurring_revenue ||
      metrics.info?.annual_recurring_revenue
    );
    const users = parseNumericOr(metrics.info?.metrics?.users || metrics.info?.user_count);
    if (arr >= 100000000 || users >= 500000) {
      score = Math.min(100, score + 10);
    }

    return score;
  }

  /**
   * Calculate development velocity with better signals
   */
  private calculateDevelopmentVelocity(metrics: ToolMetricsV76): number {
    let score = 50; // Base

    // Active status
    if (metrics.status === "active") {
      score = 60;
    }

    // Feature richness indicates active development
    const featureCount = metrics.info?.features?.length || 0;
    if (featureCount >= 15) {
      score = Math.min(100, score + 25);
    } else if (featureCount >= 10) {
      score = Math.min(100, score + 20);
    } else if (featureCount >= 5) {
      score = Math.min(100, score + 10);
    }

    // Recent updates field
    const recentUpdates = (metrics.info as any)?.recent_updates_2025;
    if (recentUpdates && Array.isArray(recentUpdates)) {
      const updateCount = recentUpdates.length;
      score = Math.min(100, score + updateCount * 2);
    }

    return score;
  }

  /**
   * Calculate platform resilience
   */
  private calculatePlatformResilience(metrics: ToolMetricsV76): number {
    let score = 50; // Base score

    // Multiple LLM providers = resilience
    const llmProviders = metrics.info?.technical?.llm_providers?.length || 0;
    if (llmProviders >= 5) {
      score = 85;
    } else if (llmProviders >= 3) {
      score = 75;
    } else if (llmProviders >= 2) {
      score = 65;
    } else if (llmProviders === 1) {
      score = 55;
    }

    // Open source = more resilient
    if (metrics.category === "open-source-framework") {
      score = Math.min(100, score + 20);
    }

    // Free tier = accessible
    if (metrics.info?.business?.free_tier) {
      score = Math.min(100, score + 10);
    }

    // Company backing = stability
    const companyBacking = calculateCompanyBacking(metrics);
    score = Math.min(100, score + companyBacking * 0.2);

    return score;
  }

  /**
   * Calculate deterministic tiebreakers
   */
  private calculateTiebreakers(metrics: ToolMetricsV76): {
    featureCount: number;
    descriptionQuality: number;
    pricingTier: number;
    alphabeticalOrder: number;
  } {
    // Feature count (0-100)
    const featureCount = Math.min(100, (metrics.info?.features?.length || 0) * 5);

    // Description quality (0-100)
    const descriptionQuality = calculateDescriptionQuality(metrics) * 2;

    // Pricing tier (0-100)
    const pricingTier = calculatePricingTier(metrics) * 2;

    // Alphabetical order (deterministic final tiebreaker)
    const firstChar = metrics.name.charAt(0).toLowerCase();
    const alphabeticalOrder = (122 - firstChar.charCodeAt(0)) * 4;

    return {
      featureCount,
      descriptionQuality,
      pricingTier,
      alphabeticalOrder,
    };
  }

  /**
   * Calculate the overall score (0-100 range) with data completeness penalty
   */
  calculateToolScore(
    rawMetrics: ToolMetricsV76,
    currentDate: Date = new Date(),
    newsArticles?: NewsArticle[]
  ): ToolScoreV76 {
    // Canonicalize metric paths ONCE at load so every factor below reads the
    // same value for the same logical field (see normalizeInput).
    const metrics = this.normalizeInput(rawMetrics);

    // Calculate news impact if articles provided
    let newsImpact = null;
    if (newsArticles && metrics.tool_id) {
      newsImpact = calculateToolNewsImpact(metrics.tool_id, newsArticles, currentDate);
    }

    // Calculate all factor scores (0-100 scale)
    const factorScores = {
      agenticCapability: this.calculateAgenticCapability(metrics),
      innovation: this.calculateInnovation(metrics),
      technicalPerformance: this.calculateTechnicalPerformance(metrics),
      developerAdoption: this.calculateDeveloperAdoption(metrics),
      marketTraction: this.calculateMarketTraction(metrics),
      businessSentiment: this.calculateBusinessSentiment(metrics, newsImpact || undefined),
      developmentVelocity: this.calculateDevelopmentVelocity(metrics),
      platformResilience: this.calculatePlatformResilience(metrics),
      // Legacy fields for compatibility
      technicalCapability: 0,
      communitySentiment: 0,
    };

    // Set legacy fields
    factorScores.technicalCapability = factorScores.technicalPerformance;
    factorScores.communitySentiment = factorScores.businessSentiment;

    // Validation: Check that all factor scores are within valid range [0-100]
    Object.entries(factorScores).forEach(([factor, value]) => {
      if (value < 0 || value > 100) {
        console.warn(`⚠️ ${metrics.name}: ${factor} score ${value.toFixed(2)} out of range [0-100]`);
      }
    });

    // Calculate weighted overall score
    let overallScore = Object.entries(this.weights).reduce((total, [factor, weight]) => {
      const score = factorScores[factor as keyof typeof factorScores] || 0;
      return total + score * weight;
    }, 0);

    // NEW: Calculate data completeness and apply confidence multiplier
    const dataCompleteness = calculateDataCompleteness(metrics);
    const confidenceMultiplier = 0.7 + (dataCompleteness / 100) * 0.3;
    // Range: 0.7 (no data) to 1.0 (complete data)

    // Apply confidence penalty to overall score
    overallScore = overallScore * confidenceMultiplier;

    // Calculate tiebreakers
    const tiebreakers = this.calculateTiebreakers(metrics);

    // Apply tiebreakers as micro-adjustments (0.001 precision)
    const tiebreakerAdjustment =
      (tiebreakers.featureCount * 0.00001) +
      (tiebreakers.descriptionQuality * 0.000001) +
      (tiebreakers.pricingTier * 0.0000001) +
      (tiebreakers.alphabeticalOrder * 0.00000001);

    overallScore = Math.round((overallScore + tiebreakerAdjustment) * 1000) / 1000;

    return {
      tool_id: metrics.tool_id,
      tool_slug: metrics.slug,
      overallScore,
      factorScores,
      tiebreakers,
      dataCompleteness,
      confidenceMultiplier,
      sentimentAnalysis:
        newsImpact && !Number.isNaN(newsImpact.totalImpact)
          ? {
              rawSentiment: 0,
              adjustedSentiment: 0,
              newsImpact: newsImpact.totalImpact,
            }
          : undefined,
      algorithm_version: ALGORITHM_VERSION,
    };
  }

  /**
   * Get algorithm metadata
   */
  static getAlgorithmInfo() {
    return {
      version: ALGORITHM_VERSION,
      name: "Data-Driven Confidence Scoring with Missing Data Penalty",
      description: "Penalizes tools lacking real-world metrics. Tools with verified data (GitHub, VS Code, npm, revenue) rank higher than those with only descriptions. Agentic capability blends two benchmark signals: SWE-bench Verified and Terminal-Bench (terminal-bench 2.1).",
      weights: ALGORITHM_V76_WEIGHTS,
      features: [
        "Data completeness scoring system (0-100%)",
        "Confidence multiplier: 0.7 (no data) to 1.0 (complete data)",
        "High-value metrics: GitHub stars, VS Code installs, npm downloads (25 pts each)",
        "Medium-value metrics: User count, revenue, SWE-bench (15 pts each)",
        "Low-value metrics: Description, features, company info, pricing (10 pts each)",
        `Agentic capability blends SWE-bench + Terminal-Bench (default 0.6/${TB_BLEND_WEIGHT} split; whichever exists when only one is present)`,
        `SWE-bench normalized against a ${SWE_BENCH_ANCHOR}% anchor so leaders stay unsaturated; heuristic bonuses fill remaining headroom (never re-cap the blend to 100)`,
        "All v7.3 features: Tiebreakers, differentiation, determinism",
        "Target: Data-backed tools rank higher than unverified tools",
        "Target: <20% duplicate scores, Top 10 all unique",
      ],
      updatedAt: "2026-07-18",
      improvements: [
        "Rewards tools with real-world verification metrics",
        "Penalizes tools with limited/missing data",
        "GitHub Copilot, Cursor, Claude Code benefit from real metrics",
        "Jules, Refact.ai penalized for lacking verification data",
        "Confidence-based scoring ensures data quality matters",
        "Maintains all v7.3 improvements for score differentiation",
      ],
    };
  }
}
