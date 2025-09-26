import { NextResponse } from "next/server";
import { cachedJsonResponse } from "@/lib/api-cache";
import { getDb } from "@/lib/db/connection";
import { companiesRepository } from "@/lib/db/repositories/companies.repository";
import { ToolsRepository } from "@/lib/db/repositories/tools.repository";
import { loggers } from "@/lib/logger";
import type { APITool, ToolInfo, ToolsResponse } from "@/lib/types/api";
import { toCompanyId, toToolId } from "@/lib/types/branded";

export async function GET(): Promise<NextResponse> {
  try {
    // Ensure database connection is available
    const db = getDb();
    if (!db) {
      loggers.api.error("Database connection not available");
      return NextResponse.json(
        {
          error: "Database connection unavailable",
          message: "The database service is currently unavailable. Please try again later.",
        },
        { status: 503 }
      );
    }

    loggers.api.debug("Getting tools from database");

    const toolsRepo = new ToolsRepository();

    // Get all active tools from database
    const tools = await toolsRepo.findByStatus("active");

    if (!tools || tools.length === 0) {
      loggers.api.info("No active tools found in database");
      return cachedJsonResponse(
        {
          tools: [],
          _source: "database",
          _timestamp: new Date().toISOString(),
        },
        "/api/tools"
      );
    }

    // Transform tools to match expected format with company info
    const toolsWithInfo: APITool[] = await Promise.all(
      tools.map(async (tool): Promise<APITool> => {
        // Get company info if company_id exists
        let companyName = "";
        let companyId: ReturnType<typeof toCompanyId> | undefined;

        if (tool.company_id) {
          try {
            const company = await companiesRepository.findById(tool.company_id);
            if (company) {
              companyName = company.name || "";
              companyId = toCompanyId(company.id);
            }
          } catch (error) {
            loggers.api.warn("Failed to fetch company info", {
              toolId: tool.id,
              companyId: tool.company_id,
              error: error instanceof Error ? error.message : "Unknown error",
            });
          }
        }

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

        return {
          id: toToolId(tool.id),
          slug: tool.slug,
          name: tool.name,
          description: (toolInfoData["description"] as string) || "", // Add top-level description for backward compatibility
          category: tool.category,
          status: tool.status as "active" | "inactive" | "deprecated",
          created_at: tool.created_at || new Date().toISOString(),
          updated_at: tool.updated_at || new Date().toISOString(),
          tags: tool.tags || [],
          info: toolInfo,
        } satisfies APITool;
      })
    );

    const responseData: ToolsResponse["data"] = {
      tools: toolsWithInfo,
      _source: "database",
      _timestamp: new Date().toISOString(),
    };

    loggers.api.info("Returning tools response from database", {
      toolCount: toolsWithInfo.length,
      firstTool: toolsWithInfo[0]?.name,
    });

    return cachedJsonResponse(responseData, "/api/tools");
  } catch (error) {
    loggers.api.error("Error in tools API", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        error: "Internal server error",
        message: "An error occurred while fetching tools. Please try again later.",
      },
      { status: 500 }
    );
  }
}
