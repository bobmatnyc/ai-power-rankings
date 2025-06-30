import { NextResponse } from "next/server";
import { loggers } from "@/lib/logger";
import { getCompaniesRepo } from "@/lib/json-db";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { id, name, slug } = await request.json();

    if (!id || !name || !slug) {
      return NextResponse.json(
        { error: "Missing required fields: id, name, slug" },
        { status: 400 }
      );
    }

    const companiesRepo = getCompaniesRepo();

    // Get the existing company
    const existingCompany = await companiesRepo.getById(id);

    if (!existingCompany) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    // Update the company
    const updatedCompany = {
      ...existingCompany,
      name,
      slug,
      updated_at: new Date().toISOString(),
    };

    await companiesRepo.upsert(updatedCompany);

    loggers.api.info(`Updated company ${id}: ${name}`);

    return NextResponse.json({
      success: true,
      company: {
        id: updatedCompany.id,
        name: updatedCompany.name,
        slug: updatedCompany.slug,
      },
    });
  } catch (error) {
    loggers.api.error("Failed to update company", { error });
    return NextResponse.json(
      {
        error: "Failed to update company",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
