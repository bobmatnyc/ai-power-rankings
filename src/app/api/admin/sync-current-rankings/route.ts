import { NextRequest, NextResponse } from "next/server";
import { getPayloadClient } from "@/lib/payload-direct";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayloadClient();
    logger.info("Syncing current rankings to tools...");

    // First, get the current ranking period (most recent published)
    const currentPeriod = await payload.find({
      collection: "ranking-periods",
      where: {
        status: {
          equals: "published",
        },
      },
      sort: "-calculation_date",
      limit: 1,
    });

    if (!currentPeriod.docs.length) {
      return NextResponse.json({ error: "No current ranking period found" }, { status: 404 });
    }

    const currentPeriodId = currentPeriod.docs[0].period;
    logger.info(`Current period: ${currentPeriodId}`);

    // Get all rankings for the current period
    const rankings = await payload.find({
      collection: "rankings",
      where: {
        period: {
          equals: currentPeriodId,
        },
      },
      limit: 1000,
      depth: 1, // Populate tool relationship
    });

    logger.info(`Found ${rankings.docs.length} rankings for current period`);

    const results = {
      total: rankings.docs.length,
      updated: 0,
      errors: [] as string[],
    };

    // Update each tool with its current ranking
    for (const ranking of rankings.docs) {
      try {
        const toolId = typeof ranking.tool === "string" ? ranking.tool : ranking.tool?.id;

        if (!toolId) {
          results.errors.push(`Ranking ${ranking.id} has no tool`);
          continue;
        }

        await payload.update({
          collection: "tools",
          id: toolId,
          data: {
            current_ranking: ranking.position,
          },
        });

        results.updated++;
      } catch (error: any) {
        results.errors.push(`Failed to update tool ${ranking.tool}: ${error.message}`);
      }
    }

    // Clear current_ranking for tools not in the current rankings
    const allTools = await payload.find({
      collection: "tools",
      limit: 1000,
    });

    const rankedToolIds = new Set(
      rankings.docs.map((r) => (typeof r.tool === "string" ? r.tool : r.tool?.id))
    );

    for (const tool of allTools.docs) {
      if (!rankedToolIds.has(tool.id) && tool.current_ranking) {
        try {
          await payload.update({
            collection: "tools",
            id: tool.id,
            data: {
              current_ranking: null,
            },
          });
        } catch (error: any) {
          results.errors.push(`Failed to clear ranking for tool ${tool.id}: ${error.message}`);
        }
      }
    }

    logger.info(`Sync complete: ${results.updated} tools updated`);

    return NextResponse.json({
      success: true,
      message: `Updated ${results.updated} tool rankings`,
      period: currentPeriodId,
      results,
    });
  } catch (error: any) {
    logger.error("Error syncing rankings:", error);
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
    const payload = await getPayloadClient();

    // Get tools with current_ranking and check against actual rankings
    const [tools, currentPeriod] = await Promise.all([
      payload.find({
        collection: "tools",
        where: {
          current_ranking: {
            exists: true,
          },
        },
        limit: 1000,
        sort: "current_ranking",
      }),
      payload.find({
        collection: "ranking-periods",
        where: {
          status: {
            equals: "published",
          },
        },
        sort: "-calculation_date",
        limit: 1,
      }),
    ]);

    const currentPeriodId = currentPeriod.docs[0]?.period;

    // Get actual rankings for comparison
    const rankings = currentPeriodId
      ? await payload.find({
          collection: "rankings",
          where: {
            period: {
              equals: currentPeriodId,
            },
          },
          limit: 1000,
        })
      : null;

    const rankingMap = new Map();
    if (rankings) {
      rankings.docs.forEach((r) => {
        const toolId = typeof r.tool === "string" ? r.tool : r.tool?.id;
        rankingMap.set(toolId, r.position);
      });
    }

    const analysis = {
      currentPeriod: currentPeriodId,
      toolsWithRanking: tools.docs.length,
      outOfSync: [] as any[],
      samples: tools.docs.slice(0, 10).map((tool) => ({
        id: tool.id,
        name: tool.name,
        current_ranking: tool.current_ranking,
        actual_ranking: rankingMap.get(tool.id) || null,
        in_sync: tool.current_ranking === rankingMap.get(tool.id),
      })),
    };

    // Find out of sync tools
    tools.docs.forEach((tool) => {
      const actualRanking = rankingMap.get(tool.id);
      if (tool.current_ranking !== actualRanking) {
        analysis.outOfSync.push({
          id: tool.id,
          name: tool.name,
          current: tool.current_ranking,
          actual: actualRanking || null,
        });
      }
    });

    return NextResponse.json(analysis);
  } catch (error: any) {
    logger.error("Error checking ranking sync:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
