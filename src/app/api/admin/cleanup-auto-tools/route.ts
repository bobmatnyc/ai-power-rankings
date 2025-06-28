import { NextResponse } from "next/server";
import { loggers } from "@/lib/logger";
import { getToolsRepo } from "@/lib/json-db";

export async function GET() {
  try {
    const toolsRepo = getToolsRepo();
    
    // Get all tools that contain auto-creation description
    const allTools = await toolsRepo.getAll();
    const autoCreatedTools = allTools.filter(tool => 
      tool.info?.description?.includes("Tool created during news ingestion") ||
      tool.info?.description?.includes("Tool mentioned in news article")
    );

    return NextResponse.json({
      message: "Found auto-created tools",
      count: autoCreatedTools.length,
      tools: autoCreatedTools.map(tool => ({
        id: tool.id,
        slug: tool.slug,
        name: tool.name,
        description: tool.info?.description,
      })),
    });
  } catch (error) {
    loggers.api.error("Error finding auto-created tools", { error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const toolsRepo = getToolsRepo();
    
    // Get all tools that contain auto-creation description
    const allTools = await toolsRepo.getAll();
    const autoCreatedTools = allTools.filter(tool => 
      tool.info?.description?.includes("Tool created during news ingestion") ||
      tool.info?.description?.includes("Tool mentioned in news article")
    );
    
    const deletedTools = [];
    
    for (const tool of autoCreatedTools) {
      try {
        // Delete the tool
        const deleted = await toolsRepo.delete(tool.id);
        if (deleted) {
          deletedTools.push({
            id: tool.id,
            slug: tool.slug,
            name: tool.name,
          });
          loggers.api.info(`Deleted auto-created tool: ${tool.name} (${tool.slug})`);
        }
      } catch (deleteError) {
        loggers.api.error(`Failed to delete tool ${tool.name}`, { error: deleteError });
      }
    }

    return NextResponse.json({
      message: `Successfully deleted ${deletedTools.length} auto-created tools`,
      deletedTools,
      totalFound: autoCreatedTools.length,
    });
  } catch (error) {
    loggers.api.error("Error deleting auto-created tools", { error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
