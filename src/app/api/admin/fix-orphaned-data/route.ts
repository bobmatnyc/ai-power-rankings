import { NextRequest, NextResponse } from "next/server";
import { getPayloadHMR } from "@payloadcms/next/utilities";
import configPromise from "@payload-config";

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayloadHMR({ config: configPromise });

    const results = {
      metrics: {
        found: 0,
        deleted: 0,
        errors: [] as string[],
      },
      rankings: {
        found: 0,
        deleted: 0,
        errors: [] as string[],
      },
    };

    // 1. Fix orphaned metrics
    console.log("Checking for orphaned metrics...");
    const orphanedMetrics = await payload.find({
      collection: "metrics",
      where: {
        tool: {
          exists: false,
        },
      },
      limit: 1000,
    });

    results.metrics.found = orphanedMetrics.docs.length;

    for (const metric of orphanedMetrics.docs) {
      try {
        await payload.delete({
          collection: "metrics",
          id: metric.id,
        });
        results.metrics.deleted++;
      } catch (error: any) {
        results.metrics.errors.push(`Failed to delete metric ${metric.id}: ${error.message}`);
      }
    }

    // 2. Fix orphaned rankings
    console.log("Checking for orphaned rankings...");
    const orphanedRankings = await payload.find({
      collection: "rankings",
      where: {
        tool: {
          exists: false,
        },
      },
      limit: 1000,
    });

    results.rankings.found = orphanedRankings.docs.length;

    // Group orphaned rankings by period and position for analysis
    const rankingsByPeriod: Record<string, any[]> = {};
    orphanedRankings.docs.forEach((ranking) => {
      const period = ranking["period"] || "unknown";
      if (!rankingsByPeriod[period]) {
        rankingsByPeriod[period] = [];
      }
      rankingsByPeriod[period].push({
        id: ranking.id,
        position: ranking["position"],
        score: ranking["score"],
      });
    });

    console.log("Orphaned rankings by period:");
    Object.entries(rankingsByPeriod).forEach(([period, rankings]) => {
      console.log(`- ${period}: ${rankings.length} entries`);
    });

    // Delete all orphaned rankings
    for (const ranking of orphanedRankings.docs) {
      try {
        await payload.delete({
          collection: "rankings",
          id: ranking.id,
        });
        results.rankings.deleted++;
      } catch (error: any) {
        results.rankings.errors.push(`Failed to delete ranking ${ranking.id}: ${error.message}`);
      }
    }

    // 3. Check for invalid tool references in both collections
    console.log("Checking for invalid tool references...");

    // Check metrics with invalid tools
    const allMetrics = await payload.find({
      collection: "metrics",
      where: {
        tool: {
          exists: true,
        },
      },
      limit: 1000,
    });

    for (const metric of allMetrics.docs) {
      if (metric["tool"]) {
        try {
          const toolId = typeof metric["tool"] === "string" ? metric["tool"] : metric["tool"]["id"];
          const tool = await payload.findByID({
            collection: "tools",
            id: toolId,
          });

          if (!tool) {
            await payload.delete({
              collection: "metrics",
              id: metric.id,
            });
            results.metrics.deleted++;
          }
        } catch (error) {
          // Tool doesn't exist
          try {
            await payload.delete({
              collection: "metrics",
              id: metric.id,
            });
            results.metrics.deleted++;
          } catch (deleteError: any) {
            results.metrics.errors.push(
              `Failed to delete metric with invalid tool: ${deleteError.message}`
            );
          }
        }
      }
    }

    // Check rankings with invalid tools
    const allRankings = await payload.find({
      collection: "rankings",
      where: {
        tool: {
          exists: true,
        },
      },
      limit: 1000,
    });

    for (const ranking of allRankings.docs) {
      if (ranking["tool"]) {
        try {
          const toolId =
            typeof ranking["tool"] === "string" ? ranking["tool"] : ranking["tool"]["id"];
          const tool = await payload.findByID({
            collection: "tools",
            id: toolId,
          });

          if (!tool) {
            await payload.delete({
              collection: "rankings",
              id: ranking.id,
            });
            results.rankings.deleted++;
          }
        } catch (error) {
          // Tool doesn't exist
          try {
            await payload.delete({
              collection: "rankings",
              id: ranking.id,
            });
            results.rankings.deleted++;
          } catch (deleteError: any) {
            results.rankings.errors.push(
              `Failed to delete ranking with invalid tool: ${deleteError.message}`
            );
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${results.metrics.deleted} orphaned metrics and ${results.rankings.deleted} orphaned rankings`,
      results,
      rankingPeriods: Object.keys(rankingsByPeriod),
    });
  } catch (error: any) {
    console.error("Error fixing orphaned data:", error);
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

    // Check for orphaned data without deleting
    const [orphanedMetrics, orphanedRankings] = await Promise.all([
      payload.find({
        collection: "metrics",
        where: {
          tool: {
            exists: false,
          },
        },
        limit: 100,
      }),
      payload.find({
        collection: "rankings",
        where: {
          tool: {
            exists: false,
          },
        },
        limit: 100,
      }),
    ]);

    return NextResponse.json({
      metrics: {
        orphanedCount: orphanedMetrics.totalDocs,
        samples: orphanedMetrics.docs.slice(0, 5).map((m) => ({
          id: m.id,
          metric: m["metric"] || m["metric_key"],
          value: m["value"] || m["value_display"],
          date: m["date"] || m["recorded_at"],
        })),
      },
      rankings: {
        orphanedCount: orphanedRankings.totalDocs,
        samples: orphanedRankings.docs.slice(0, 5).map((r) => ({
          id: r.id,
          period: r["period"],
          position: r["position"],
          score: r["score"],
        })),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
