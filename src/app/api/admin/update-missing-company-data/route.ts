import { NextRequest, NextResponse } from "next/server";
import { getPayloadClient } from "@/lib/payload-direct";
import { logger } from "@/lib/logger";

const companyUpdates = [
  { name: "Microsoft", founded_year: 1975, website_url: "https://microsoft.com" },
  { name: "Sourcegraph", founded_year: 2013, website_url: "https://sourcegraph.com" },
  { name: "CodeRabbit", founded_year: 2023, website_url: "https://coderabbit.ai" },
  { name: "Amazon", founded_year: 1994, website_url: "https://amazon.com" },
  { name: "Augment", founded_year: 2022, website_url: "https://augmentcode.com" },
  { name: "Zed Industries", founded_year: 2021, website_url: "https://zed.dev" },
  { name: "JetBrains", founded_year: 2000, website_url: "https://jetbrains.com" },
  { name: "Tabnine", founded_year: 2013, website_url: "https://tabnine.com" },
  { name: "Diffblue", founded_year: 2016, website_url: "https://diffblue.com" },
  { name: "OpenAI", founded_year: 2015, website_url: "https://openai.com" },
  { name: "Snyk", founded_year: 2015, website_url: "https://snyk.io" },
  { name: "Qodo", founded_year: 2022, website_url: "https://qodo.ai" },
  { name: "Sourcery AI", founded_year: 2020, website_url: "https://sourcery.ai" },
  { name: "OpenHands", founded_year: 2024, website_url: "https://all-hands.dev" },
  { name: "Continue", founded_year: 2023, website_url: "https://continue.dev" },
  { name: "Aider", founded_year: 2023, website_url: "https://aider.chat" },
  { name: "Cognition AI", founded_year: 2023, website_url: "https://cognition.ai" },
];

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayloadClient();
    logger.info("Updating missing company data...");

    const results = {
      total: companyUpdates.length,
      updated: 0,
      notFound: [] as string[],
      errors: [] as string[],
    };

    for (const update of companyUpdates) {
      try {
        // Find company by name
        const companies = await payload.find({
          collection: "companies",
          where: {
            name: {
              equals: update.name,
            },
          },
          limit: 1,
        });

        if (companies.docs.length === 0) {
          results.notFound.push(update.name);
          continue;
        }

        const company = companies.docs[0];
        const updateData: any = {};

        // Only update if the field is missing
        if (!company.founded_year && update.founded_year) {
          updateData.founded_year = update.founded_year;
        }
        if (!company.website_url && update.website_url) {
          updateData.website_url = update.website_url;
        }

        // If there's something to update
        if (Object.keys(updateData).length > 0) {
          await payload.update({
            collection: "companies",
            id: company.id,
            data: updateData,
          });
          results.updated++;
          logger.info(`Updated ${update.name}:`, updateData);
        }
      } catch (error: any) {
        results.errors.push(`${update.name}: ${error.message}`);
        logger.error(`Error updating ${update.name}:`, error);
      }
    }

    logger.info(`Update complete: ${results.updated} companies updated`);

    return NextResponse.json({
      success: true,
      message: `Updated ${results.updated} out of ${results.total} companies`,
      results,
    });
  } catch (error: any) {
    logger.error("Error updating company data:", error);
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
    const payload = await getPayloadClient();

    // Get companies with missing data
    const companies = await payload.find({
      collection: "companies",
      where: {
        or: [
          {
            founded_year: {
              exists: false,
            },
          },
          {
            website_url: {
              exists: false,
            },
          },
        ],
      },
      limit: 100,
    });

    const missingData = companies.docs.map((company: any) => ({
      id: company.id,
      name: company.name,
      slug: company.slug,
      missing: {
        founded_year: !company.founded_year,
        website_url: !company.website_url,
      },
      current: {
        founded_year: company.founded_year || null,
        website_url: company.website_url || null,
      },
    }));

    return NextResponse.json({
      total: companies.totalDocs,
      companies: missingData,
    });
  } catch (error: any) {
    logger.error("Error checking company data:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
