import { NextResponse } from "next/server";
import { loggers } from "@/lib/logger";
import { getToolsRepo, getCompaniesRepo } from "@/lib/json-db";
import { cachedJsonResponse } from "@/lib/api-cache";

export async function GET(): Promise<NextResponse> {
  try {
    loggers.api.debug("Getting tools from JSON repository");

    const toolsRepo = getToolsRepo();
    const companiesRepo = getCompaniesRepo();

    // Get all active tools
    const tools = await toolsRepo.getByStatus("active");

    // Transform tools to match expected format with company info
    const toolsWithInfo = await Promise.all(
      tools.map(async (tool: any) => {
        // Get company info if company_id exists
        let companyName = "";
        if (tool.company_id) {
          const company = await companiesRepo.getById(tool.company_id);
          companyName = company?.name || "";
        }

        return {
          id: tool.id,
          slug: tool.slug,
          name: tool.name,
          description: tool.info.description, // Add top-level description for backward compatibility
          category: tool.category,
          status: tool.status,
          created_at: tool.created_at,
          updated_at: tool.updated_at,
          tags: tool.tags,
          info: {
            company: { name: companyName },
            product: {
              description: tool.info.description,
              tagline: tool.info.summary,
              pricing_model: tool.info.business?.pricing_model,
              license_type: "proprietary", // Default value
            },
            links: {
              website: tool.info.website,
              github: tool.info.technical?.github_repo,
            },
            technical: tool.info.technical || {},
            business: tool.info.business || {},
            metrics: tool.info.metrics || {},
            metadata: {
              logo_url: `https://logo.clearbit.com/${new URL(tool.info.website || "https://example.com").hostname}`,
            },
          },
        };
      })
    );

    return cachedJsonResponse(
      {
        tools: toolsWithInfo,
        _source: "json-db",
        _timestamp: new Date().toISOString(),
      },
      "/api/tools"
    );
  } catch (error) {
    loggers.api.error("Error in tools API", { error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
