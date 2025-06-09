import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { RankingEngineV6, ToolMetricsV6, Innovation } from "@/lib/ranking-algorithm-v6";

const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"] || "";
const supabaseKey = process.env["SUPABASE_SERVICE_ROLE_KEY"] || "";
const supabase = createClient(supabaseUrl, supabaseKey);

// Business model mappings
const BUSINESS_MODEL_MAP: Record<string, string> = {
  cursor: "consumer_premium",
  "github-copilot": "enterprise_standard",
  devin: "consumer_premium",
  "v0-vercel": "freemium",
  "bolt-new": "consumer_premium",
  "claude-code": "consumer_premium",
  openhands: "open_source_donations",
  aider: "open_source_donations",
  cline: "open_source_donations",
  jules: "enterprise_standard",
  lovable: "consumer_premium",
  windsurf: "consumer_premium",
  "claude-artifacts": "freemium",
  "chatgpt-canvas": "freemium",
  "diffblue-cover": "enterprise_high_acv",
  zed: "open_source_donations",
};

// Risk factors by tool
const RISK_FACTORS_MAP: Record<string, string[]> = {
  windsurf: ["acquired_by_llm_provider", "exclusive_llm_dependency"],
  devin: ["funding_distress"],
  "github-copilot": ["multi_llm_support"],
  cursor: ["multi_llm_support"],
  "claude-code": ["multi_llm_support", "open_source_llm_ready"],
  openhands: ["multi_llm_support", "open_source_llm_ready", "self_hosted_option"],
  aider: ["multi_llm_support", "open_source_llm_ready", "self_hosted_option"],
  cline: ["multi_llm_support", "open_source_llm_ready", "self_hosted_option"],
  zed: ["multi_llm_support", "self_hosted_option"],
};

// Innovation dates and scores
const INNOVATIONS_MAP: Record<string, Innovation[]> = {
  cursor: [
    { score: 8, date: new Date("2024-03-01"), description: ".cursorrules for team standards" },
  ],
  devin: [{ score: 9, date: new Date("2024-03-01"), description: "Autonomous development agent" }],
  "v0-vercel": [{ score: 8, date: new Date("2024-12-01"), description: "MCP protocol innovation" }],
  "claude-artifacts": [
    { score: 8.5, date: new Date("2024-07-01"), description: "Interactive component generation" },
  ],
  windsurf: [
    { score: 7.5, date: new Date("2024-10-01"), description: "Advanced multi-agent flows" },
  ],
  zed: [{ score: 7.5, date: new Date("2024-01-01"), description: "GPU-accelerated architecture" }],
  jules: [{ score: 7, date: new Date("2024-11-01"), description: "Autonomous PR management" }],
  "bolt-new": [
    { score: 6.5, date: new Date("2024-08-01"), description: "Full-stack app generation" },
  ],
  cline: [{ score: 6, date: new Date("2024-09-01"), description: "CLI-based autonomous coding" }],
  lovable: [{ score: 5.5, date: new Date("2024-10-01"), description: "Natural language to app" }],
  openhands: [{ score: 5.5, date: new Date("2024-06-01"), description: "Docker-based execution" }],
  aider: [{ score: 5, date: new Date("2024-05-01"), description: "Git-aware pair programming" }],
  "github-copilot": [
    { score: 4, date: new Date("2023-06-01"), description: "Multi-model support" },
  ],
  "chatgpt-canvas": [
    { score: 4.5, date: new Date("2024-10-01"), description: "Interactive code editing" },
  ],
  "diffblue-cover": [
    { score: 6, date: new Date("2023-01-01"), description: "Automated Java testing" },
  ],
};

// Enhanced capability scores
const ENHANCED_CAPABILITIES: Record<string, Partial<ToolMetricsV6>> = {
  "claude-code": {
    agentic_capability: 9.0,
    multi_file_capability: 9,
    planning_depth: 9,
    context_utilization: 8,
    context_window: 200000,
    language_support: 20,
  },
  cursor: {
    agentic_capability: 8.0,
    multi_file_capability: 8,
    planning_depth: 7,
    context_utilization: 8,
    context_window: 200000,
    language_support: 15,
  },
  devin: {
    agentic_capability: 9.5,
    multi_file_capability: 10,
    planning_depth: 10,
    context_utilization: 9,
    context_window: 150000,
    language_support: 12,
  },
  windsurf: {
    agentic_capability: 8.5,
    multi_file_capability: 8,
    planning_depth: 8,
    context_utilization: 8,
    context_window: 180000,
    language_support: 15,
  },
  jules: {
    agentic_capability: 8.0,
    multi_file_capability: 8,
    planning_depth: 8,
    context_utilization: 7,
    context_window: 150000,
    language_support: 12,
  },
  openhands: {
    agentic_capability: 7.5,
    multi_file_capability: 7,
    planning_depth: 7,
    context_utilization: 7,
    context_window: 120000,
    language_support: 15,
  },
  cline: {
    agentic_capability: 7.0,
    multi_file_capability: 7,
    planning_depth: 6,
    context_utilization: 6,
    context_window: 100000,
    language_support: 12,
  },
  aider: {
    agentic_capability: 7.0,
    multi_file_capability: 6,
    planning_depth: 6,
    context_utilization: 7,
    context_window: 100000,
    language_support: 10,
  },
  "github-copilot": {
    agentic_capability: 5.0,
    multi_file_capability: 4,
    planning_depth: 3,
    context_utilization: 5,
    context_window: 80000,
    language_support: 20,
  },
  "bolt-new": {
    agentic_capability: 6.0,
    multi_file_capability: 5,
    planning_depth: 5,
    context_utilization: 6,
    context_window: 100000,
    language_support: 8,
  },
  zed: {
    agentic_capability: 4.5,
    multi_file_capability: 6,
    planning_depth: 4,
    context_utilization: 5,
    context_window: 100000,
    language_support: 12,
  },
  lovable: {
    agentic_capability: 5.5,
    multi_file_capability: 5,
    planning_depth: 5,
    context_utilization: 5,
    context_window: 80000,
    language_support: 8,
  },
  "claude-artifacts": {
    agentic_capability: 6.0,
    multi_file_capability: 4,
    planning_depth: 5,
    context_utilization: 6,
    context_window: 200000,
    language_support: 15,
  },
  "chatgpt-canvas": {
    agentic_capability: 6.5,
    multi_file_capability: 5,
    planning_depth: 5,
    context_utilization: 6,
    context_window: 120000,
    language_support: 15,
  },
  "diffblue-cover": {
    agentic_capability: 7.0,
    multi_file_capability: 6,
    planning_depth: 6,
    context_utilization: 7,
    context_window: 50000,
    language_support: 1,
  },
};

async function getToolMetrics(): Promise<ToolMetricsV6[]> {
  // Get all tools
  const { data: tools } = await supabase
    .from("tools")
    .select("id, name, slug, category, status, info")
    .in("status", ["active", "beta", "acquired"]);

  if (!tools) {
    return [];
  }

  // Get latest metrics for all tools
  const { data: metrics } = await supabase
    .from("metrics_history")
    .select("*")
    .order("recorded_at", { ascending: false });

  if (!metrics) {
    return [];
  }

  // Group metrics by tool and get latest values
  const toolMetrics = new Map<string, Record<string, { value: unknown; recorded_at: string }>>();

  for (const metric of metrics) {
    if (!toolMetrics.has(metric.tool_id)) {
      toolMetrics.set(metric.tool_id, {});
    }

    let current = toolMetrics.get(metric.tool_id);
    if (!current) {
      current = {};
      toolMetrics.set(metric.tool_id, current);
    }
    const existingMetric = current[metric.metric_key];
    if (!existingMetric || metric.recorded_at > existingMetric.recorded_at) {
      current[metric.metric_key] = {
        value:
          metric.value_integer || metric.value_decimal || metric.value_boolean || metric.value_json,
        recorded_at: metric.recorded_at,
      };
    }
  }

  // Convert to ToolMetricsV6 format
  const toolMetricsV6: ToolMetricsV6[] = [];

  for (const tool of tools) {
    const metrics = toolMetrics.get(tool.id) || {};
    const enhancements = ENHANCED_CAPABILITIES[tool.id] || {};

    // Extract metric values
    const getValue = (key: string, defaultValue = 0): number => {
      const metricValue = metrics[key]?.value;
      if (typeof metricValue === "number") {
        return metricValue;
      }
      return defaultValue;
    };

    toolMetricsV6.push({
      tool_id: tool.id,
      status: tool.status,

      // Agentic metrics - use enhanced values
      agentic_capability: enhancements.agentic_capability || getValue("agentic_capability", 3),
      swe_bench_score: getValue("swe_bench_score"),
      multi_file_capability:
        enhancements.multi_file_capability || getValue("multi_file_capability", 5),
      planning_depth: enhancements.planning_depth || getValue("planning_depth", 5),
      context_utilization: enhancements.context_utilization || getValue("context_utilization", 5),

      // Technical metrics - use enhanced values
      context_window: enhancements.context_window || getValue("context_window", 100000),
      language_support: enhancements.language_support || getValue("language_support", 10),
      github_stars: getValue("github_stars"),

      // Innovation metrics
      innovation_score: getValue("innovation_score", 5),
      innovations: INNOVATIONS_MAP[tool.id] || [],

      // Market metrics
      estimated_users: getValue("estimated_users"),
      monthly_arr: getValue("monthly_arr"),
      valuation: getValue("valuation"),
      funding: getValue("funding"),
      business_model: BUSINESS_MODEL_MAP[tool.id] || "freemium",

      // Risk and sentiment
      business_sentiment: getValue("business_sentiment", 0.5),
      risk_factors: RISK_FACTORS_MAP[tool.id] || [],

      // Development metrics
      release_frequency: getValue("release_frequency", 2),
      github_contributors: getValue("github_contributors", 10),

      // Platform metrics
      llm_provider_count: getValue("llm_provider_count", 1),
      multi_model_support: metrics["multi_model_support"]?.value as boolean | undefined,
      community_size: getValue("community_size", getValue("estimated_users") / 10),
    });
  }

  return toolMetricsV6;
}

export async function GET(): Promise<NextResponse> {
  try {
    const engine = new RankingEngineV6();
    const toolMetrics = await getToolMetrics();
    const currentDate = new Date("2025-06-09");

    // Calculate scores for all tools
    const rankings = toolMetrics
      .map((metrics) => ({
        metrics,
        score: engine.calculateToolScore(metrics, currentDate),
      }))
      .filter(({ score }) => score.validationStatus.isValid)
      .sort((a, b) => b.score.overallScore - a.score.overallScore);

    // Get tool details
    const toolIds = rankings.map((r) => r.metrics.tool_id);
    const { data: tools } = await supabase
      .from("tools")
      .select("id, name, slug, category, status, info")
      .in("id", toolIds);

    const toolMap = new Map(tools?.map((t) => [t.id, t]) || []);

    // Format response
    const formattedRankings = rankings
      .map((ranking, index) => {
        const tool = toolMap.get(ranking.metrics.tool_id);
        if (!tool) {
          return null;
        }

        // Fix tool names
        let displayName = tool.name;
        if (tool.id === "claude-artifacts") {
          displayName = "Claude.ai";
        }

        return {
          rank: index + 1,
          tool: {
            id: tool.id,
            name: displayName,
            category: tool.category,
            status: tool.status,
          },
          scores: {
            overall: ranking.score.overallScore,
            agentic_capability: ranking.score.factorScores.agenticCapability,
            innovation: ranking.score.factorScores.innovation,
            technical_performance: ranking.score.factorScores.technicalPerformance,
            developer_adoption: ranking.score.factorScores.developerAdoption,
            market_traction: ranking.score.factorScores.marketTraction,
            business_sentiment: ranking.score.factorScores.businessSentiment,
            development_velocity: ranking.score.factorScores.developmentVelocity,
            platform_resilience: ranking.score.factorScores.platformResilience,
          },
          metrics: {
            users: ranking.metrics.estimated_users,
            monthly_arr: ranking.metrics.monthly_arr,
            swe_bench_score: ranking.metrics.swe_bench_score,
            github_stars: ranking.metrics.github_stars,
          },
          modifiers: {
            innovation_decay: ranking.score.modifiers.innovationDecay,
            platform_risk: ranking.score.modifiers.platformRisk,
            revenue_quality: ranking.score.modifiers.revenueQuality,
          },
        };
      })
      .filter(Boolean);

    return NextResponse.json({
      rankings: formattedRankings,
      algorithm: {
        version: "v6.0",
        name: "Code-Ready Modifiers",
        date: currentDate.toISOString(),
      },
    });
  } catch (error) {
    console.error("Error fetching rankings:", error);
    return NextResponse.json({ error: "Failed to fetch rankings" }, { status: 500 });
  }
}
