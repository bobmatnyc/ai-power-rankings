import { NextResponse } from "next/server";
import { supabase } from "@/lib/database";
import { loggers } from "@/lib/logger";

type Params = {
  params: Promise<{
    slug: string;
  }>;
};

export async function GET(_request: Request, { params }: Params): Promise<NextResponse> {
  const { slug } = await params;
  try {
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

    // Get latest metrics from metrics_history
    const latestMetrics: Record<string, unknown> = {};

    // Get the most recent value for each metric
    const { data: recentMetrics } = await supabase
      .from("metrics_history")
      .select("metric_key, value_integer, value_decimal")
      .eq("tool_id", tool.id)
      .order("recorded_at", { ascending: false });

    // Group by metric_key and take the most recent value
    const metricMap = new Map<string, unknown>();
    recentMetrics?.forEach((m) => {
      if (!metricMap.has(m.metric_key)) {
        metricMap.set(m.metric_key, m.value_integer || m.value_decimal);
      }
    });

    // Convert to object
    metricMap.forEach((value, key) => {
      latestMetrics[key] = value;
    });

    // Get current ranking data from ranking_cache
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
      .eq("period", "june-2025")
      .single();

    // Get rankings history (last 12 months)
    const { data: rankingsHistory, error: rankingsError } = await supabase
      .from("ranking_cache")
      .select(
        `
        position,
        score,
        period
      `
      )
      .eq("tool_id", tool.id)
      .order("period", { ascending: false })
      .limit(12);

    // Get ranking periods info
    let enrichedRankingsHistory: any[] = [];
    if (rankingsHistory && rankingsHistory.length > 0) {
      const periods = [...new Set(rankingsHistory.map((r) => r.period))];
      const { data: periodData } = await supabase
        .from("ranking_periods")
        .select("period, display_name, calculation_date")
        .in("period", periods);

      if (periodData) {
        const periodMap = new Map(periodData.map((p) => [p.period, p]));
        enrichedRankingsHistory = rankingsHistory
          .map((r) => ({
            ...r,
            ranking_periods: periodMap.get(r.period),
          }))
          .filter((r) => r.ranking_periods)
          .sort((a, b) => {
            const dateA = new Date(a.ranking_periods!.calculation_date);
            const dateB = new Date(b.ranking_periods!.calculation_date);
            return dateB.getTime() - dateA.getTime();
          });
      }
    }

    if (rankingsError) {
      loggers.api.error("Error fetching rankings history", {
        error: rankingsError,
        toolId: tool.id,
      });
    }

    // Get all news items and filter client-side for now
    // This handles both array format ["tool-id"] and object format [{"tool_id": "tool-id"}]
    const { data: allNews, error: newsError } = await supabase
      .from("news_updates")
      .select("*")
      .order("published_at", { ascending: false })
      .limit(100);

    if (newsError) {
      loggers.api.error("Error fetching news items", { error: newsError, toolId: tool.id });
    }

    // Filter news items that mention this tool
    const newsItems =
      allNews
        ?.filter((item) => {
          if (!item.related_tools || !Array.isArray(item.related_tools)) {
            return false;
          }

          // Check if tool is mentioned (handles both string array and object array)
          return item.related_tools.some((relatedTool: any) => {
            if (typeof relatedTool === "string") {
              return relatedTool === tool.id;
            } else if (relatedTool && typeof relatedTool === "object") {
              return relatedTool.tool_id === tool.id;
            }
            return false;
          });
        })
        .slice(0, 20) || [];

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
      if (group) {
        const value = tm.value_integer || tm.value_decimal || tm.value_boolean || tm.value_json;
        if (tm.metric_key && value !== null && value !== undefined) {
          group.metrics[tm.metric_key] = value;
        }
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

    loggers.api.debug("Tool detail API response", {
      toolId: tool.id,
      rankingsHistoryCount: rankingsHistory?.length || 0,
      newsItemsCount: newsItems?.length || 0,
      metricHistoryCount: metricHistory?.length || 0,
    });

    // Get pricing plans for this tool
    const { data: pricingPlans } = await supabase
      .from("pricing_plans")
      .select("*")
      .eq("tool_id", tool.id)
      .eq("is_active", true)
      .order("price_monthly", { ascending: true });

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
        employees: latestMetrics["employees"] as number,
      },
      metricHistory,
      rankingsHistory: enrichedRankingsHistory || [],
      newsItems: newsItems || [],
      pricingPlans: pricingPlans || [],
    });
  } catch (error) {
    loggers.api.error("Error in tool detail API", { error, slug });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
