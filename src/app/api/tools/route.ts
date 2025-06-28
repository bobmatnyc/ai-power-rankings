import { NextResponse } from "next/server";
import { loggers } from "@/lib/logger";
import { getToolsRepo, getCompaniesRepo } from "@/lib/json-db";

export async function GET(): Promise<NextResponse> {
  try {
    loggers.api.debug("Getting tools from JSON repository");

    const toolsRepo = getToolsRepo();
    const companiesRepo = getCompaniesRepo();
    
    // Get all active tools
    const tools = await toolsRepo.getByStatus('active');
    
    // Transform tools to match expected format with company info
    const toolsWithInfo = await Promise.all(tools.map(async (tool: any) => {
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
          metadata: {
            logo_url: `https://logo.clearbit.com/${new URL(tool.info.website || 'https://example.com').hostname}`,
          },
        },
      };
    }));

    const apiResponse = NextResponse.json({ 
      tools: toolsWithInfo,
      _source: "json-db",
      _timestamp: new Date().toISOString()
    });

    // Set cache headers
    apiResponse.headers.set(
      "Cache-Control",
      process.env.NODE_ENV === "production"
        ? "public, s-maxage=3600, stale-while-revalidate=1800"
        : "no-cache"
    );

    return apiResponse;
  } catch (error) {
    loggers.api.error("Error in tools API", { error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
