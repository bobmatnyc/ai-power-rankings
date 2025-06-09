import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"] || "";
const supabaseKey = process.env["SUPABASE_SERVICE_ROLE_KEY"] || "";
const supabase = createClient(supabaseUrl, supabaseKey);

type Params = {
  params: Promise<{
    slug: string;
  }>;
};

export async function GET(_request: Request, { params }: Params): Promise<NextResponse> {
  try {
    const { slug } = await params;

    // Get tool details with info JSON
    const { data: tool, error: toolError } = await supabase
      .from("tools")
      .select("*")
      .eq("slug", slug)
      .single();

    if (toolError || !tool) {
      return NextResponse.json({ error: "Tool not found" }, { status: 404 });
    }

    // Ensure tool has info structure
    if (!tool.info || typeof tool.info !== "object") {
      tool.info = {
        company: { name: tool.company_name || "" },
        product: {
          description: tool.description,
          tagline: tool.tagline,
          pricing_model: tool.pricing_model,
          license_type: tool.license_type,
        },
        links: {
          website: tool.website_url,
          github: tool.github_repo,
        },
        metadata: {
          logo_url: tool.logo_url,
        },
      };
    }

    // Get latest metrics from metrics_sources via the tool_metrics view
    const { data: toolMetrics } = await supabase
      .rpc("get_tool_metrics_history", { p_tool_id: tool.id })
      .limit(20);

    // Get latest scoring metrics
    const { data: latestScoringMetrics } = await supabase
      .from("latest_scoring_metrics")
      .select("metrics")
      .eq("tool_id", tool.id)
      .single();

    // Process latest metrics for display
    const latestMetrics: Record<string, unknown> = {};
    if (latestScoringMetrics?.metrics) {
      Object.entries(latestScoringMetrics.metrics).forEach(
        ([key, metric]: [string, { value: number }]) => {
          latestMetrics[key] = metric.value;
        }
      );
    }

    // Get ranking data from ranking_cache
    const { data: rankingData } = await supabase
      .from("ranking_cache")
      .select(
        `
        position,
        score,
        market_traction_score,
        technical_capability_score,
        developer_adoption_score,
        development_velocity_score,
        platform_resilience_score,
        community_sentiment_score,
        period
      `
      )
      .eq("tool_id", tool.id)
      .eq("period", "2025-06")
      .single();

    let ranking = null;
    if (rankingData) {
      ranking = {
        rank: rankingData.position,
        scores: {
          overall: rankingData.score,
          agentic_capability: (latestMetrics["agentic_capability"] as number) || 5,
          innovation: (latestMetrics["innovation_score"] as number) || 5,
          technical_performance: rankingData.technical_capability_score || 5,
          developer_adoption: rankingData.developer_adoption_score || 5,
          market_traction: rankingData.market_traction_score || 5,
          business_sentiment: rankingData.community_sentiment_score || 5,
          development_velocity: rankingData.development_velocity_score || 5,
          platform_resilience: rankingData.platform_resilience_score || 5,
        },
      };
    }

    // Format metric history for the UI
    const metricHistory =
      toolMetrics?.map(
        (tm: {
          published_date: string;
          source_name: string;
          source_url: string;
          metrics: Record<string, unknown>;
        }) => ({
          metric_date: tm.published_date,
          source_name: tm.source_name,
          source_url: tm.source_url,
          metrics: tm.metrics,
          scoring_metrics: tm.metrics, // In the view, all metrics are scoring-relevant
          published_date: tm.published_date,
        })
      ) || [];

    return NextResponse.json({
      tool,
      ranking,
      metrics: {
        users: latestMetrics["estimated_users"] as number,
        monthly_arr: latestMetrics["monthly_arr"] as number,
        swe_bench_score: latestMetrics["swe_bench_score"] as number,
        github_stars: latestMetrics["github_stars"] as number,
        valuation: latestMetrics["valuation"] as number,
        funding: latestMetrics["funding_total"] as number,
        employees: latestMetrics["employee_count"] as number,
      },
      metricHistory,
    });
  } catch (error) {
    console.error("Error in tool detail API:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
