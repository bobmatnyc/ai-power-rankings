import { NextRequest, NextResponse } from "next/server";
import { getToolsRepo, getRankingsRepo, getNewsRepo, getCompaniesRepo } from "@/lib/json-db";
import { loggers } from "@/lib/logger";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  try {
    const toolsRepo = getToolsRepo();
    const companiesRepo = getCompaniesRepo();
    const rankingsRepo = getRankingsRepo();
    const newsRepo = getNewsRepo();

    // Get tool by slug or ID
    let tool = await toolsRepo.getBySlug(slug);
    if (!tool) {
      tool = await toolsRepo.getById(slug);
    }

    if (!tool) {
      return NextResponse.json({ error: "Tool not found" }, { status: 404 });
    }

    // Get company details and add to tool info
    if (tool.company_id && tool.info) {
      const company = await companiesRepo.getById(tool.company_id);
      if (company) {
        // Add company data to tool info
        tool.info.company = {
          id: company.id,
          name: company.name,
          website: company.website,
          founded: company.founded,
          size: company.size,
        };
      }
    }

    // Get current ranking
    const currentPeriod = await rankingsRepo.getCurrentPeriod();
    let ranking = null;
    let latestRanking = null;

    if (currentPeriod) {
      const periodData = await rankingsRepo.getRankingsForPeriod(currentPeriod);
      if (periodData) {
        latestRanking = periodData.rankings.find((r) => r.tool_id === tool.id);

        if (latestRanking) {
          ranking = {
            rank: latestRanking.position,
            scores: {
              overall: latestRanking.score,
              agentic_capability: latestRanking.factor_scores.agentic_capability || 5,
              innovation: latestRanking.factor_scores.innovation || 5,
              technical_performance: latestRanking.factor_scores.technical_performance || 5,
              developer_adoption: latestRanking.factor_scores.developer_adoption || 5,
              market_traction: latestRanking.factor_scores.market_traction || 5,
              business_sentiment: latestRanking.factor_scores.business_sentiment || 5,
              development_velocity: latestRanking.factor_scores.development_velocity || 5,
              platform_resilience: latestRanking.factor_scores.platform_resilience || 5,
            },
          };
        }
      }
    }

    // Get ranking history
    const allPeriods = await rankingsRepo.getAvailablePeriods();
    const rankingsHistory = [];

    for (const period of allPeriods.slice(0, 12)) {
      // Last 12 periods
      const periodData = await rankingsRepo.getRankingsForPeriod(period);
      if (periodData) {
        const toolRanking = periodData.rankings.find((r) => r.tool_id === tool.id);
        if (toolRanking) {
          rankingsHistory.push({
            position: toolRanking.position,
            score: toolRanking.score,
            period: period,
            ranking_periods: {
              period: period,
              display_name:
                period.replace("-", " ").charAt(0).toUpperCase() +
                period.replace("-", " ").slice(1),
              calculation_date: periodData.created_at,
            },
          });
        }
      }
    }

    // Get news items related to this tool
    const newsItems = await newsRepo.getByToolMention(tool.id);
    const sortedNews = newsItems
      .sort((a, b) => new Date(b.published_date).getTime() - new Date(a.published_date).getTime())
      .slice(0, 20);

    // Transform news to match expected format (based on ToolDetailTabs interface)
    const transformedNews = sortedNews.map((article) => ({
      id: article.id,
      title: article.title,
      summary:
        article.summary || (article.content ? article.content.substring(0, 200) + "..." : ""),
      url: article.source_url,
      source: article.source,
      published_at: article.published_date,
      category: article.tags?.[0] || "general",
      type: "update", // Default type
    }));

    // Extract metrics from tool info
    const metrics = {
      users: tool.info?.metrics?.estimated_users || null,
      monthly_arr: tool.info?.metrics?.monthly_arr || null,
      swe_bench_score: tool.info?.metrics?.swe_bench_score || null,
      github_stars: tool.info?.metrics?.github_stars || null,
      valuation: tool.info?.metrics?.valuation || null,
      funding: tool.info?.metrics?.funding_total || null,
      employees: null, // Not available in current schema
    };

    const metricHistory: any[] = [];
    const pricingPlans: any[] = [];

    const response = {
      tool,
      ranking,
      metrics,
      metricHistory,
      rankingsHistory,
      newsItems: transformedNews,
      pricingPlans,
      _source: "json-db",
    };

    return NextResponse.json(response);
  } catch (error) {
    loggers.api.error("Tool detail JSON API error", { error, slug });

    return NextResponse.json(
      {
        error: "Failed to fetch tool details",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Update tool
export async function PUT(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    // TODO: Add authentication check here

    const body = await request.json();
    const toolsRepo = getToolsRepo();

    // Get existing tool
    let existing = await toolsRepo.getBySlug(slug);
    if (!existing) {
      existing = await toolsRepo.getById(slug);
    }

    if (!existing) {
      return NextResponse.json({ error: "Tool not found" }, { status: 404 });
    }

    // Update tool
    const updatedTool = {
      ...existing,
      ...body,
      id: existing.id, // Ensure ID doesn't change
      slug: existing.slug, // Ensure slug doesn't change unless explicitly provided
      updated_at: new Date().toISOString(),
    };

    await toolsRepo.upsert(updatedTool);

    return NextResponse.json({
      success: true,
      tool: updatedTool,
    });
  } catch (error) {
    loggers.api.error("Update tool error", { error, slug });

    return NextResponse.json(
      {
        error: "Failed to update tool",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Delete tool
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  try {
    // TODO: Add authentication check here

    const toolsRepo = getToolsRepo();

    // Check if tool exists
    let tool = await toolsRepo.getBySlug(slug);
    if (!tool) {
      tool = await toolsRepo.getById(slug);
    }

    if (!tool) {
      return NextResponse.json({ error: "Tool not found" }, { status: 404 });
    }

    // Soft delete by setting status to discontinued
    tool.status = "discontinued";
    tool.updated_at = new Date().toISOString();

    await toolsRepo.upsert(tool);

    return NextResponse.json({
      success: true,
      message: "Tool marked as discontinued",
    });
  } catch (error) {
    loggers.api.error("Delete tool error", { error, slug });

    return NextResponse.json(
      {
        error: "Failed to delete tool",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
