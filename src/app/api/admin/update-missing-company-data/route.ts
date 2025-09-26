import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { CompaniesRepository } from "@/lib/db/repositories/companies.repository";
import { loggers } from "@/lib/logger";

const companyUpdates = [
  { name: "Microsoft", founded: "1975", website: "https://microsoft.com" },
  { name: "Sourcegraph", founded: "2013", website: "https://sourcegraph.com" },
  { name: "CodeRabbit", founded: "2023", website: "https://coderabbit.ai" },
  { name: "Amazon", founded: "1994", website: "https://amazon.com" },
  { name: "Augment", founded: "2022", website: "https://augmentcode.com" },
  { name: "Zed Industries", founded: "2021", website: "https://zed.dev" },
  { name: "JetBrains", founded: "2000", website: "https://jetbrains.com" },
  { name: "Tabnine", founded: "2013", website: "https://tabnine.com" },
  { name: "Diffblue", founded: "2016", website: "https://diffblue.com" },
  { name: "OpenAI", founded: "2015", website: "https://openai.com" },
  { name: "Snyk", founded: "2015", website: "https://snyk.io" },
  { name: "Qodo", founded: "2022", website: "https://qodo.ai" },
  { name: "Sourcery AI", founded: "2020", website: "https://sourcery.ai" },
  { name: "OpenHands", founded: "2024", website: "https://all-hands.dev" },
  { name: "Continue", founded: "2023", website: "https://continue.dev" },
  { name: "Aider", founded: "2023", website: "https://aider.chat" },
  { name: "Cognition AI", founded: "2023", website: "https://cognition.ai" },
];

export async function POST(_request: NextRequest) {
  // Check admin authentication
  const authResult = await requireAdmin();
  if (authResult.error) {
    return authResult.error;
  }

  try {
    const companiesRepo = new CompaniesRepository();
    loggers.api.info("Updating missing company data...");

    const results = {
      total: companyUpdates.length,
      updated: 0,
      notFound: [] as string[],
      errors: [] as string[],
    };

    // Get all companies
    const allCompanies = await companiesRepo.findAll();

    for (const update of companyUpdates) {
      try {
        // Find company by name
        const company = allCompanies.find(
          (c) => c.name.toLowerCase() === update.name.toLowerCase()
        );

        if (!company) {
          results.notFound.push(update.name);
          continue;
        }

        let needsUpdate = false;
        const updatedData: any = {};

        // Only update if the field is missing
        if (!company.founded && update.founded) {
          updatedData.founded = update.founded;
          needsUpdate = true;
        }
        if (!company.website && update.website) {
          updatedData.website = update.website;
          needsUpdate = true;
        }

        // If there's something to update
        if (needsUpdate) {
          await companiesRepo.update(company.id, updatedData);
          results.updated++;
          loggers.api.info(`Updated ${update.name}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.errors.push(`${update.name}: ${errorMessage}`);
        loggers.api.error(`Error updating ${update.name}:`, error);
      }
    }

    loggers.api.info(`Update complete: ${results.updated} companies updated`);

    return NextResponse.json({
      success: true,
      message: `Updated ${results.updated} out of ${results.total} companies`,
      results,
    });
  } catch (error) {
    loggers.api.error("Error updating company data:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        details: errorStack,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Check admin authentication
  const authResult = await requireAdmin();
  if (authResult.error) {
    return authResult.error;
  }

  try {
    const companiesRepo = new CompaniesRepository();

    // Get all companies and filter for missing data
    const allCompanies = await companiesRepo.findAll();

    const companiesWithMissingData = allCompanies.filter(
      (company) => !company.founded || !company.website
    );

    const missingData = companiesWithMissingData.map((company) => ({
      id: company.id,
      name: company.name,
      slug: company.slug,
      missing: {
        founded: !company.founded,
        website: !company.website,
      },
      current: {
        founded: company.founded || null,
        website: company.website || null,
      },
    }));

    return NextResponse.json({
      total: companiesWithMissingData.length,
      companies: missingData,
    });
  } catch (error) {
    loggers.api.error("Error checking company data:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}