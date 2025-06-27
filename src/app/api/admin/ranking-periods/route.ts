import { NextResponse } from "next/server";
import { getPayload } from "payload";
import config from "@payload-config";
import { loggers } from "@/lib/logger";

export async function GET() {
  try {
    const payload = await getPayload({ config });

    // Get all ranking periods from the database
    const rankingsResult = await payload.find({
      collection: "rankings",
      limit: 1000,
      sort: "-period",
      where: {
        period: {
          exists: true,
        },
      },
    });

    // Group by period and get metadata
    const periodMap = new Map();
    
    for (const ranking of rankingsResult.docs) {
      const period = ranking["period"] as string;
      if (!periodMap.has(period)) {
        periodMap.set(period, {
          id: ranking.id,
          period,
          algorithm_version: ranking["algorithm_version"] || "v6.0",
          created_at: ranking["createdAt"],
          is_current: ranking["is_current"] || false,
          total_tools: 1,
        });
      } else {
        periodMap.get(period)!.total_tools += 1;
      }
    }

    // Convert to array and sort by period (newest first)
    const periods = Array.from(periodMap.values()).sort((a, b) => {
      // Sort by period (YYYY-MM format, newest first)
      return a.period.localeCompare(b.period) * -1;
    });

    loggers.api.info("Retrieved ranking periods", { 
      total_periods: periods.length,
      current_period: periods.find(p => p.is_current)?.period || "none",
      periods_order: periods.map(p => p.period)
    });

    return NextResponse.json({
      success: true,
      periods,
      total: periods.length,
    });

  } catch (error) {
    loggers.api.error("Failed to get ranking periods", { error });
    return NextResponse.json(
      { error: "Failed to retrieve ranking periods" },
      { status: 500 }
    );
  }
}