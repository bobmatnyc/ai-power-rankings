import { type NextRequest, NextResponse } from "next/server";
import { getToolsRepo, getCompaniesRepo } from "@/lib/json-db";
import { loggers } from "@/lib/logger";

export async function GET(_request: NextRequest) {
  try {
    const toolsRepo = getToolsRepo();
    const companiesRepo = getCompaniesRepo();

    const tools = await toolsRepo.getAll();
    // Companies available through companiesRepo if needed

    // Calculate statistics
    const stats = {
      totalTools: tools.length,
      activeTools: tools.filter((t) => t.status === "active").length,
      deprecatedTools: tools.filter((t) => t.status === "deprecated").length,

      categoryDistribution: {} as Record<string, number>,
      statusDistribution: {} as Record<string, number>,
      pricingModelDistribution: {} as Record<string, number>,
      licenseTypeDistribution: {} as Record<string, number>,

      toolsWithCompanies: 0,
      toolsWithGithub: 0,
      toolsWithDocumentation: 0,

      averageFeaturesPerTool: 0,
      averagePlatformsPerTool: 0,
    };

    let totalFeatures = 0;
    const totalPlatforms = 0;

    tools.forEach((tool) => {
      // Category distribution
      if (tool.category) {
        stats.categoryDistribution[tool.category] =
          (stats.categoryDistribution[tool.category] || 0) + 1;
      }

      // Status distribution
      if (tool.status) {
        stats.statusDistribution[tool.status] = (stats.statusDistribution[tool.status] || 0) + 1;
      }

      // Pricing model distribution
      const pricingModel = tool.info?.business?.pricing_model;
      if (pricingModel) {
        stats.pricingModelDistribution[pricingModel] =
          (stats.pricingModelDistribution[pricingModel] || 0) + 1;
      }

      // License type distribution
      if (tool.info?.business?.pricing_model) {
        const model = tool.info.business.pricing_model;
        stats.licenseTypeDistribution[model] = (stats.licenseTypeDistribution[model] || 0) + 1;
      }

      // Count tools with various properties
      if (tool.company_id) {
        stats.toolsWithCompanies++;
      }
      // GitHub info not in current schema
      if (tool.info?.website) {
        stats.toolsWithDocumentation++;
      }

      // Count features and platforms
      if (tool.info?.features) {
        totalFeatures += tool.info.features.length;
      }
      // Platforms not in current schema
    });

    // Calculate averages
    stats.averageFeaturesPerTool =
      tools.length > 0 ? parseFloat((totalFeatures / tools.length).toFixed(2)) : 0;
    stats.averagePlatformsPerTool =
      tools.length > 0 ? parseFloat((totalPlatforms / tools.length).toFixed(2)) : 0;

    // Get recently added tools
    const recentTools = tools
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10)
      .map((tool) => ({
        id: tool.id,
        slug: tool.slug,
        name: tool.name,
        category: tool.category,
        created_at: tool.created_at,
      }));

    // Get tools by company count
    const companyToolCounts = new Map<string, number>();
    tools.forEach((tool) => {
      if (tool.company_id) {
        const count = companyToolCounts.get(tool.company_id) || 0;
        companyToolCounts.set(tool.company_id, count + 1);
      }
    });

    const topCompaniesByTools = Array.from(companyToolCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(async ([companyId, toolCount]) => {
        const company = await companiesRepo.getById(companyId);
        return {
          company: company
            ? {
                id: company.id,
                name: company.name,
                slug: company.slug,
              }
            : null,
          toolCount,
        };
      });

    const response = {
      stats,
      recentTools,
      topCompaniesByTools: await Promise.all(topCompaniesByTools),
      _source: "json-db",
    };

    const apiResponse = NextResponse.json(response);

    // Set cache headers
    apiResponse.headers.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=150");

    return apiResponse;
  } catch (error) {
    loggers.api.error("Tool stats API error", { error });

    return NextResponse.json(
      {
        error: "Failed to calculate tool statistics",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
