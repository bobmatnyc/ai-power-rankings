import { NextRequest, NextResponse } from "next/server";
import { getCompaniesRepo } from "@/lib/json-db";
import { loggers } from "@/lib/logger";
import { cachedJsonResponse } from "@/lib/api-cache";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "50");
    const page = parseInt(searchParams.get("page") || "1");
    const search = searchParams.get("search");
    const size = searchParams.get("size");

    const companiesRepo = getCompaniesRepo();

    let companies;

    // Apply filters
    if (search) {
      companies = await companiesRepo.search(search);
    } else if (size) {
      companies = await companiesRepo.getBySize(size);
    } else {
      companies = await companiesRepo.getAll();
    }

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
        _source: "json-db",
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

    const body = await request.json();
    const companiesRepo = getCompaniesRepo();

    // Generate slug if not provided
    const slug =
      body.slug ||
      body.name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .trim();

    const company = {
      id: body.id || `company-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      slug,
      name: body.name,
      description: body.description,
      website: body.website,
      founded: body.founded,
      headquarters: body.headquarters,
      size: body.size,
      funding_total: body.funding_total,
      last_funding_round: body.last_funding_round,
      investors: body.investors || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await companiesRepo.upsert(company);

    return NextResponse.json({
      success: true,
      company,
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
