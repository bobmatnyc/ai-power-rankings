import { NextRequest, NextResponse } from "next/server";
import { getPayloadHMR } from "@payloadcms/next/utilities";
import configPromise from "@payload-config";

export async function POST(_request: NextRequest) {
  try {
    const payload = await getPayloadHMR({ config: configPromise });

    const results = {
      metrics: {
        total: 0,
        updated: 0,
        errors: [] as string[],
      },
      rankings: {
        total: 0,
        updated: 0,
        errors: [] as string[],
      },
    };

    // Update all metrics
    console.log("Updating tool_display for metrics...");
    const allMetrics = await payload.find({
      collection: "metrics",
      limit: 1000,
      depth: 1, // Populate tool relationship
    });

    results.metrics.total = allMetrics.docs.length;

    for (const metric of allMetrics.docs) {
      try {
        let toolName = "Unknown Tool";

        if (metric["tool"]) {
          if (typeof metric["tool"] === "object" && metric["tool"]["name"]) {
            toolName = metric["tool"]["name"];
          } else if (typeof metric["tool"] === "string") {
            // Fetch the tool
            const tool = await payload.findByID({
              collection: "tools",
              id: metric["tool"],
            });
            if (tool && tool["name"]) {
              toolName = tool["name"];
            }
          }
        }

        // Update the metric with the tool_display value
        await payload.update({
          collection: "metrics",
          id: metric.id,
          data: {
            tool_display: toolName,
          },
        });
        results.metrics.updated++;
      } catch (error: any) {
        results.metrics.errors.push(`Failed to update metric ${metric.id}: ${error.message}`);
      }
    }

    // Update all rankings
    console.log("Updating tool_display for rankings...");
    const allRankings = await payload.find({
      collection: "rankings",
      limit: 1000,
      depth: 1, // Populate tool relationship
    });

    results.rankings.total = allRankings.docs.length;

    for (const ranking of allRankings.docs) {
      try {
        let toolName = "Unknown Tool";

        if (ranking["tool"]) {
          if (typeof ranking["tool"] === "object" && ranking["tool"]["name"]) {
            toolName = ranking["tool"]["name"];
          } else if (typeof ranking["tool"] === "string") {
            // Fetch the tool
            const tool = await payload.findByID({
              collection: "tools",
              id: ranking["tool"],
            });
            if (tool && tool["name"]) {
              toolName = tool["name"];
            }
          }
        }

        // Update the ranking with the tool_display value
        await payload.update({
          collection: "rankings",
          id: ranking.id,
          data: {
            tool_display: toolName,
          },
        });
        results.rankings.updated++;
      } catch (error: any) {
        results.rankings.errors.push(`Failed to update ranking ${ranking.id}: ${error.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Updated ${results.metrics.updated} metrics and ${results.rankings.updated} rankings`,
      results,
    });
  } catch (error: any) {
    console.error("Error refreshing tool display:", error);
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

    // Check current state
    const [metrics, rankings] = await Promise.all([
      payload.find({
        collection: "metrics",
        where: {
          or: [
            {
              tool_display: {
                equals: "No Tool Selected",
              },
            },
            {
              tool_display: {
                exists: false,
              },
            },
          ],
        },
        limit: 10,
      }),
      payload.find({
        collection: "rankings",
        where: {
          or: [
            {
              tool_display: {
                equals: "No Tool Selected",
              },
            },
            {
              tool_display: {
                exists: false,
              },
            },
          ],
        },
        limit: 10,
      }),
    ]);

    return NextResponse.json({
      metrics: {
        needsUpdate: metrics.totalDocs,
        samples: metrics.docs.map((m) => ({
          id: m.id,
          tool: m["tool"],
          tool_display: m["tool_display"],
          metric: m["metric"] || m["metric_key"],
        })),
      },
      rankings: {
        needsUpdate: rankings.totalDocs,
        samples: rankings.docs.map((r) => ({
          id: r.id,
          tool: r["tool"],
          tool_display: r["tool_display"],
          period: r["period"],
          position: r["position"],
        })),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
