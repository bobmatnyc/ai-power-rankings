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

    // Get metrics history for the tool
    const { data: toolMetrics } = await supabase
      .from("metrics_history")
      .select("*")
      .eq("tool_id", tool.id)
      .order("recorded_at", { ascending: false })
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

    // Group metrics by date and source for better display
    const groupedMetrics = new Map<
      string,
      {
        source_name: string;
        source_url: string;
        published_date: string;
        metrics: Record<string, unknown>;
      }
    >();

    toolMetrics?.forEach((tm) => {
      const key = `${tm.recorded_at}_${tm.source}`;
      if (!groupedMetrics.has(key)) {
        groupedMetrics.set(key, {
          source_name: tm.source || "Unknown",
          source_url: tm.source_url || "",
          published_date: tm.recorded_at,
          metrics: {},
        });
      }

      const group = groupedMetrics.get(key);
      if (!group) {
        continue;
      }
      const value = tm.value_integer || tm.value_decimal || tm.value_boolean || tm.value_json;
      if (tm.metric_key && value !== null && value !== undefined) {
        group.metrics[tm.metric_key] = value;
      }
    });

    // Convert to array and sort by date
    const metricHistory = Array.from(groupedMetrics.values())
      .sort((a, b) => new Date(b.published_date).getTime() - new Date(a.published_date).getTime())
      .map((item) => ({
        ...item,
        scoring_metrics: item.metrics,
        metric_date: item.published_date,
      }))
      .slice(0, 10); // Limit to 10 most recent entries

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
