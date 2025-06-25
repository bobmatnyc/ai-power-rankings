import { NextResponse } from "next/server";
import { getPayload } from "payload";
import config from "@payload-config";
import { payloadDirect } from "@/lib/payload-direct";
import { loggers } from "@/lib/logger";

export async function GET() {
  try {
    // Get all tools that were auto-created during news ingestion
    const toolsResponse = await payloadDirect.getTools({
      limit: 1000,
      where: {
        description: {
          contains: "Tool created during news ingestion",
        },
      },
    });

    const autoCreatedTools = toolsResponse.docs || [];

    return NextResponse.json({
      message: "Found auto-created tools",
      count: autoCreatedTools.length,
      tools: autoCreatedTools.map((tool: any) => ({
        id: tool.id,
        slug: tool.slug,
        name: tool.name,
        description: tool.description,
      })),
    });
  } catch (error) {
    loggers.api.error("Error finding auto-created tools", { error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    // Get all tools that were auto-created during news ingestion
    const toolsResponse = await payloadDirect.getTools({
      limit: 1000,
      where: {
        description: {
          contains: "Tool created during news ingestion",
        },
      },
    });

    const autoCreatedTools = toolsResponse.docs || [];
    const deletedTools = [];

    const payload = await getPayload({ config });
    
    for (const tool of autoCreatedTools) {
      try {
        // Delete the tool
        await payload.delete({
          collection: "tools",
          id: tool.id,
        });
        deletedTools.push({
          id: tool.id,
          slug: tool.slug,
          name: tool.name,
        });
        loggers.api.info(`Deleted auto-created tool: ${tool.name} (${tool.slug})`);
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
