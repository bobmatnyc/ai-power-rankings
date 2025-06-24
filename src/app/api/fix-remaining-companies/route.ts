import { NextResponse } from "next/server";
import { getPayload } from "payload";
import config from "@payload-config";
import { loggers } from "@/lib/logger";

export async function POST(): Promise<NextResponse> {
  try {
    const payload = await getPayload({ config });
    
    // Company data based on research
    const companyData = [
      {
        toolSlug: "lovable",
        company: {
          name: "Lovable",
          slug: "lovable-dev",
          website_url: "https://lovable.dev",
          company_type: "private",
          founded_year: 2023,
          description: "Stockholm-based AI startup building an AI-powered app builder that enables users to create full-stack web applications without coding.",
        }
      },
      {
        toolSlug: "cline",
        company: {
          name: "Cline (Open Source)",
          slug: "cline-ai",
          website_url: "https://cline.bot",
          company_type: "private",
          founded_year: 2024,
          description: "Open-source AI coding assistant VSCode extension, previously known as Claude Dev.",
        }
      },
      {
        toolSlug: "cursor",
        company: {
          name: "Anysphere Inc.",
          slug: "anysphere",
          website_url: "https://anysphere.inc",
          company_type: "private",
          founded_year: 2022,
          description: "Applied research lab building AI-powered code editor Cursor. Founded by MIT graduates.",
        }
      }
    ];
    
    const report = {
      created: [] as any[],
      updated: [] as any[],
      errors: [] as any[],
    };
    
    for (const item of companyData) {
      try {
        // Find the tool
        const { docs: tools } = await payload.find({
          collection: "tools",
          where: {
            slug: { equals: item.toolSlug }
          },
          limit: 1,
        });
        
        if (tools.length === 0) {
          report.errors.push({
            tool: item.toolSlug,
            error: "Tool not found",
          });
          continue;
        }
        
        const tool = tools[0];
        
        // Check if company already exists
        const { docs: existingCompanies } = await payload.find({
          collection: "companies",
          where: {
            slug: { equals: item.company.slug }
          },
          limit: 1,
        });
        
        let company;
        
        if (existingCompanies.length > 0) {
          // Company exists, just update the tool
          company = existingCompanies[0];
          report.updated.push({
            company: company['name'],
            action: "Existing company used",
          });
        } else {
          // Create new company
          company = await payload.create({
            collection: "companies",
            data: item.company,
          });
          report.created.push({
            company: company['name'],
            slug: company['slug'],
          });
          loggers.api.info(`Created company: ${company['name']}`);
        }
        
        // Update the tool to point to the correct company
        await payload.update({
          collection: "tools",
          id: tool.id,
          data: {
            company: company.id,
          },
        });
        
        loggers.api.info(`Updated tool ${tool['name']} to company ${company['name']}`);
        
        // Find and delete the Unknown Company if no other tools reference it
        const currentCompanyId = typeof tool['company'] === 'object' ? tool['company']['id'] : tool['company'];
        
        if (currentCompanyId) {
          const { totalDocs: remainingTools } = await payload.find({
            collection: "tools",
            where: {
              company: { equals: currentCompanyId }
            },
            limit: 0,
          });
          
          if (remainingTools === 0) {
            // Delete the Unknown Company
            await payload.delete({
              collection: "companies",
              id: currentCompanyId,
            });
            loggers.api.info(`Deleted Unknown Company ${currentCompanyId}`);
          }
        }
        
      } catch (error) {
        report.errors.push({
          tool: item.toolSlug,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        loggers.api.error(`Error processing ${item.toolSlug}`, { error });
      }
    }
    
    return NextResponse.json({
      message: "Remaining companies fixed",
      report,
    });
    
  } catch (error) {
    loggers.api.error("Failed to fix remaining companies", { error });
    return NextResponse.json(
      { error: "Failed to fix remaining companies" },
      { status: 500 }
    );
  }
}