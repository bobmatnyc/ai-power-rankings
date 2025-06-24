import { NextResponse } from "next/server";
import { getPayload } from "payload";
import config from "@payload-config";
import { loggers } from "@/lib/logger";

export async function POST(): Promise<NextResponse> {
  try {
    const payload = await getPayload({ config });
    
    // Get remaining Unknown Companies
    const { docs: unknownCompanies } = await payload.find({
      collection: "companies",
      where: {
        name: {
          contains: "Unknown Company"
        }
      },
      limit: 100,
    });
    
    loggers.api.info(`Processing ${unknownCompanies.length} remaining Unknown Companies`);
    
    const report = {
      reassigned: [] as any[],
      deleted: [] as any[],
      errors: [] as any[],
    };
    
    // Known duplicate cases
    const duplicateMappings: Record<string, string> = {
      'Windsurf': 'codeium', // Windsurf is made by Codeium
      'Lovable': 'lovable-dev', // Try alternative slug
      'Google Gemini Code Assist': 'google',
      'Google Jules': 'google',
      'v0': 'vercel',
      'Replit Agent': 'replit',
      'Cline': 'claude-ai', // Cline might be related to Claude
      'Bolt.new': 'stackblitz',
      'Claude Artifacts': 'anthropic',
      'Claude Code': 'anthropic',
      'GitHub Copilot': 'github',
      'Cursor': 'anysphere-inc',
    };
    
    for (const unknownCompany of unknownCompanies) {
      try {
        // Get tools for this company
        const { docs: tools } = await payload.find({
          collection: "tools",
          where: {
            company: {
              equals: unknownCompany.id
            }
          },
          limit: 10,
        });
        
        if (tools.length === 0) {
          // No tools - delete the company
          await payload.delete({
            collection: "companies",
            id: unknownCompany.id,
          });
          report.deleted.push({
            id: unknownCompany.id,
            name: unknownCompany['name'],
          });
          loggers.api.info(`Deleted orphaned company: ${unknownCompany['name']}`);
          continue;
        }
        
        // Check if we can reassign tools to existing companies
        let reassigned = false;
        for (const tool of tools) {
          const toolName = String(tool['name'] || '');
          const existingCompanySlug = duplicateMappings[toolName];
          
          if (existingCompanySlug) {
            // Find the existing company
            const { docs: existingCompanies } = await payload.find({
              collection: "companies",
              where: {
                slug: { equals: existingCompanySlug }
              },
              limit: 1,
            });
            
            if (existingCompanies.length > 0) {
              const existingCompany = existingCompanies[0];
              
              // Update the tool to point to the existing company
              await payload.update({
                collection: "tools",
                id: tool.id,
                data: {
                  company: existingCompany.id,
                },
              });
              
              report.reassigned.push({
                tool: toolName,
                from_company: unknownCompany['name'],
                to_company: existingCompany['name'],
              });
              
              reassigned = true;
              loggers.api.info(`Reassigned tool ${toolName} to ${existingCompany['name']}`);
            }
          }
        }
        
        // If all tools were reassigned, delete the unknown company
        if (reassigned) {
          // Check if any tools still reference this company
          const { totalDocs: remainingTools } = await payload.find({
            collection: "tools",
            where: {
              company: {
                equals: unknownCompany.id
              }
            },
            limit: 0,
          });
          
          if (remainingTools === 0) {
            await payload.delete({
              collection: "companies",
              id: unknownCompany.id,
            });
            report.deleted.push({
              id: unknownCompany.id,
              name: unknownCompany['name'],
              reason: "All tools reassigned",
            });
          }
        }
        
      } catch (error) {
        report.errors.push({
          company: unknownCompany['name'],
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        loggers.api.error(`Error processing company ${unknownCompany.id}`, { error });
      }
    }
    
    return NextResponse.json({
      message: "Final cleanup complete",
      report,
    });
    
  } catch (error) {
    loggers.api.error("Failed to perform final cleanup", { error });
    return NextResponse.json(
      { error: "Failed to perform final cleanup" },
      { status: 500 }
    );
  }
}