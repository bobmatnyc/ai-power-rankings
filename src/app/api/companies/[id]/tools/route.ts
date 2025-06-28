import { NextRequest, NextResponse } from "next/server";
import { getCompaniesRepo, getToolsRepo } from "@/lib/json-db";
import { loggers } from "@/lib/logger";

type Params = {
  params: {
    id: string;
  };
};

// GET tools for a specific company
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const companiesRepo = getCompaniesRepo();
    const toolsRepo = getToolsRepo();
    
    // Try to get company by ID first, then by slug
    let company = await companiesRepo.getById(params.id);
    if (!company) {
      company = await companiesRepo.getBySlug(params.id);
    }
    
    if (!company) {
      return NextResponse.json(
        { error: "Company not found" },
        { status: 404 }
      );
    }
    
    // Get all tools for this company
    const allTools = await toolsRepo.getAll();
    const companyTools = allTools.filter(tool => tool.company_id === company.id);
    
    // Sort by name
    companyTools.sort((a, b) => a.name.localeCompare(b.name));
    
    const response = {
      company: {
        id: company.id,
        slug: company.slug,
        name: company.name,
      },
      tools: companyTools,
      total: companyTools.length,
      _source: "json-db",
    };
    
    return NextResponse.json(response);
  } catch (error) {
    loggers.api.error("Get company tools error", { error, companyId: params.id });
    
    return NextResponse.json(
      {
        error: "Failed to fetch company tools",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}