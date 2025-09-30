import { NextResponse } from "next/server";
import { cachedJsonResponse } from "@/lib/api-cache";
import { getDb } from "@/lib/db/connection";
import { companiesRepository } from "@/lib/db/repositories/companies.repository";
import { ToolsRepository } from "@/lib/db/repositories/tools.repository";
import { toolScoringService } from "@/lib/services/tool-scoring.service";
import { loggers } from "@/lib/logger";
import { CACHE_TTL, getCachedOrFetch } from "@/lib/memory-cache";
import type { APITool, ToolInfo, ToolsResponse } from "@/lib/types/api";
import { toCompanyId, toToolId } from "@/lib/types/branded";

export async function GET(): Promise<NextResponse> {
  try {
    // Try to get from cache first
    const cacheKey = "api:tools:all";

    const cachedResponse = await getCachedOrFetch(
      cacheKey,
      async () => {
        // Ensure database connection is available
        const db = getDb();
        if (!db) {
          throw new Error("Database connection unavailable");
        }

        loggers.api.debug("Fetching tools from database (cache miss)");

        const toolsRepo = new ToolsRepository();

        // Get all active tools from database
        const tools = await toolsRepo.findByStatus("active");

        if (!tools || tools.length === 0) {
          return { tools: [], _source: "database", _timestamp: new Date().toISOString() };
        }

        // Batch load all companies and scoring data to avoid N+1 queries
        const companyIds = tools
          .map(t => t.company_id)
          .filter((id): id is string => id !== null && id !== undefined);

        // Batch load companies
        const companies = new Map();
        if (companyIds.length > 0) {
          try {
            const companyList = await companiesRepository.findByIds(companyIds);
            companyList.forEach(company => {
              companies.set(company.id, company);
            });
          } catch (error) {
            loggers.api.warn("Failed to batch load companies", {
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        }

        // Batch load scoring data for all tools
        const allScoringData = new Map();
        try {
          const scoringPromises = tools.map(tool =>
            toolScoringService.getToolScoring(tool.id)
              .then(data => ({ id: tool.id, data }))
              .catch(error => {
                loggers.api.warn("Failed to fetch scoring for tool", {
                  toolId: tool.id,
                  error: error instanceof Error ? error.message : "Unknown error",
                });
                return { id: tool.id, data: null };
              })
          );

          const scoringResults = await Promise.all(scoringPromises);
          scoringResults.forEach(result => {
            if (result.data) {
              allScoringData.set(result.id, result.data);
            }
          });
        } catch (error) {
          loggers.api.warn("Failed to batch load scoring data", {
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }

        // Transform tools
        const toolsWithInfo = tools.map((tool): APITool => {
          // Get company info from batch loaded data
          let companyName = "";
          let companyId: ReturnType<typeof toCompanyId> | undefined;

          if (tool.company_id && companies.has(tool.company_id)) {
            const company = companies.get(tool.company_id);
            companyName = company.name || "";
            companyId = toCompanyId(company.id);
          }

          // Get scoring data from batch loaded data
          const scoringData = allScoringData.get(tool.id);

          // Parse tool info from database (it's stored as JSONB)
          const toolInfoData = tool.info || {};

          // Create properly typed tool info
          const toolInfo: ToolInfo = {
            company: {
              name: companyName,
              id: companyId,
            },
            product: {
              description: (toolInfoData["description"] as string) || "",
              tagline: (toolInfoData["summary"] as string) || "",
              pricing_model: (toolInfoData["business"] as any)?.pricing_model,
              license_type: (toolInfoData["license_type"] as string) || "proprietary",
            },
            links: {
              website: toolInfoData["website"] as string | undefined,
              github: (toolInfoData["technical"] as any)?.github_repo,
            },
            technical: {
              supported_languages: (toolInfoData["technical"] as any)?.supported_languages,
              ide_integrations: (toolInfoData["technical"] as any)?.ide_integrations,
              api_available: (toolInfoData["technical"] as any)?.api_available,
            },
            business: {
              pricing_model: (toolInfoData["business"] as any)?.pricing_model,
              free_tier: (toolInfoData["business"] as any)?.free_tier,
            },
            metrics: {
              swe_bench: (toolInfoData["metrics"] as any)?.swe_bench,
              github_stars: (toolInfoData["metrics"] as any)?.github_stars,
              user_count: (toolInfoData["metrics"] as any)?.user_count,
            },
            metadata: {
              logo_url: toolInfoData["website"]
                ? `https://logo.clearbit.com/${new URL(toolInfoData["website"] as string).hostname}`
                : undefined,
            },
          };

          // Calculate current score if scoring data exists
          let scoring;
          if (scoringData) {
            const currentScore = scoringData.currentScore ||
              toolScoringService.calculateCurrentScore(
                scoringData.baselineScore || {},
                scoringData.deltaScore || {}
              );

            scoring = {
              baseline_score: scoringData.baselineScore,
              delta_score: scoringData.deltaScore,
              current_score: currentScore,
              score_updated_at: scoringData.lastUpdated?.toISOString()
            };
          }

          return {
            id: toToolId(tool.id),
            slug: tool.slug,
            name: tool.name,
            description: (toolInfoData["description"] as string) || "",
            category: tool.category,
            status: tool.status as "active" | "inactive" | "deprecated",
            created_at: tool.created_at || new Date().toISOString(),
            updated_at: tool.updated_at || new Date().toISOString(),
            tags: tool.tags || [],
            info: toolInfo,
            scoring: scoring,
          } satisfies APITool;
        });

        return {
          tools: toolsWithInfo,
          _source: "database",
          _timestamp: new Date().toISOString(),
        };
      },
      CACHE_TTL.tools
    );

    loggers.api.info("Returning tools response", {
      toolCount: cachedResponse.tools.length,
      source: cachedResponse._source,
      cached: cachedResponse._source === "cache" ? "true" : "false",
    });

    return cachedJsonResponse(cachedResponse, "/api/tools");
  } catch (error) {
    loggers.api.error("Error in tools API", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Check if it's a database connection error
    if (error instanceof Error && error.message.includes("Database connection")) {
      return NextResponse.json(
        {
          error: "Database connection unavailable",
          message: "The database service is currently unavailable. Please try again later.",
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        error: "Internal server error",
        message: "An error occurred while fetching tools. Please try again later.",
      },
      { status: 500 }
    );
  }
}
