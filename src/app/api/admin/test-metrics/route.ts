import { NextRequest, NextResponse } from "next/server";
import { getPayloadClient } from "@/lib/payload-direct";

export async function GET(_request: NextRequest) {
  try {
    const payload = await getPayloadClient();

    // Get a sample of metrics with full depth
    const metrics = await payload.find({
      collection: "metrics",
      limit: 5,
      depth: 2,
      sort: "-recorded_at",
    });

    // Transform the data to show what we care about
    const data = metrics.docs.map((m: any) => ({
      id: m.id,
      metric_key: m.metric_key,
      tool_display: m.tool_display,
      tool: {
        id: m.tool?.id || m.tool,
        name: m.tool?.name || "Not populated",
        slug: m.tool?.slug,
      },
      value_display: m.value_display,
      recorded_at: m.recorded_at,
    }));

    return NextResponse.json({
      total: metrics.totalDocs,
      samples: data,
      message: "Sample metrics with tool data",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
