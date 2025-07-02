import { type NextRequest, NextResponse } from "next/server";
import { loggers } from "@/lib/logger";
import { getToolsRepo, getNewsRepo } from "@/lib/json-db";

export async function POST(request: NextRequest) {
  try {
    const toolsRepo = getToolsRepo();
    const newsRepo = getNewsRepo();
    const { toolIds } = await request.json();

    if (!Array.isArray(toolIds) || toolIds.length === 0) {
      return NextResponse.json({ error: "toolIds array is required" }, { status: 400 });
    }

    const deletedTools = [];
    const errors = [];

    for (const toolId of toolIds) {
      try {
        // First get the tool info
        const tool = await toolsRepo.getById(toolId);

        if (!tool) {
          errors.push(`Tool with ID ${toolId} not found`);
          continue;
        }

        // Remove references from news articles
        const newsWithTool = await newsRepo.getByToolMention(toolId);

        for (const news of newsWithTool) {
          // Update the article to remove tool mentions
          const updatedToolMentions = news.tool_mentions?.filter((id) => id !== toolId) || [];

          const updatedNews = {
            ...news,
            tool_mentions: updatedToolMentions,
            updated_at: new Date().toISOString(),
          };

          await newsRepo.upsert(updatedNews);
        }

        // Note: Rankings and metrics would need their own repositories to clean up
        // For now, we'll just delete the tool and log warnings about orphaned data
        loggers.api.warn(
          `Deleting tool ${tool.name} - rankings and metrics may need manual cleanup`
        );

        // Delete the tool
        const deleted = await toolsRepo.delete(toolId);

        if (deleted) {
          deletedTools.push({
            id: tool.id,
            slug: tool.slug,
            name: tool.name,
          });
          loggers.api.info(`Deleted tool: ${tool.name} (${tool.slug})`);
        } else {
          errors.push(`Failed to delete tool ${tool.name}`);
        }
      } catch (deleteError) {
        const errorMsg = `Failed to delete tool ID ${toolId}: ${deleteError instanceof Error ? deleteError.message : "Unknown error"}`;
        errors.push(errorMsg);
        loggers.api.error(errorMsg, { error: deleteError });
      }
    }

    return NextResponse.json({
      message: `Successfully deleted ${deletedTools.length} tools`,
      deletedTools,
      errors,
      totalRequested: toolIds.length,
    });
  } catch (error) {
    loggers.api.error("Error in delete-tools endpoint", { error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
