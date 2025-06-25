import { NextRequest, NextResponse } from "next/server";
import { getPayloadHMR } from "@payloadcms/next/utilities";
import configPromise from "@payload-config";
// @ts-ignore - drizzle-orm is a dependency of @payloadcms/db-postgres
import { sql } from "drizzle-orm";

export async function POST(_request: NextRequest) {
  try {
    const payload = await getPayloadHMR({ config: configPromise });

    // Use direct database update for better performance
    const db = payload.db;

    // Update metrics table
    const metricsResult = await db.drizzle.execute(sql`
      UPDATE payload.metrics 
      SET tool_display = (
        SELECT name FROM payload.tools 
        WHERE payload.tools.id = payload.metrics.tool
      )
      WHERE tool_display IS NULL OR tool_display = 'No Tool Selected'
    `);

    // Update rankings table
    const rankingsResult = await db.drizzle.execute(sql`
      UPDATE payload.rankings 
      SET tool_display = (
        SELECT name FROM payload.tools 
        WHERE payload.tools.id = payload.rankings.tool
      )
      WHERE tool_display IS NULL OR tool_display = 'No Tool Selected'
    `);

    return NextResponse.json({
      success: true,
      message: "Tool display fields updated via direct SQL",
      metrics: {
        updated: (metricsResult as any).rowCount || 0,
      },
      rankings: {
        updated: (rankingsResult as any).rowCount || 0,
      },
    });
  } catch (error: any) {
    console.error("Error updating tool display:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
