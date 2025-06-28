import { NextRequest, NextResponse } from "next/server";
import { getCompaniesRepo, getToolsRepo } from "@/lib/json-db";
import { loggers } from "@/lib/logger";

type Params = {
  params: {
    id: string;
  };
};

// GET single company by ID or slug
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const companiesRepo = getCompaniesRepo();
    const toolsRepo = getToolsRepo();
    
    // Try to get by ID first, then by slug
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
    
    // Get tools associated with this company
    const allTools = await toolsRepo.getAll();
    const companyTools = allTools.filter(tool => tool.company_id === company.id);
    
    const response = {
      company: {
        ...company,
        tools: companyTools.map(tool => ({
          id: tool.id,
          slug: tool.slug,
          name: tool.name,
          category: tool.category,
          status: tool.status,
        })),
      },
      _source: "json-db",
    };
    
    return NextResponse.json(response);
  } catch (error) {
    loggers.api.error("Get company error", { error, id: params.id });
    
    return NextResponse.json(
      {
        error: "Failed to fetch company",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// UPDATE company
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    // TODO: Add authentication check here
    
    const body = await request.json();
    const companiesRepo = getCompaniesRepo();
    
    // Get existing company
    let existing = await companiesRepo.getById(params.id);
    if (!existing) {
      existing = await companiesRepo.getBySlug(params.id);
    }
    
    if (!existing) {
      return NextResponse.json(
        { error: "Company not found" },
        { status: 404 }
      );
    }
    
    // Update company
    const updatedCompany = {
      ...existing,
      ...body,
      id: existing.id, // Ensure ID doesn't change
      slug: existing.slug, // Ensure slug doesn't change unless explicitly provided
      updated_at: new Date().toISOString(),
    };
    
    await companiesRepo.upsert(updatedCompany);
    
    return NextResponse.json({
      success: true,
      company: updatedCompany,
    });
  } catch (error) {
    loggers.api.error("Update company error", { error, id: params.id });
    
    return NextResponse.json(
      {
        error: "Failed to update company",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// DELETE company
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    // TODO: Add authentication check here
    
    const companiesRepo = getCompaniesRepo();
    const toolsRepo = getToolsRepo();
    
    // Check if company exists
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
    
    // Check if company has associated tools
    const allTools = await toolsRepo.getAll();
    const companyTools = allTools.filter(tool => tool.company_id === company.id);
    
    if (companyTools.length > 0) {
      return NextResponse.json(
        { 
          error: "Cannot delete company with associated tools",
          tools: companyTools.map(t => ({ id: t.id, name: t.name }))
        },
        { status: 400 }
      );
    }
    
    const deleted = await companiesRepo.delete(company.id);
    
    if (!deleted) {
      return NextResponse.json(
        { error: "Failed to delete company" },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: "Company deleted successfully",
    });
  } catch (error) {
    loggers.api.error("Delete company error", { error, id: params.id });
    
    return NextResponse.json(
      {
        error: "Failed to delete company",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}