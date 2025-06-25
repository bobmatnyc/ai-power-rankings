import { NextRequest, NextResponse } from "next/server";
import { getPayload } from "payload";
import config from "@payload-config";
import { loggers } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config });
    const { toolIds } = await request.json();

    if (!Array.isArray(toolIds) || toolIds.length === 0) {
      return NextResponse.json({ error: "toolIds array is required" }, { status: 400 });
    }

    const deletedTools = [];
    const errors = [];

    for (const toolId of toolIds) {
      try {
        // First get the tool info
        const tool = await payload.findByID({
          collection: "tools",
          id: toolId,
        });

        // First, remove references from news articles
        const newsResponse = await payload.find({
          collection: "news",
          where: {
            or: [{ related_tools: { in: [toolId] } }, { primary_tool: { equals: toolId } }],
          },
          limit: 1000,
        });

        // Update news articles to remove references
        for (const news of newsResponse.docs) {
          const updatedRelatedTools =
            news['related_tools']?.filter((id: any) => {
              const toolRef = typeof id === "string" ? id : id.id;
              return toolRef !== toolId;
            }) || [];

          const updatedPrimaryTool = news['primary_tool'] === toolId ? null : news['primary_tool'];

          await payload.update({
            collection: "news",
            id: news.id,
            data: {
              related_tools: updatedRelatedTools,
              primary_tool: updatedPrimaryTool,
            },
          });
        }

        // Remove from rankings
        const rankingsResponse = await payload.find({
          collection: "rankings",
          where: {
            tool: { equals: toolId },
          },
          limit: 1000,
        });

        for (const ranking of rankingsResponse.docs) {
          await payload.delete({
            collection: "rankings",
            id: ranking.id,
          });
        }

        // Remove from metrics
        const metricsResponse = await payload.find({
          collection: "metrics",
          where: {
            tool: { equals: toolId },
          },
          limit: 1000,
        });

        for (const metric of metricsResponse.docs) {
          await payload.delete({
            collection: "metrics",
            id: metric.id,
          });
        }

        // Finally delete the tool
        await payload.delete({
          collection: "tools",
          id: toolId,
        });

        deletedTools.push({
          id: tool.id,
          slug: tool['slug'],
          name: tool['name'],
        });

        loggers.api.info(`Deleted tool: ${tool['name']} (${tool['slug']})`);
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
