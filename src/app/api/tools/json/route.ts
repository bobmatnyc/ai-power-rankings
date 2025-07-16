import { type NextRequest, NextResponse } from "next/server";
import { getCompaniesRepo, getToolsRepo } from "@/lib/json-db";
import type { Tool } from "@/lib/json-db/schemas";
import { loggers } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "1000");
    const page = parseInt(searchParams.get("page") || "1");
    const category = searchParams.get("category");
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const includeDeprecated = searchParams.get("includeDeprecated") === "true";

    const toolsRepo = getToolsRepo();
    const companiesRepo = getCompaniesRepo();

    let tools;

    // Apply filters
    if (search) {
      tools = await toolsRepo.search(search);
    } else if (category) {
      tools = await toolsRepo.getByCategory(category);
    } else if (status) {
      tools = await toolsRepo.getByStatus(status as any);
    } else {
      tools = await toolsRepo.getAll();
    }

    // Filter out deprecated unless explicitly requested
    if (!includeDeprecated) {
      tools = tools.filter((tool) => tool.status !== "deprecated");
    }

    // Sort by name
    tools.sort((a, b) => a.name.localeCompare(b.name));

    // Transform tools to match expected format with info structure
    const toolsWithInfo = await Promise.all(
      tools.map(async (tool) => {
        // Get company details
        let companyName = "";
        if (tool.company_id) {
          const company = await companiesRepo.getById(tool.company_id);
          if (company) {
            companyName = company.name;
          }
        }

        return {
          ...tool,
          // Tool already has info structure from JSON database
          company_name: companyName, // Add company name for backward compatibility
        };
      })
    );

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedTools = toolsWithInfo.slice(startIndex, endIndex);

    const response = {
      tools: paginatedTools,
      total: toolsWithInfo.length,
      page,
      totalPages: Math.ceil(toolsWithInfo.length / limit),
      hasMore: endIndex < toolsWithInfo.length,
      _source: "json-db",
    };

    const apiResponse = NextResponse.json(response);

    // Set cache headers
    apiResponse.headers.set("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=1800");

    return apiResponse;
  } catch (error) {
    loggers.api.error("Tools JSON API error", { error });

    return NextResponse.json(
      {
        error: "Failed to fetch tools",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Create new tool
export async function POST(request: NextRequest) {
  try {
    // TODO: Add authentication check here

    const body = await request.json();
    const toolsRepo = getToolsRepo();

    // Generate slug if not provided
    const slug =
      body.slug ||
      body.name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .trim();

    const tool: Tool = {
      id: body.id || `tool-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      slug,
      name: body.name,
      category: body.category || "ai-coding-tool",
      status: body.status || ("active" as const),
      company_id: body.company_id,
      info: {
        summary: body.summary || body.tagline || "",
        description: body.description || "",
        website: body.website_url || "",
        features: body.key_features || body.features || [],
        technical: {
          context_window: body.context_window,
          supported_languages: body.supported_languages,
          has_api: body.has_api,
          multi_file_support: body.multi_file_support,
          languages: body.programming_languages,
        },
        business: {
          pricing_model: body.pricing_model,
          business_model: body.business_model,
          base_price: body.base_price,
          enterprise_pricing: body.enterprise_pricing,
        },
        metrics: body.metrics || {},
      },
      tags: body.tags || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await toolsRepo.upsert(tool);

    return NextResponse.json({
      success: true,
      tool,
    });
  } catch (error) {
    loggers.api.error("Create tool error", { error });

    return NextResponse.json(
      {
        error: "Failed to create tool",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
