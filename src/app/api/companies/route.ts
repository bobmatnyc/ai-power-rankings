import { type NextRequest, NextResponse } from "next/server";
import { cachedJsonResponse } from "@/lib/api-cache";
import { companiesRepository } from "@/lib/db/repositories/companies.repository";
import { loggers } from "@/lib/logger";
import type { Company } from "@/lib/json-db/schemas";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "50");
    const page = parseInt(searchParams.get("page") || "1");
    const search = searchParams.get("search");
    const size = searchParams.get("size");

    let companiesData: Awaited<ReturnType<typeof companiesRepository.findAll>>;

    // Apply filters
    if (search) {
      companiesData = await companiesRepository.search(search);
    } else if (size) {
      companiesData = await companiesRepository.findBySize(size);
    } else {
      companiesData = await companiesRepository.findAll();
    }

    // Convert CompanyData to Company format, normalizing description field
    const companies: Company[] = companiesData.map(company => ({
      id: company.id,
      slug: company.slug,
      name: company.name,
      description: typeof company.description === 'string'
        ? company.description
        : Array.isArray(company.description)
          ? company.description.map(block =>
              block.children?.map(child => child.text).join('') || ''
            ).join('\n')
          : undefined,
      website: company.website,
      founded: company.founded,
      headquarters: company.headquarters,
      size: company.size,
      funding_total: company["funding_total"] as number | undefined,
      last_funding_round: company["last_funding_round"] as string | undefined,
      investors: company["investors"] as string[] | undefined,
      created_at: company.created_at || new Date().toISOString(),
      updated_at: company.updated_at || new Date().toISOString(),
    }))

    // Sort alphabetically by name
    companies.sort((a, b) => a.name.localeCompare(b.name));

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedCompanies = companies.slice(startIndex, endIndex);

    return cachedJsonResponse(
      {
        companies: paginatedCompanies,
        total: companies.length,
        page,
        totalPages: Math.ceil(companies.length / limit),
        hasMore: endIndex < companies.length,
        _source: process.env["USE_DATABASE"] === "true" ? "postgresql" : "json-db",
      },
      "/api/companies"
    );
  } catch (error) {
    loggers.api.error("Companies API error", { error });

    return NextResponse.json(
      {
        error: "Failed to fetch companies",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Create new company
export async function POST(request: NextRequest) {
  try {
    // TODO: Add authentication check here

    const body = await request.json() as Partial<Company>;

    // Generate slug if not provided
    const slug =
      body.slug ||
      body.name
        ?.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .trim() || "";

    const company: Company = {
      id: body.id || `company-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      slug,
      name: body.name || "",
      ...(body.description && { description: body.description }),
      ...(body.website && { website: body.website }),
      ...(body.founded && { founded: body.founded }),
      ...(body.headquarters && { headquarters: body.headquarters }),
      ...(body.size && { size: body.size }),
      ...(body.funding_total !== undefined && { funding_total: body.funding_total }),
      ...(body.last_funding_round && { last_funding_round: body.last_funding_round }),
      ...(body.investors && { investors: body.investors }),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const createdCompanyData = await companiesRepository.create(company as any); // Type mismatch due to repository expecting CompanyData

    // Convert back to Company format
    const createdCompany: Company = {
      id: createdCompanyData.id,
      slug: createdCompanyData.slug,
      name: createdCompanyData.name,
      description: typeof createdCompanyData.description === 'string'
        ? createdCompanyData.description
        : Array.isArray(createdCompanyData.description)
          ? createdCompanyData.description.map(block =>
              block.children?.map(child => child.text).join('') || ''
            ).join('\n')
          : undefined,
      website: createdCompanyData.website,
      founded: createdCompanyData.founded,
      headquarters: createdCompanyData.headquarters,
      size: createdCompanyData.size,
      funding_total: createdCompanyData["funding_total"] as number | undefined,
      last_funding_round: createdCompanyData["last_funding_round"] as string | undefined,
      investors: createdCompanyData["investors"] as string[] | undefined,
      created_at: createdCompanyData.created_at || new Date().toISOString(),
      updated_at: createdCompanyData.updated_at || new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      company: createdCompany,
    });
  } catch (error) {
    loggers.api.error("Create company error", { error });

    return NextResponse.json(
      {
        error: "Failed to create company",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
