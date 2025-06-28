import { NextRequest, NextResponse } from "next/server";
import { getToolsRepo, getCompaniesRepo, getRankingsRepo, getNewsRepo } from "@/lib/json-db";
import { loggers } from "@/lib/logger";

type Params = {
  params: {
    slug: string;
  };
};

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const toolsRepo = getToolsRepo();
    const companiesRepo = getCompaniesRepo();
    const rankingsRepo = getRankingsRepo();
    const newsRepo = getNewsRepo();
    
    // Get tool by slug or ID
    let tool = await toolsRepo.getBySlug(params.slug);
    if (!tool) {
      tool = await toolsRepo.getById(params.slug);
    }
    
    if (!tool) {
      return NextResponse.json({ error: "Tool not found" }, { status: 404 });
    }
    
    // Get company details
    let companyName = "";
    if (tool.company_id) {
      const company = await companiesRepo.getById(tool.company_id);
      if (company) {
        companyName = company.name;
      }
    }
    
    // Ensure tool has info structure for backward compatibility
    if (!tool.info || typeof tool.info !== "object") {
      tool.info = {
        company: { name: companyName },
        product: {
          description: tool.description || "",
          tagline: tool.tagline || "",
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
    
    // Get current ranking
    const currentPeriod = await rankingsRepo.getCurrentPeriod();
    let ranking = null;
    let latestRanking = null;
    
    if (currentPeriod) {
      const periodData = await rankingsRepo.getRankingsForPeriod(currentPeriod);
      if (periodData) {
        latestRanking = periodData.rankings.find(r => r.tool_id === tool.id);
        
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
    
    for (const period of allPeriods.slice(0, 12)) { // Last 12 periods
      const periodData = await rankingsRepo.getRankingsForPeriod(period);
      if (periodData) {
        const toolRanking = periodData.rankings.find(r => r.tool_id === tool.id);
        if (toolRanking) {
          rankingsHistory.push({
            position: toolRanking.position,
            score: toolRanking.score,
            period: period,
            ranking_periods: {
              period: period,
              display_name: period.replace('-', ' ').charAt(0).toUpperCase() + period.replace('-', ' ').slice(1),
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
    
    // Transform news to match expected format
    const transformedNews = sortedNews.map(article => ({
      id: article.id,
      headline: article.title,
      summary: article.summary || article.content.substring(0, 200) + "...",
      published_at: article.published_date,
      source: article.source,
      source_url: article.source_url,
      category: article.tags?.[0] || "general",
      impact_level: "medium", // Default since we don't have this field
      related_tools: article.tool_mentions || [],
    }));
    
    // Mock metrics for now (would need a separate metrics collection)
    const metrics = {
      users: null,
      monthly_arr: null,
      swe_bench_score: null,
      github_stars: null,
      valuation: null,
      funding: null,
      employees: null,
    };
    
    const metricHistory: any[] = [];
    const pricingPlans = tool.pricing_tiers || [];
    
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
    loggers.api.error("Tool detail JSON API error", { error, slug: params.slug });
    
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
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    // TODO: Add authentication check here
    
    const body = await request.json();
    const toolsRepo = getToolsRepo();
    
    // Get existing tool
    let existing = await toolsRepo.getBySlug(params.slug);
    if (!existing) {
      existing = await toolsRepo.getById(params.slug);
    }
    
    if (!existing) {
      return NextResponse.json(
        { error: "Tool not found" },
        { status: 404 }
      );
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
    loggers.api.error("Update tool error", { error, slug: params.slug });
    
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
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    // TODO: Add authentication check here
    
    const toolsRepo = getToolsRepo();
    
    // Check if tool exists
    let tool = await toolsRepo.getBySlug(params.slug);
    if (!tool) {
      tool = await toolsRepo.getById(params.slug);
    }
    
    if (!tool) {
      return NextResponse.json(
        { error: "Tool not found" },
        { status: 404 }
      );
    }
    
    // Soft delete by setting status to deprecated
    tool.status = 'deprecated';
    tool.updated_at = new Date().toISOString();
    
    await toolsRepo.upsert(tool);
    
    return NextResponse.json({
      success: true,
      message: "Tool marked as deprecated",
    });
  } catch (error) {
    loggers.api.error("Delete tool error", { error, slug: params.slug });
    
    return NextResponse.json(
      {
        error: "Failed to delete tool",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}