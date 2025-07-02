import { type NextRequest, NextResponse } from "next/server";
import { getCompaniesRepo, getToolsRepo } from "@/lib/json-db";
import { loggers } from "@/lib/logger";

// GET tools for a specific company
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const companiesRepo = getCompaniesRepo();
    const toolsRepo = getToolsRepo();

    // Try to get company by ID first, then by slug
    let company = await companiesRepo.getById(id);
    if (!company) {
      company = await companiesRepo.getBySlug(id);
    }

    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    // Get all tools for this company
    const allTools = await toolsRepo.getAll();
    const companyTools = allTools.filter((tool) => tool.company_id === company.id);

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
    loggers.api.error("Get company tools error", { error, companyId: id });

    return NextResponse.json(
      {
        error: "Failed to fetch company tools",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
