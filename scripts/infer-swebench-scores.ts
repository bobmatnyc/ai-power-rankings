/**
 * SWE-bench Score Inference Script
 *
 * Estimates SWE-bench Verified scores for AI coding tools based on:
 * - Base LLM capabilities
 * - Architecture multipliers
 * - Feature bonuses
 * - Confidence scoring
 *
 * Research documented in: docs/research/swe-bench-inference/
 */

import fs from "fs";
import path from "path";

// ============================================================================
// Type Definitions
// ============================================================================

type ConfidenceLevel = "high" | "medium" | "low" | "very_low";

type ArchitectureType =
  | "autonomous_agent"
  | "agent_framework"
  | "ide_agentic"
  | "ide_completion"
  | "cli_tool"
  | "specialized_testing"
  | "specialized_debug"
  | "specialized_review"
  | "unknown";

interface FeatureSet {
  // Execution & Testing
  code_execution?: "full" | "limited" | "none";
  test_automation?: "full" | "basic" | "none";
  debugging?: "automated" | "basic" | "none";

  // Codebase Understanding
  codebase_indexing?: "full" | "basic" | "none";
  multi_file_editing?: "atomic" | "sequential" | "basic" | "none";
  context_window?: number; // in thousands (e.g., 200 for 200K)
  project_memory?: "advanced" | "basic" | "none";

  // Planning & Reasoning
  planning?: "advanced" | "basic" | "none";
  self_correction?: "loops" | "basic" | "none";
  chain_of_thought?: "enforced" | "optional" | "none";
  multiple_approaches?: "evaluated" | "basic" | "none";

  // Quality & Safety
  error_recovery?: "comprehensive" | "basic" | "none";
  code_quality_checks?: "full" | "basic" | "none";
  security_scanning?: boolean;

  // Workflow Integration
  git_integration?: "full" | "basic" | "none";
  terminal_access?: "full" | "limited" | "none";
  browser_automation?: boolean;
}

interface ToolInput {
  id: string;
  name: string;
  primary_model?: string;
  model_mixture?: Array<{ model: string; weight: number }>;
  architecture: ArchitectureType;
  features: FeatureSet;

  // Metadata for confidence
  has_published_benchmark?: boolean;
  known_score?: number;
  has_detailed_docs?: boolean;
  is_open_source?: boolean;
  marketing_claims_only?: boolean;
  novel_approach?: boolean;
  months_since_launch?: number;
}

interface SWEBenchEstimate {
  tool_id: string;
  tool_name: string;
  estimated_score: number;
  confidence_level: ConfidenceLevel;
  range: {
    lower: number;
    upper: number;
  };
  reasoning: {
    base_model: string;
    base_score: number;
    architecture: string;
    architecture_multiplier: number;
    feature_bonus_percent: number;
    feature_details: string[];
    calculation: string;
    calibrations_applied: string[];
  };
  validation?: {
    known_score: number;
    error: number;
    error_percentage: number;
  };
  metadata: {
    generated_at: string;
    model_version: string;
  };
}

// ============================================================================
// Data Tables
// ============================================================================

const LLM_BASE_SCORES: Record<string, number> = {
  // Claude models
  "claude-4.5-sonnet": 77.0,
  "claude-4-opus": 72.5,
  "claude-4-sonnet": 72.7,
  "claude-3.7-sonnet": 62.3,
  "claude-3.5-sonnet-20241022": 49.0, // Oct 2024 upgrade
  "claude-3.5-sonnet": 33.4, // Original June 2024
  "claude-3.5-haiku": 35.6,

  // GPT models
  "gpt-5": 74.9,
  "gpt-5-mini": 59.8,
  "gpt-4.1": 54.0,
  "gpt-4o": 30.0,
  "o1": 64.6,
  "o3": 72.0,

  // Gemini models
  "gemini-2.5-pro": 63.8,
  "gemini-2.0-flash": 45.0,
  "gemini-1.5-pro": 38.0,

  // Open source
  "llama-3.1-405b": 25.0,
  "deepseek-coder": 18.0,
  "qwen-coder": 22.0,

  // Proprietary coding models
  "swe-1.5": 60.0, // Windsurf estimate (Claude 3.7 level claimed)
  "composer": 52.0, // Cursor estimate (optimized Claude 3.5 Sonnet)

  // Fallbacks
  frontier: 60.0,
  midtier: 40.0,
  basic: 25.0,
};

const ARCHITECTURE_MULTIPLIERS: Record<
  ArchitectureType,
  { default: number; min: number; max: number }
> = {
  autonomous_agent: { default: 1.1, min: 0.95, max: 1.2 },
  agent_framework: { default: 0.95, min: 0.85, max: 1.1 },
  ide_agentic: { default: 0.8, min: 0.7, max: 0.9 },
  ide_completion: { default: 0.5, min: 0.4, max: 0.6 },
  cli_tool: { default: 0.7, min: 0.6, max: 0.85 },
  specialized_testing: { default: 0.75, min: 0.7, max: 0.85 },
  specialized_debug: { default: 0.65, min: 0.6, max: 0.75 },
  specialized_review: { default: 0.6, min: 0.55, max: 0.7 },
  unknown: { default: 0.7, min: 0.6, max: 0.8 },
};

const MAX_FEATURE_BONUS_BY_ARCHITECTURE: Record<string, number> = {
  autonomous_agent: 0.5,
  agent_framework: 0.5,
  ide_agentic: 0.35,
  ide_completion: 0.15,
  cli_tool: 0.35,
  specialized_testing: 0.3,
  specialized_debug: 0.3,
  specialized_review: 0.3,
  unknown: 0.35,
};

// ============================================================================
// Feature Bonus Calculation
// ============================================================================

function calculateExecutionBonus(features: FeatureSet): number {
  let bonus = 0;

  if (features.code_execution === "full") bonus += 0.15;
  else if (features.code_execution === "limited") bonus += 0.1;

  if (features.test_automation === "full") bonus += 0.2;
  else if (features.test_automation === "basic") bonus += 0.15;

  if (features.debugging === "automated") bonus += 0.1;
  else if (features.debugging === "basic") bonus += 0.05;

  // Apply category cap
  return Math.min(bonus, 0.25);
}

function calculateCodebaseBonus(features: FeatureSet): number {
  let bonus = 0;

  if (features.codebase_indexing === "full") bonus += 0.15;
  else if (features.codebase_indexing === "basic") bonus += 0.1;

  if (features.multi_file_editing === "atomic") bonus += 0.1;
  else if (features.multi_file_editing === "sequential") bonus += 0.08;
  else if (features.multi_file_editing === "basic") bonus += 0.05;

  if (features.context_window) {
    if (features.context_window >= 200) bonus += 0.15;
    else if (features.context_window >= 100) bonus += 0.12;
    else if (features.context_window >= 50) bonus += 0.08;
    else if (features.context_window >= 32) bonus += 0.05;
  }

  if (features.project_memory === "advanced") bonus += 0.08;
  else if (features.project_memory === "basic") bonus += 0.05;

  // Apply category cap (accounting for overlap between indexing and context)
  return Math.min(bonus, 0.2);
}

function calculatePlanningBonus(features: FeatureSet): number {
  let bonus = 0;

  if (features.planning === "advanced") bonus += 0.15;
  else if (features.planning === "basic") bonus += 0.1;

  if (features.self_correction === "loops") bonus += 0.12;
  else if (features.self_correction === "basic") bonus += 0.08;

  if (features.chain_of_thought === "enforced") bonus += 0.08;
  else if (features.chain_of_thought === "optional") bonus += 0.05;

  if (features.multiple_approaches === "evaluated") bonus += 0.1;
  else if (features.multiple_approaches === "basic") bonus += 0.05;

  // Apply category cap
  return Math.min(bonus, 0.2);
}

function calculateQualityBonus(features: FeatureSet): number {
  let bonus = 0;

  if (features.error_recovery === "comprehensive") bonus += 0.1;
  else if (features.error_recovery === "basic") bonus += 0.05;

  if (features.code_quality_checks === "full") bonus += 0.08;
  else if (features.code_quality_checks === "basic") bonus += 0.05;

  if (features.security_scanning) bonus += 0.05;

  // Apply category cap
  return Math.min(bonus, 0.12);
}

function calculateWorkflowBonus(features: FeatureSet): number {
  let bonus = 0;

  if (features.git_integration === "full") bonus += 0.08;
  else if (features.git_integration === "basic") bonus += 0.05;

  if (features.terminal_access === "full") bonus += 0.1;
  else if (features.terminal_access === "limited") bonus += 0.05;

  if (features.browser_automation) bonus += 0.08;

  // Apply category cap
  return Math.min(bonus, 0.15);
}

function calculateTotalFeatureBonus(
  features: FeatureSet,
  architecture: ArchitectureType
): { bonus: number; details: string[] } {
  const executionBonus = calculateExecutionBonus(features);
  const codebaseBonus = calculateCodebaseBonus(features);
  const planningBonus = calculatePlanningBonus(features);
  const qualityBonus = calculateQualityBonus(features);
  const workflowBonus = calculateWorkflowBonus(features);

  let totalBonus =
    executionBonus + codebaseBonus + planningBonus + qualityBonus + workflowBonus;

  // Apply architecture-specific cap
  const archMax = MAX_FEATURE_BONUS_BY_ARCHITECTURE[architecture] || 0.35;
  const cappedBonus = Math.min(totalBonus, archMax);

  // Build feature details
  const details: string[] = [];
  if (executionBonus > 0)
    details.push(`Execution: +${Math.round(executionBonus * 100)}%`);
  if (codebaseBonus > 0)
    details.push(`Codebase: +${Math.round(codebaseBonus * 100)}%`);
  if (planningBonus > 0)
    details.push(`Planning: +${Math.round(planningBonus * 100)}%`);
  if (qualityBonus > 0) details.push(`Quality: +${Math.round(qualityBonus * 100)}%`);
  if (workflowBonus > 0)
    details.push(`Workflow: +${Math.round(workflowBonus * 100)}%`);

  if (cappedBonus < totalBonus) {
    details.push(
      `(Capped from ${Math.round(totalBonus * 100)}% to ${Math.round(cappedBonus * 100)}%)`
    );
  }

  return { bonus: cappedBonus, details };
}

// ============================================================================
// Base Score Calculation
// ============================================================================

function getBaseLLMScore(tool: ToolInput): { score: number; model: string } {
  // Single model
  if (tool.primary_model) {
    const score = LLM_BASE_SCORES[tool.primary_model] || LLM_BASE_SCORES.frontier;
    return { score, model: tool.primary_model };
  }

  // Model mixture
  if (tool.model_mixture && tool.model_mixture.length > 0) {
    const weightedScore = tool.model_mixture.reduce((sum, item) => {
      const modelScore = LLM_BASE_SCORES[item.model] || LLM_BASE_SCORES.midtier;
      return sum + modelScore * item.weight;
    }, 0);

    const modelNames = tool.model_mixture.map((m) => m.model).join(" + ");
    return { score: weightedScore, model: modelNames };
  }

  // Unknown - use frontier default
  return { score: LLM_BASE_SCORES.frontier, model: "unknown (frontier assumed)" };
}

// ============================================================================
// Confidence Calculation
// ============================================================================

function calculateConfidence(tool: ToolInput): {
  level: ConfidenceLevel;
  margin: number;
} {
  let score = 0;

  // Positive factors
  if (tool.has_published_benchmark) score += 40;
  if (tool.has_detailed_docs) score += 20;
  if (tool.is_open_source) score += 10;

  // Negative factors
  if (tool.marketing_claims_only) score -= 20;
  if (tool.novel_approach) score -= 10;

  // Architecture confidence
  if (tool.architecture !== "unknown") score += 15;

  if (score >= 70) return { level: "high", margin: 0.05 };
  if (score >= 40) return { level: "medium", margin: 0.1 };
  if (score >= 20) return { level: "low", margin: 0.15 };
  return { level: "very_low", margin: 0.2 };
}

// ============================================================================
// Calibrations
// ============================================================================

function applyCalibrations(
  rawScore: number,
  baseScore: number,
  tool: ToolInput
): { score: number; calibrations: string[] } {
  let adjustedScore = rawScore;
  const calibrations: string[] = [];

  // Calibration 1: IDE Assistant Ceiling
  if (tool.architecture === "ide_agentic" || tool.architecture === "ide_completion") {
    const ceiling = baseScore * 0.95;
    if (adjustedScore > ceiling) {
      calibrations.push(`IDE ceiling: capped at 95% of base (${ceiling.toFixed(1)}%)`);
      adjustedScore = ceiling;
    }
  }

  // Calibration 2: Feature Bonus Reduction for Agents
  if (
    tool.architecture === "autonomous_agent" ||
    tool.architecture === "agent_framework"
  ) {
    // Already applied through feature bonus calculation
    calibrations.push("Agent baseline assumes core features");
  }

  // Calibration 3: Novel Architecture Penalty
  if (tool.novel_approach && tool.months_since_launch !== undefined) {
    if (tool.months_since_launch < 6) {
      adjustedScore *= 0.7;
      calibrations.push("Novel approach penalty: -30% (first 6 months)");
    } else if (tool.months_since_launch < 12) {
      adjustedScore *= 0.85;
      calibrations.push("Novel approach penalty: -15% (6-12 months)");
    }
  }

  // Calibration 4: Marketing Discount
  if (tool.marketing_claims_only) {
    adjustedScore *= 0.9;
    calibrations.push("Marketing claims discount: -10%");
  }

  // Calibration 5: Reasonable bounds
  adjustedScore = Math.max(5, Math.min(adjustedScore, 85)); // 5-85% range
  if (rawScore !== adjustedScore && calibrations.length === 0) {
    calibrations.push("Bounded to reasonable range (5-85%)");
  }

  return { score: adjustedScore, calibrations };
}

// ============================================================================
// Main Inference Function
// ============================================================================

export function inferSWEBenchScore(tool: ToolInput): SWEBenchEstimate {
  // Step 1: Get base LLM score
  const { score: baseScore, model: baseModel } = getBaseLLMScore(tool);

  // Step 2: Get architecture multiplier
  const archMultiplier =
    ARCHITECTURE_MULTIPLIERS[tool.architecture]?.default ||
    ARCHITECTURE_MULTIPLIERS.unknown.default;

  // Step 3: Calculate feature bonuses
  const { bonus: featureBonus, details: featureDetails } = calculateTotalFeatureBonus(
    tool.features,
    tool.architecture
  );

  // Step 4: Calculate raw estimate
  const rawEstimate = baseScore * archMultiplier * (1 + featureBonus);

  // Step 5: Apply calibrations
  const { score: calibratedScore, calibrations } = applyCalibrations(
    rawEstimate,
    baseScore,
    tool
  );

  // Step 6: Calculate confidence
  const confidence = calculateConfidence(tool);

  // Step 7: Calculate range
  const lowerBound = calibratedScore * (1 - confidence.margin);
  const upperBound = calibratedScore * (1 + confidence.margin);

  // Step 8: Build result
  const result: SWEBenchEstimate = {
    tool_id: tool.id,
    tool_name: tool.name,
    estimated_score: Math.round(calibratedScore * 10) / 10,
    confidence_level: confidence.level,
    range: {
      lower: Math.round(lowerBound * 10) / 10,
      upper: Math.round(upperBound * 10) / 10,
    },
    reasoning: {
      base_model: baseModel,
      base_score: Math.round(baseScore * 10) / 10,
      architecture: tool.architecture,
      architecture_multiplier: archMultiplier,
      feature_bonus_percent: Math.round(featureBonus * 100),
      feature_details: featureDetails,
      calculation: `${baseScore.toFixed(1)} × ${archMultiplier} × ${(1 + featureBonus).toFixed(2)} = ${rawEstimate.toFixed(1)}${
        calibrations.length > 0 ? ` → ${calibratedScore.toFixed(1)}` : ""
      }`,
      calibrations_applied: calibrations,
    },
    metadata: {
      generated_at: new Date().toISOString(),
      model_version: "1.0",
    },
  };

  // Add validation if known score available
  if (tool.known_score !== undefined) {
    const error = Math.abs(result.estimated_score - tool.known_score);
    result.validation = {
      known_score: tool.known_score,
      error: Math.round(error * 10) / 10,
      error_percentage: Math.round((error / tool.known_score) * 1000) / 10,
    };
  }

  return result;
}

// ============================================================================
// Batch Processing
// ============================================================================

export function inferBatchScores(tools: ToolInput[]): SWEBenchEstimate[] {
  return tools.map(inferSWEBenchScore);
}

// ============================================================================
// Output Formatting
// ============================================================================

export function formatEstimateTable(estimates: SWEBenchEstimate[]): string {
  const sorted = [...estimates].sort((a, b) => b.estimated_score - a.estimated_score);

  let output = "# SWE-bench Score Estimates\n\n";
  output += `Generated: ${new Date().toISOString()}\n\n`;
  output += "| Rank | Tool | Est. Score | Range | Confidence | Base Model |\n";
  output += "|------|------|-----------|-------|------------|------------|\n";

  sorted.forEach((est, idx) => {
    output += `| ${idx + 1} | ${est.tool_name} | ${est.estimated_score}% | ${est.range.lower}-${est.range.upper}% | ${est.confidence_level} | ${est.reasoning.base_model} |\n`;
  });

  output += "\n\n## Detailed Reasoning\n\n";

  sorted.forEach((est) => {
    output += `### ${est.tool_name} (${est.estimated_score}%)\n\n`;
    output += `**Confidence:** ${est.confidence_level} (±${((1 - (est.range.lower / est.estimated_score)) * 100).toFixed(0)}%)\n\n`;
    output += `**Calculation:**\n`;
    output += `- Base Model: ${est.reasoning.base_model} (${est.reasoning.base_score}%)\n`;
    output += `- Architecture: ${est.reasoning.architecture} (${est.reasoning.architecture_multiplier}x)\n`;
    output += `- Feature Bonus: +${est.reasoning.feature_bonus_percent}%\n`;

    if (est.reasoning.feature_details.length > 0) {
      output += `  - ${est.reasoning.feature_details.join("\n  - ")}\n`;
    }

    output += `- Formula: ${est.reasoning.calculation}\n`;

    if (est.reasoning.calibrations_applied.length > 0) {
      output += `\n**Calibrations:**\n`;
      est.reasoning.calibrations_applied.forEach((cal) => {
        output += `- ${cal}\n`;
      });
    }

    if (est.validation) {
      output += `\n**Validation:**\n`;
      output += `- Known Score: ${est.validation.known_score}%\n`;
      output += `- Error: ${est.validation.error}% (${est.validation.error_percentage}%)\n`;
    }

    output += "\n---\n\n";
  });

  return output;
}

// ============================================================================
// CLI Entry Point
// ============================================================================

async function main() {
  console.log("SWE-bench Score Inference Tool\n");

  // Example tools for demonstration
  const exampleTools: ToolInput[] = [
    {
      id: "cursor",
      name: "Cursor",
      primary_model: "claude-3.5-sonnet-20241022",
      architecture: "ide_agentic",
      features: {
        code_execution: "limited",
        codebase_indexing: "full",
        multi_file_editing: "atomic",
        context_window: 200,
        planning: "basic",
        git_integration: "full",
        terminal_access: "limited",
      },
      has_detailed_docs: true,
      marketing_claims_only: false,
    },
    {
      id: "windsurf",
      name: "Windsurf",
      primary_model: "swe-1.5",
      architecture: "ide_agentic",
      features: {
        code_execution: "limited",
        codebase_indexing: "full",
        multi_file_editing: "atomic",
        context_window: 100,
        planning: "basic",
        git_integration: "basic",
        terminal_access: "full",
      },
      has_detailed_docs: true,
      marketing_claims_only: true,
    },
    {
      id: "copilot",
      name: "GitHub Copilot",
      primary_model: "gpt-4.1",
      architecture: "ide_completion",
      features: {
        code_execution: "none",
        codebase_indexing: "basic",
        multi_file_editing: "basic",
        context_window: 32,
        code_quality_checks: "basic",
      },
      has_detailed_docs: true,
      has_published_benchmark: false,
    },
    {
      id: "aider",
      name: "Aider",
      primary_model: "gpt-4.1",
      architecture: "cli_tool",
      features: {
        code_execution: "limited",
        multi_file_editing: "sequential",
        planning: "basic",
        git_integration: "full",
        terminal_access: "full",
      },
      has_detailed_docs: true,
      is_open_source: true,
      known_score: 26.3, // SWE-bench Lite
    },
  ];

  const estimates = inferBatchScores(exampleTools);

  // Output JSON
  const jsonOutput = path.join(
    process.cwd(),
    "docs/research/swe-bench-inference/estimates.json"
  );
  fs.writeFileSync(jsonOutput, JSON.stringify(estimates, null, 2));
  console.log(`✅ JSON output: ${jsonOutput}`);

  // Output Markdown table
  const mdOutput = path.join(
    process.cwd(),
    "docs/research/swe-bench-inference/estimates.md"
  );
  fs.writeFileSync(mdOutput, formatEstimateTable(estimates));
  console.log(`✅ Markdown output: ${mdOutput}`);

  // Console summary
  console.log("\n📊 Estimates Summary:\n");
  estimates
    .sort((a, b) => b.estimated_score - a.estimated_score)
    .forEach((est, idx) => {
      console.log(
        `${idx + 1}. ${est.tool_name}: ${est.estimated_score}% (${est.confidence_level})`
      );
    });

  console.log("\n✅ Inference complete!");
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}
