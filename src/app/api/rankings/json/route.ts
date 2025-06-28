import { NextRequest, NextResponse } from "next/server";
import { getRankingsRepo, getToolsRepo, getCompaniesRepo } from "@/lib/json-db";
import { loggers } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get("period");
    const limit = parseInt(searchParams.get("limit") || "100");
    
    const rankingsRepo = getRankingsRepo();
    const toolsRepo = getToolsRepo();
    const companiesRepo = getCompaniesRepo();
    
    // Get the period to fetch
    let targetPeriod = period;
    if (!targetPeriod) {
      targetPeriod = await rankingsRepo.getCurrentPeriod();
    }
    
    if (!targetPeriod) {
      return NextResponse.json(
        { error: "No rankings available" },
        { status: 404 }
      );
    }
    
    // Get rankings for the period
    const periodData = await rankingsRepo.getRankingsForPeriod(targetPeriod);
    
    if (!periodData) {
      return NextResponse.json(
        { error: "Rankings not found for period" },
        { status: 404 }
      );
    }
    
    // Get all tools for enrichment
    const tools = await toolsRepo.getAll();
    const toolMap = new Map(tools.map(t => [t.id, t]));
    
    // Get all companies for enrichment
    const companies = await companiesRepo.getAll();
    const companyMap = new Map(companies.map(c => [c.id, c]));
    
    // Format rankings with tool details
    const formattedRankings = await Promise.all(
      periodData.rankings.slice(0, limit).map(async (ranking) => {
        const tool = toolMap.get(ranking.tool_id);
        
        if (!tool) {
          loggers.api.warn("Tool not found for ranking", { toolId: ranking.tool_id });
          return null;
        }
        
        // Get company name
        let companyName = "";
        if (tool.company_id) {
          const company = companyMap.get(tool.company_id);
          if (company) {
            companyName = company.name;
          }
        }
        
        // Calculate ranking change if movement data exists
        let rankChange = null;
        let changeReason = "";
        
        if (ranking.movement) {
          if (ranking.movement.direction === 'up') {
            rankChange = ranking.movement.change;
            changeReason = ranking.change_analysis?.primary_reason || "Improved performance";
          } else if (ranking.movement.direction === 'down') {
            rankChange = -ranking.movement.change;
            changeReason = ranking.change_analysis?.primary_reason || "Other tools gained momentum";
          } else if (ranking.movement.direction === 'new') {
            changeReason = "New to rankings";
          }
        }
        
        return {
          rank: ranking.position,
          previousRank: ranking.movement?.previous_position,
          rankChange,
          changeReason,
          tool: {
            id: tool.id,
            slug: tool.slug,
            name: tool.display_name || tool.name,
            category: tool.category,
            status: tool.status,
            website_url: tool.website_url,
            description: tool.description || "",
            company: companyName,
          },
          total_score: ranking.score,
          scores: {
            overall: ranking.score,
            agentic_capability: ranking.factor_scores.agentic_capability || 5,
            innovation: ranking.factor_scores.innovation || 5,
            technical_performance: ranking.factor_scores.technical_performance || 5,
            developer_adoption: ranking.factor_scores.developer_adoption || 5,
            market_traction: ranking.factor_scores.market_traction || 5,
            business_sentiment: ranking.factor_scores.business_sentiment || 5,
            development_velocity: ranking.factor_scores.development_velocity || 5,
            platform_resilience: ranking.factor_scores.platform_resilience || 5,
          },
          metrics: {
            // These would come from a metrics collection if we had one
            news_articles_count: 0,
            recent_funding_rounds: 0,
            recent_product_launches: 0,
            users: null,
            swe_bench_score: null,
          },
          tier: ranking.tier,
        };
      })
    );
    
    // Filter out nulls
    const validRankings = formattedRankings.filter(Boolean);
    
    const response = {
      rankings: validRankings,
      period: targetPeriod,
      algorithm: {
        version: periodData.algorithm_version,
        name: "AI Power Rankings Algorithm",
        date: periodData.created_at,
      },
      stats: {
        total_tools: periodData.rankings.length,
        period_display: targetPeriod.replace('-', ' ').charAt(0).toUpperCase() + targetPeriod.replace('-', ' ').slice(1),
        is_current: periodData.is_current,
      },
      _source: "json-db",
    };
    
    const apiResponse = NextResponse.json(response);
    
    // Set cache headers
    apiResponse.headers.set(
      "Cache-Control",
      "public, s-maxage=3600, stale-while-revalidate=1800"
    );
    
    return apiResponse;
  } catch (error) {
    loggers.api.error("Rankings JSON API error", { error });
    
    return NextResponse.json(
      {
        error: "Failed to fetch rankings",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Get available ranking periods
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (body.action === "get-periods") {
      const rankingsRepo = getRankingsRepo();
      const periods = await rankingsRepo.getAvailablePeriods();
      const currentPeriod = await rankingsRepo.getCurrentPeriod();
      
      // Get metadata for each period
      const periodsWithMetadata = await Promise.all(
        periods.map(async (period) => {
          const data = await rankingsRepo.getRankingsForPeriod(period);
          return {
            period,
            display_name: period.replace('-', ' ').charAt(0).toUpperCase() + period.replace('-', ' ').slice(1),
            is_current: period === currentPeriod,
            tool_count: data?.rankings.length || 0,
            created_at: data?.created_at,
            algorithm_version: data?.algorithm_version,
          };
        })
      );
      
      return NextResponse.json({
        periods: periodsWithMetadata,
        current: currentPeriod,
        _source: "json-db",
      });
    }
    
    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    );
  } catch (error) {
    loggers.api.error("Rankings POST error", { error });
    
    return NextResponse.json(
      {
        error: "Failed to process request",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}