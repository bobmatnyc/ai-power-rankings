import { NextResponse } from "next/server";
import { getPayload } from "payload";
import config from "@payload-config";
import { loggers } from "@/lib/logger";

export async function GET(): Promise<NextResponse> {
  try {
    const payload = await getPayload({ config });
    
    // Get a simple count first
    const { totalDocs: totalCompanies } = await payload.find({
      collection: "companies",
      limit: 0, // Just get the count
    });
    
    // Get Unknown Company count
    const { totalDocs: unknownCount } = await payload.find({
      collection: "companies",
      where: {
        name: {
          contains: "Unknown Company"
        }
      },
      limit: 0, // Just get the count
    });
    
    // Get a sample of Unknown Companies (just 5)
    const { docs: sampleUnknown } = await payload.find({
      collection: "companies",
      where: {
        name: {
          contains: "Unknown Company"
        }
      },
      limit: 5,
    });
    
    // For each sample, check if it has tools
    const sampleWithTools = [];
    for (const company of sampleUnknown) {
      try {
        const { totalDocs: toolCount } = await payload.find({
          collection: "tools",
          where: {
            company: {
              equals: company.id
            }
          },
          limit: 0, // Just get the count
        });
        
        sampleWithTools.push({
          id: company.id,
          name: company['name'],
          slug: company['slug'],
          tool_count: toolCount,
        });
      } catch (error) {
        loggers.api.error(`Error checking tools for company ${company.id}`, { error });
      }
    }
    
    return NextResponse.json({
      summary: {
        total_companies: totalCompanies,
        unknown_companies: unknownCount,
        percentage_unknown: ((unknownCount / totalCompanies) * 100).toFixed(2) + '%',
      },
      sample_unknown_companies: sampleWithTools,
      recommendation: unknownCount > 0 ? 
        "Run the /api/fix-unknown-companies endpoint to analyze and fix these entries" : 
        "No Unknown Company entries found",
    });
    
  } catch (error) {
    loggers.api.error("Failed to diagnose companies", { error });
    return NextResponse.json(
      { 
        error: "Failed to diagnose companies",
        message: error instanceof Error ? error.message : 'Unknown error',
        hint: "The database connection may have been terminated. Try restarting your development server."
      },
      { status: 500 }
    );
  }
}