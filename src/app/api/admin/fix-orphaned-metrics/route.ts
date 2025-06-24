import { NextRequest, NextResponse } from "next/server";
import { getPayloadHMR } from "@payloadcms/next/utilities";
import configPromise from "@payload-config";

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayloadHMR({ config: configPromise });

    // Find all metrics without a tool
    const orphanedMetrics = await payload.find({
      collection: "metrics",
      where: {
        tool: {
          exists: false,
        },
      },
      limit: 1000,
    });

    const results = {
      found: orphanedMetrics.docs.length,
      deleted: 0,
      errors: [] as string[],
      details: [] as any[],
    };

    // Group by metric type for reporting
    const metricsByType: Record<string, any[]> = {};
    orphanedMetrics.docs.forEach((metric) => {
      const type = metric["metric"] || metric["metric_key"] || "unknown";
      if (!metricsByType[type]) {
        metricsByType[type] = [];
      }
      metricsByType[type].push({
        id: metric.id,
        value: metric["value"] || metric["value_display"],
        date: metric["date"] || metric["recorded_at"],
      });
    });

    results.details = Object.entries(metricsByType).map(([type, metrics]) => ({
      type,
      count: metrics.length,
      samples: metrics.slice(0, 3),
    }));

    // Delete all orphaned metrics
    for (const metric of orphanedMetrics.docs) {
      try {
        await payload.delete({
          collection: "metrics",
          id: metric.id,
        });
        results.deleted++;
      } catch (error: any) {
        results.errors.push(`Failed to delete metric ${metric.id}: ${error.message}`);
      }
    }

    // Also check for metrics with invalid tool references
    const allMetrics = await payload.find({
      collection: "metrics",
      where: {
        tool: {
          exists: true,
        },
      },
      limit: 1000,
    });

    let invalidToolCount = 0;
    for (const metric of allMetrics.docs) {
      if (metric["tool"]) {
        try {
          const toolId = typeof metric["tool"] === "string" ? metric["tool"] : metric["tool"]["id"];
          const tool = await payload.findByID({
            collection: "tools",
            id: toolId,
          });

          if (!tool) {
            invalidToolCount++;
            await payload.delete({
              collection: "metrics",
              id: metric.id,
            });
            results.deleted++;
          }
        } catch (error) {
          // Tool doesn't exist
          invalidToolCount++;
          try {
            await payload.delete({
              collection: "metrics",
              id: metric.id,
            });
            results.deleted++;
          } catch (deleteError: any) {
            results.errors.push(
              `Failed to delete metric with invalid tool ${metric.id}: ${deleteError.message}`
            );
          }
        }
      }
    }

    results.details.push({
      type: "invalid_tool_references",
      count: invalidToolCount,
    });

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${results.deleted} orphaned metrics`,
      results,
    });
  } catch (error: any) {
    console.error("Error fixing orphaned metrics:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        details: error.stack,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const payload = await getPayloadHMR({ config: configPromise });

    // Just check for orphaned metrics without deleting
    const orphanedMetrics = await payload.find({
      collection: "metrics",
      where: {
        tool: {
          exists: false,
        },
      },
      limit: 100,
    });

    return NextResponse.json({
      orphanedCount: orphanedMetrics.totalDocs,
      samples: orphanedMetrics.docs.slice(0, 10).map((m) => ({
        id: m.id,
        metric: m["metric"] || m["metric_key"],
        value: m["value"] || m["value_display"],
        date: m["date"] || m["recorded_at"],
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
