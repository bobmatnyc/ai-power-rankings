import { NextRequest, NextResponse } from "next/server";
import { loggers } from "@/lib/logger";
import { getCompaniesRepo } from "@/lib/json-db";

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
  try {
    const companiesRepo = getCompaniesRepo();
    loggers.api.info("Updating missing company data...");

    const results = {
      total: companyUpdates.length,
      updated: 0,
      notFound: [] as string[],
      errors: [] as string[],
    };

    // Get all companies
    const allCompanies = await companiesRepo.getAll();

    for (const update of companyUpdates) {
      try {
        // Find company by name
        const company = allCompanies.find(c => c.name.toLowerCase() === update.name.toLowerCase());

        if (!company) {
          results.notFound.push(update.name);
          continue;
        }

        let needsUpdate = false;
        const updatedCompany = { ...company };

        // Only update if the field is missing
        if (!company.founded && update.founded) {
          updatedCompany.founded = update.founded;
          needsUpdate = true;
        }
        if (!company.website && update.website) {
          updatedCompany.website = update.website;
          needsUpdate = true;
        }

        // If there's something to update
        if (needsUpdate) {
          updatedCompany.updated_at = new Date().toISOString();
          await companiesRepo.upsert(updatedCompany);
          results.updated++;
          loggers.api.info(`Updated ${update.name}`);
        }
      } catch (error: any) {
        results.errors.push(`${update.name}: ${error.message}`);
        loggers.api.error(`Error updating ${update.name}:`, error);
      }
    }

    loggers.api.info(`Update complete: ${results.updated} companies updated`);

    return NextResponse.json({
      success: true,
      message: `Updated ${results.updated} out of ${results.total} companies`,
      results,
    });
  } catch (error: any) {
    loggers.api.error("Error updating company data:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        details: error.stack,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const companiesRepo = getCompaniesRepo();

    // Get all companies and filter for missing data
    const allCompanies = await companiesRepo.getAll();
    
    const companiesWithMissingData = allCompanies.filter(company => 
      !company.founded || !company.website
    );

    const missingData = companiesWithMissingData.map(company => ({
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
  } catch (error: any) {
    loggers.api.error("Error checking company data:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
