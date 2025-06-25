import { NextRequest, NextResponse } from "next/server";
import { payloadDirect } from "@/lib/payload-direct";
import { loggers } from "@/lib/logger";

export async function GET() {
  try {
    // Get all pending tools
    const pendingToolsResponse = await payloadDirect.getPendingTools({
      limit: 100,
      where: {
        status: { in: ["pending", "approved_new", "approved_merge"] },
      },
    });

    return NextResponse.json({
      message: "Pending tools retrieved",
      count: pendingToolsResponse.totalDocs,
      tools: pendingToolsResponse.docs,
    });
  } catch (error) {
    loggers.api.error("Error getting pending tools", { error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, pendingToolId, mergeWithToolId, adminNotes } = await request.json();

    if (!pendingToolId || !action) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Get the pending tool
    const pendingTool = await payloadDirect.getPendingToolById(pendingToolId);
    if (!pendingTool) {
      return NextResponse.json({ error: "Pending tool not found" }, { status: 404 });
    }

    let result;

    switch (action) {
      case "approve_new":
        // Create new tool from pending tool
        result = await createNewToolFromPending(pendingTool, adminNotes);
        break;

      case "approve_merge":
        if (!mergeWithToolId) {
          return NextResponse.json(
            { error: "mergeWithToolId required for merge action" },
            { status: 400 }
          );
        }
        result = await mergeWithExistingTool(pendingTool, mergeWithToolId, adminNotes);
        break;

      case "reject":
        result = await rejectPendingTool(pendingToolId, adminNotes);
        break;

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    loggers.api.error("Error processing pending tool", { error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function createNewToolFromPending(pendingTool: any, adminNotes?: string) {
  // Create new tool
  const newTool = await payloadDirect.createTool({
    name: pendingTool.name,
    slug: pendingTool.slug,
    category: pendingTool.suggested_category,
    status: "active",
    description: pendingTool.description,
    website_url: pendingTool.website_url,
  });

  // Update pending tool status
  await payloadDirect.updatePendingTool(pendingTool.id, {
    status: "processed",
    admin_notes: adminNotes || `Approved as new tool: ${newTool.id}`,
  });

  loggers.api.info(`Created new tool from pending: ${pendingTool.name} -> ${newTool.id}`);

  return {
    message: "New tool created successfully",
    newTool,
    pendingTool,
  };
}

async function mergeWithExistingTool(
  pendingTool: any,
  mergeWithToolId: string,
  adminNotes?: string
) {
  // Get the existing tool
  const existingTool = await payloadDirect.getTool(mergeWithToolId);
  if (!existingTool) {
    throw new Error("Target tool for merge not found");
  }

  // Update pending tool status
  await payloadDirect.updatePendingTool(pendingTool.id, {
    status: "processed",
    merge_with_tool: mergeWithToolId,
    admin_notes: adminNotes || `Merged with existing tool: ${existingTool.name}`,
  });

  // TODO: You might want to update news items that referenced the pending tool name
  // to now reference the existing tool

  loggers.api.info(
    `Merged pending tool with existing: ${pendingTool.name} -> ${existingTool.name}`
  );

  return {
    message: "Tool merged successfully",
    existingTool,
    pendingTool,
  };
}

async function rejectPendingTool(pendingToolId: string, adminNotes?: string) {
  // Update pending tool status
  await payloadDirect.updatePendingTool(pendingToolId, {
    status: "rejected",
    admin_notes: adminNotes || "Rejected by admin",
  });

  loggers.api.info(`Rejected pending tool: ${pendingToolId}`);

  return {
    message: "Tool rejected successfully",
    pendingToolId,
  };
}
