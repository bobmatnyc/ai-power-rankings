import { NextResponse } from "next/server";
import { payloadDirect } from "@/lib/payload-direct";
import { loggers } from "@/lib/logger";

type Params = {
  params: Promise<{
    slug: string;
  }>;
};

export async function GET(_request: Request, { params }: Params): Promise<NextResponse> {
  const { slug } = await params;
  try {
    // Get tool details
    const tool = await payloadDirect.getTool(slug);

    if (!tool) {
      return NextResponse.json({ error: "Tool not found" }, { status: 404 });
    }

    // Handle company data - it might be populated or just an ID
    const companyName = typeof tool.company === 'object' && tool.company ? tool.company.name : '';
    
    // Extract description text from rich text if needed
    let description = '';
    if (tool.description && Array.isArray(tool.description)) {
      description = tool.description
        .map((block: any) => block.children?.map((child: any) => child.text).join(''))
        .join('\n');
    } else if (typeof tool.description === 'string') {
      description = tool.description;
    }

    // Ensure tool has info structure for backward compatibility
    if (!tool.info || typeof tool.info !== "object") {
      tool.info = {
        company: { name: companyName },
        product: {
          description: description,
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
    const metricsResponse = await payloadDirect.getMetrics({
      tool: tool.id,
      sort: '-recorded_at',
      limit: 20
    });
    const toolMetrics = metricsResponse.docs;

    // Get latest metrics from metrics_history
    const latestMetrics: Record<string, unknown> = {};

    // Get all recent metrics for this tool
    const recentMetricsResponse = await payloadDirect.getMetrics({
      tool: tool.id,
      sort: '-recorded_at',
      limit: 100 // Get more to ensure we have all metric types
    });

    // Group by metric_key and take the most recent value
    const metricMap = new Map<string, unknown>();
    recentMetricsResponse.docs?.forEach((m: any) => {
      if (!metricMap.has(m['metric_key'])) {
        metricMap.set(m['metric_key'], m['value_integer'] || m['value_decimal']);
      }
    });

    // Convert to object
    metricMap.forEach((value, key) => {
      latestMetrics[key] = value;
    });

    // Get current ranking data
    const rankingResponse = await payloadDirect.getRankings({
      period: 'june-2025',
      limit: 100
    });
    
    const rankingData = rankingResponse.docs.find((r: any) => {
      const toolId = typeof r.tool === 'string' ? r.tool : r.tool?.id;
      return toolId === tool.id;
    });

    // Get rankings history (last 12 periods)
    const rankingsHistoryResponse = await payloadDirect.getRankings({
      sort: '-period',
      limit: 1000 // Get all to filter by tool
    });

    // Filter for this tool's rankings
    const rankingsHistory = rankingsHistoryResponse.docs
      .filter((r: any) => {
        const toolId = typeof r.tool === 'string' ? r.tool : r.tool?.id;
        return toolId === tool.id;
      })
      .slice(0, 12);

    // Since Payload doesn't have ranking_periods, we'll create display data from the period
    const enrichedRankingsHistory = rankingsHistory.map((r: any) => ({
      position: r.position,
      score: r.score,
      period: r.period,
      ranking_periods: {
        period: r.period,
        display_name: r.period.replace('-', ' ').charAt(0).toUpperCase() + r.period.replace('-', ' ').slice(1),
        calculation_date: r.createdAt
      }
    }));

    // Get news items related to this tool
    const newsResponse = await payloadDirect.getNews({
      sort: '-published_at',
      limit: 100
    });

    // Filter news items that mention this tool
    const newsItems = newsResponse.docs
      ?.filter((item: any) => {
        if (!item.related_tools || !Array.isArray(item.related_tools)) {
          return false;
        }

        // Check if tool is mentioned
        return item.related_tools.some((relatedTool: any) => {
          const toolRef = typeof relatedTool === 'string' ? relatedTool : relatedTool?.id;
          return toolRef === tool.id || toolRef === tool.slug;
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

    toolMetrics?.forEach((tm: any) => {
      const key = `${tm['recorded_at']}_${tm['source']}`;
      if (!groupedMetrics.has(key)) {
        groupedMetrics.set(key, {
          source_name: tm['source'] || "Unknown",
          source_url: tm['source_url'] || "",
          published_date: tm['recorded_at'],
          metrics: {},
        });
      }

      const group = groupedMetrics.get(key);
      if (group) {
        const value = tm['value_integer'] || tm['value_decimal'] || tm['value_boolean'] || tm['value_json'];
        if (tm['metric_key'] && value !== null && value !== undefined) {
          group.metrics[tm['metric_key']] = value;
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

    // TODO: Pricing plans are not yet migrated to Payload
    const pricingPlans: any[] = [];

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