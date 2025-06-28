import { NextRequest, NextResponse } from "next/server";
import { getCompaniesRepo, getToolsRepo } from "@/lib/json-db";
import { loggers } from "@/lib/logger";

// GET company statistics
export async function GET(request: NextRequest) {
  try {
    const companiesRepo = getCompaniesRepo();
    const toolsRepo = getToolsRepo();
    
    const companies = await companiesRepo.getAll();
    const tools = await toolsRepo.getAll();
    
    // Calculate statistics
    const sizeDistribution: Record<string, number> = {};
    const companiesWithTools: string[] = [];
    const companiesWithoutTools: string[] = [];
    
    companies.forEach(company => {
      // Size distribution
      const size = company.size || 'unknown';
      sizeDistribution[size] = (sizeDistribution[size] || 0) + 1;
      
      // Companies with/without tools
      const hasTools = tools.some(tool => tool.company_id === company.id);
      if (hasTools) {
        companiesWithTools.push(company.id);
      } else {
        companiesWithoutTools.push(company.id);
      }
    });
    
    // Get top companies by tool count
    const companyToolCounts = companies.map(company => {
      const toolCount = tools.filter(tool => tool.company_id === company.id).length;
      return {
        company: {
          id: company.id,
          slug: company.slug,
          name: company.name,
          size: company.size,
        },
        toolCount,
      };
    })
    .filter(item => item.toolCount > 0)
    .sort((a, b) => b.toolCount - a.toolCount)
    .slice(0, 10);
    
    const response = {
      stats: {
        totalCompanies: companies.length,
        companiesWithTools: companiesWithTools.length,
        companiesWithoutTools: companiesWithoutTools.length,
        sizeDistribution,
        averageToolsPerCompany: companiesWithTools.length > 0 
          ? (tools.length / companiesWithTools.length).toFixed(2) 
          : "0",
      },
      topCompanies: companyToolCounts,
      _source: "json-db",
    };
    
    const apiResponse = NextResponse.json(response);
    
    // Set cache headers
    apiResponse.headers.set(
      "Cache-Control",
      "public, s-maxage=300, stale-while-revalidate=150"
    );
    
    return apiResponse;
  } catch (error) {
    loggers.api.error("Company stats API error", { error });
    
    return NextResponse.json(
      {
        error: "Failed to calculate company statistics",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}