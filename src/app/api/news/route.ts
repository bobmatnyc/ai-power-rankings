import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/database";
import { loggers } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");
    const filter = searchParams.get("filter") || "all";

    // Build the query from metrics_history - this is our real event log
    let query = supabase
      .from("metrics_history")
      .select(
        `
        *,
        tools (
          id,
          name,
          category
        )
      `
      )
      .not("source_url", "is", null)
      .order("recorded_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filter if not "all" - map to metric types
    if (filter !== "all") {
      const metricTypeMap: Record<string, string[]> = {
        milestone: ["monthly_arr", "estimated_users", "github_stars", "valuation_latest"],
        announcement: ["funding_total", "timeline_event"],
        update: ["swe_bench_score", "innovation_score", "feature_set"],
        feature: ["feature_set", "innovation_score"],
        partnership: ["timeline_event"],
      };

      if (metricTypeMap[filter]) {
        query = query.in("metric_key", metricTypeMap[filter]);
      }
    }

    const { data: metricsItems, error } = await query;

    if (error) {
      loggers.news.error("Error fetching news", { error });
      return NextResponse.json({ error: "Failed to fetch news" }, { status: 500 });
    }

    // Transform metrics_history data into news format
    const transformedNews =
      metricsItems?.map((metric) => {
        // Generate appropriate title and description based on metric type
        let title = "";
        let description = "";
        let eventType = "update";
        const metricValue = metric.value_integer || metric.value_decimal || 0;
        const toolName = metric.tools?.name || "Unknown Tool";

        switch (metric.metric_key) {
          case "monthly_arr":
            title = `${toolName} Reaches $${(metricValue / 1000000).toFixed(0)}M ARR`;
            description = `${toolName} has achieved $${(metricValue / 1000000).toFixed(0)} million in Annual Recurring Revenue.`;
            eventType = "milestone";
            break;
          case "valuation_latest":
            title = `${toolName} Valued at $${(metricValue / 1000000000).toFixed(1)}B`;
            description = `${toolName} achieves ${metricValue >= 1000000000 ? "unicorn" : "significant"} valuation of $${(metricValue / 1000000000).toFixed(1)} billion.`;
            eventType = "milestone";
            break;
          case "funding_total":
            title = `${toolName} Raises Funding - Total $${(metricValue / 1000000).toFixed(0)}M`;
            description =
              metric.notes ||
              `${toolName} has raised additional funding, bringing total to $${(metricValue / 1000000).toFixed(0)}M.`;
            eventType = "announcement";
            break;
          case "estimated_users":
            title = `${toolName} Surpasses ${(metricValue / 1000).toFixed(0)}K Users`;
            description = `${toolName} continues rapid growth, now serving over ${(metricValue / 1000).toFixed(0)}K active users.`;
            eventType = "milestone";
            break;
          case "swe_bench_score":
            title = `${toolName} Achieves ${metricValue}% on SWE-bench`;
            description = `${toolName} demonstrates strong performance on the SWE-bench coding benchmark with ${metricValue}% score.`;
            eventType = "update";
            break;
          case "github_stars":
            title = `${toolName} Reaches ${(metricValue / 1000).toFixed(0)}K GitHub Stars`;
            description = `${toolName} gains developer popularity with ${(metricValue / 1000).toFixed(0)}K GitHub stars.`;
            eventType = "milestone";
            break;
          case "timeline_event":
            title = metric.notes || `${toolName} Major Update`;
            description = metric.notes || `${toolName} announces significant developments.`;
            eventType = "announcement";
            break;
          case "innovation_score":
            title = `${toolName} Innovation Score Updated`;
            description = `${toolName} receives updated innovation assessment: ${metricValue}`;
            eventType = "update";
            break;
          default:
            title = `${toolName} Updates ${metric.metric_key.replace(/_/g, " ")}`;
            description =
              metric.notes || `New ${metric.metric_key.replace(/_/g, " ")} data for ${toolName}`;
            eventType = "update";
        }

        return {
          id: metric.id,
          tool_id: metric.tool_id,
          tool_name: toolName,
          tool_category: metric.tools?.category || "unknown",
          tool_website: "",
          event_date: metric.recorded_at,
          event_type: eventType,
          title,
          description,
          source_url: metric.source_url,
          source_name: metric.source_name || "Industry Report",
          metrics: {
            [metric.metric_key]: metricValue,
          },
          tags: [metric.metric_key],
        };
      }) || [];

    return NextResponse.json({
      news: transformedNews,
      total: transformedNews.length,
      hasMore: transformedNews.length === limit,
    });
  } catch (error) {
    loggers.news.error("News API error", { error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
