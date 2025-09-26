import { type NextRequest, NextResponse } from "next/server";
import { cachedJsonResponse } from "@/lib/api-cache";
import { getDb } from "@/lib/db/connection";
import { companiesRepository } from "@/lib/db/repositories/companies.repository";
import { loggers } from "@/lib/logger";

// Define Company interface for API responses
interface Company {
  id: string;
  slug: string;
  name: string;
  description?: string;
  website?: string;
  founded?: string;
  headquarters?: string;
  size?: string;
  funding_total?: number;
  last_funding_round?: string;
  investors?: string[];
  created_at: string;
  updated_at: string;
}

export async function GET(request: NextRequest) {
  try {
    // Ensure database connection is available
    const db = getDb();
    if (!db) {
      loggers.api.error("Database connection not available");
      return NextResponse.json(
        {
          error: "Database connection unavailable",
          message: "The database service is currently unavailable. Please try again later."
        },
        { status: 503 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const search = searchParams.get("search");
    const size = searchParams.get("size");

    loggers.api.debug("Getting companies from database", { limit, page, search, size });

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
    const companies: Company[] = companiesData.map((company) => ({
      id: company.id,
      slug: company.slug,
      name: company.name,
      description:
        typeof company.description === "string"
          ? company.description
          : Array.isArray(company.description)
            ? company.description
                .map((block) => block.children?.map((child) => child.text).join("") || "")
                .join("\n")
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
    }));

    // Sort alphabetically by name
    companies.sort((a, b) => a.name.localeCompare(b.name));

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedCompanies = companies.slice(startIndex, endIndex);

    loggers.api.info("Returning companies response from database", {
      companyCount: paginatedCompanies.length,
      totalCompanies: companies.length,
      page,
    });

    return cachedJsonResponse(
      {
        companies: paginatedCompanies,
        total: companies.length,
        page,
        totalPages: Math.ceil(companies.length / limit),
        hasMore: endIndex < companies.length,
        _source: "database",
        _timestamp: new Date().toISOString(),
      },
      "/api/companies"
    );
  } catch (error) {
    loggers.api.error("Companies API error", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        error: "Failed to fetch companies",
        message: "An error occurred while fetching companies. Please try again later."
      },
      { status: 500 }
    );
  }
}

// Create new company
export async function POST(request: NextRequest) {
  try {
    // Ensure database connection is available
    const db = getDb();
    if (!db) {
      loggers.api.error("Database connection not available");
      return NextResponse.json(
        {
          error: "Database connection unavailable",
          message: "The database service is currently unavailable. Please try again later."
        },
        { status: 503 }
      );
    }

    // TODO: Add authentication check here

    const body = (await request.json()) as Partial<Company>;

    // Generate slug if not provided
    const slug =
      body.slug ||
      body.name
        ?.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .trim() ||
      "";

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

    // Convert Company to the format expected by repository (CompanyData)
    const companyData: Parameters<typeof companiesRepository.create>[0] = {
      ...company,
      funding_total: company.funding_total,
      last_funding_round: company.last_funding_round,
      investors: company.investors,
    };

    const createdCompanyData = await companiesRepository.create(companyData);

    // Convert back to Company format
    const createdCompany: Company = {
      id: createdCompanyData.id,
      slug: createdCompanyData.slug,
      name: createdCompanyData.name,
      description:
        typeof createdCompanyData.description === "string"
          ? createdCompanyData.description
          : Array.isArray(createdCompanyData.description)
            ? createdCompanyData.description
                .map((block) => block.children?.map((child) => child.text).join("") || "")
                .join("\n")
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

    loggers.api.info("Created new company in database", {
      companyId: createdCompany.id,
      companyName: createdCompany.name,
    });

    return NextResponse.json({
      success: true,
      company: createdCompany,
      _source: "database",
    });
  } catch (error) {
    loggers.api.error("Create company error", {
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        error: "Failed to create company",
        message: "An error occurred while creating the company. Please try again later."
      },
      { status: 500 }
    );
  }
}