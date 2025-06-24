import { NextResponse } from "next/server";
import { getPayload } from "payload";
import config from "@payload-config";
import { loggers } from "@/lib/logger";

export async function GET(): Promise<NextResponse> {
  try {
    const payload = await getPayload({ config });
    
    // Find all Unknown Company entries
    const { docs: unknownCompanies } = await payload.find({
      collection: "companies",
      where: {
        name: {
          contains: "Unknown Company"
        }
      },
      limit: 100,
    });
    
    loggers.api.info(`Found ${unknownCompanies.length} Unknown Company entries`);
    
    const report = {
      total_unknown_companies: unknownCompanies.length,
      companies_with_tools: [] as any[],
      orphaned_companies: [] as any[],
      fixed_companies: [] as any[],
    };
    
    // For each unknown company, check if it's referenced by any tools
    for (const company of unknownCompanies) {
      const { docs: tools } = await payload.find({
        collection: "tools",
        where: {
          company: {
            equals: company.id
          }
        },
        limit: 100,
      });
      
      if (tools.length > 0) {
        // This company is referenced by tools
        report.companies_with_tools.push({
          company_id: company.id,
          company_name: company['name'],
          tools: tools.map((tool: any) => ({
            id: tool.id,
            name: tool.name,
            slug: tool.slug,
          })),
        });
        
        // Try to fix the company name based on the tool
        if (tools.length === 1) {
          // If only one tool references this company, we can infer the company name
          const tool = tools[0];
          if (!tool) continue;
          
          const toolName = String(tool['name'] || '');
          let inferredCompanyName = toolName;
          
          // Common patterns to extract company name from tool name
          if (toolName.includes(' - ')) {
            inferredCompanyName = toolName.split(' - ')[0] || toolName;
          } else if (toolName.includes(' by ')) {
            inferredCompanyName = toolName.split(' by ')[1] || toolName;
          } else if (toolName.includes('(') && toolName.includes(')')) {
            // Extract from parentheses if it looks like a company name
            const match = toolName.match(/\(([^)]+)\)/);
            if (match && match[1] && !match[1].includes(' ')) {
              inferredCompanyName = match[1];
            }
          }
          
          // Update the company with the inferred name
          if (inferredCompanyName && inferredCompanyName !== toolName) {
            try {
              await payload.update({
                collection: "companies",
                id: company.id,
                data: {
                  name: inferredCompanyName,
                  slug: inferredCompanyName.toLowerCase().replace(/\s+/g, '-'),
                },
              });
              
              report.fixed_companies.push({
                company_id: company.id,
                old_name: company['name'],
                new_name: inferredCompanyName,
                tool: toolName,
              });
            } catch (error) {
              loggers.api.error(`Failed to update company ${company.id}`, { error });
            }
          }
        }
      } else {
        // This company is orphaned (not referenced by any tools)
        report.orphaned_companies.push({
          company_id: company.id,
          company_name: company['name'],
        });
      }
    }
    
    // Log summary
    loggers.api.info("Unknown companies analysis complete", {
      total: report.total_unknown_companies,
      with_tools: report.companies_with_tools.length,
      orphaned: report.orphaned_companies.length,
      fixed: report.fixed_companies.length,
    });
    
    return NextResponse.json({
      message: "Unknown companies analysis complete",
      report,
      next_steps: {
        orphaned_companies: "These companies can be safely deleted as they are not referenced by any tools",
        companies_with_tools: "These companies need manual review to determine the correct company name",
        fixed_companies: "These companies were automatically fixed based on their associated tools",
      },
    });
    
  } catch (error) {
    loggers.api.error("Failed to analyze unknown companies", { error });
    return NextResponse.json(
      { error: "Failed to analyze unknown companies" },
      { status: 500 }
    );
  }
}

export async function DELETE(): Promise<NextResponse> {
  try {
    const payload = await getPayload({ config });
    
    // Find all orphaned Unknown Company entries
    const { docs: unknownCompanies } = await payload.find({
      collection: "companies",
      where: {
        name: {
          contains: "Unknown Company"
        }
      },
      limit: 100,
    });
    
    let deletedCount = 0;
    const errors: any[] = [];
    
    for (const company of unknownCompanies) {
      // Check if this company is referenced by any tools
      const { docs: tools } = await payload.find({
        collection: "tools",
        where: {
          company: {
            equals: company.id
          }
        },
        limit: 1,
      });
      
      if (tools.length === 0) {
        // This company is orphaned, delete it
        try {
          await payload.delete({
            collection: "companies",
            id: company.id,
          });
          deletedCount++;
          loggers.api.info(`Deleted orphaned company: ${company['name']} (${company.id})`);
        } catch (error) {
          errors.push({
            company_id: company.id,
            company_name: company['name'],
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }
    
    return NextResponse.json({
      message: "Orphaned companies cleanup complete",
      deleted_count: deletedCount,
      errors,
    });
    
  } catch (error) {
    loggers.api.error("Failed to delete orphaned companies", { error });
    return NextResponse.json(
      { error: "Failed to delete orphaned companies" },
      { status: 500 }
    );
  }
}