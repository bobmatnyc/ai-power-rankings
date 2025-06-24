import { NextRequest, NextResponse } from "next/server";
import { getPayloadClient } from "@/lib/payload-direct";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayloadClient();

    // Create June 2025 ranking period
    const newPeriod = await payload.create({
      collection: "ranking-periods",
      data: {
        period: "2025-06",
        display_name: "June 2025",
        period_type: "monthly",
        status: "published",
        calculation_date: new Date("2025-06-01T00:00:00Z"),
        publish_date: new Date("2025-06-01T00:00:00Z"),
        start_date: new Date("2025-06-01T00:00:00Z"),
        end_date: new Date("2025-06-30T23:59:59Z"),
        algorithm_version: "v6.0",
        total_tools: 87,
        data_cutoff_date: new Date("2025-05-31T23:59:59Z"),
        notes: "Initial ranking period created from existing rankings data",
      },
    });

    logger.info(`Created ranking period: ${newPeriod.period}`);

    return NextResponse.json({
      success: true,
      period: newPeriod,
    });
  } catch (error: any) {
    logger.error("Error creating ranking period:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
