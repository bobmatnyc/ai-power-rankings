import { NextResponse } from "next/server";
import { cachedJsonResponse } from "@/lib/api-cache";
import { getCompaniesRepo, getToolsRepo } from "@/lib/json-db";
import type { Tool } from "@/lib/json-db/schemas";
import { loggers } from "@/lib/logger";
import type { APITool, ToolInfo, ToolsResponse } from "@/lib/types/api";
import { toCompanyId, toToolId } from "@/lib/types/branded";

export async function GET(): Promise<NextResponse> {
  try {
    loggers.api.debug("Getting tools from JSON repository");

    const toolsRepo = getToolsRepo();
    const companiesRepo = getCompaniesRepo();

    // Get all active tools
    const tools = await toolsRepo.getByStatus("active");

    // Transform tools to match expected format with company info
    const toolsWithInfo: APITool[] = await Promise.all(
      tools.map(async (tool: Tool): Promise<APITool> => {
        // Get company info if company_id exists
        let companyName = "";
        let companyId: ReturnType<typeof toCompanyId> | undefined;

        if (tool.company_id) {
          try {
            const company = await companiesRepo.getById(tool.company_id);
            companyName = company?.name || "";
            companyId = company?.id ? toCompanyId(company.id) : undefined;
          } catch (error) {
            loggers.api.warn("Failed to fetch company info", {
              toolId: tool.id,
              companyId: tool.company_id,
            });
          }
        }

        // Create properly typed tool info
        const toolInfo: ToolInfo = {
          company: {
            name: companyName,
            id: companyId,
          },
          product: {
            description: tool.info.description || "",
            tagline: tool.info.summary,
            pricing_model: tool.info.business?.pricing_model,
            license_type: "proprietary",
          },
          links: {
            website: tool.info.website,
            github: (tool.info.technical as { github_repo?: string })?.github_repo,
          },
          technical: {
            supported_languages: (tool.info.technical as any)?.supported_languages,
            ide_integrations: (tool.info.technical as any)?.ide_integrations,
            api_available: (tool.info.technical as any)?.api_available,
          },
          business: {
            pricing_model: tool.info.business?.pricing_model,
            free_tier: (tool.info.business as any)?.free_tier,
          },
          metrics: {
            swe_bench: tool.info.metrics?.swe_bench,
            github_stars: (tool.info.metrics as any)?.github_stars,
            user_count: (tool.info.metrics as any)?.user_count,
          },
          metadata: {
            logo_url: tool.info.website
              ? `https://logo.clearbit.com/${new URL(tool.info.website).hostname}`
              : undefined,
          },
        };

        return {
          id: toToolId(tool.id),
          slug: tool.slug,
          name: tool.name,
          description: tool.info.description || "", // Add top-level description for backward compatibility
          category: tool.category,
          status: tool.status as "active" | "inactive" | "deprecated",
          created_at: tool.created_at,
          updated_at: tool.updated_at,
          tags: tool.tags || [],
          info: toolInfo,
        } satisfies APITool;
      })
    );

    const responseData: ToolsResponse["data"] = {
      tools: toolsWithInfo,
      _source: "json-db",
      _timestamp: new Date().toISOString(),
    };

    loggers.api.info("Returning tools response", {
      toolCount: toolsWithInfo.length,
      firstTool: toolsWithInfo[0]?.name,
    });

    return cachedJsonResponse(responseData, "/api/tools");
  } catch (error) {
    loggers.api.error("Error in tools API", { error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
