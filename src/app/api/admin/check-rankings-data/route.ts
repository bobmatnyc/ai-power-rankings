import { NextRequest, NextResponse } from "next/server";
import { getPayloadClient } from "@/lib/payload-direct";

export async function GET() {
  try {
    const payload = await getPayloadClient();

    // Get rankings without specific period filter
    const rankings = await payload.find({
      collection: "rankings",
      limit: 10,
      sort: "-updatedAt",
      depth: 1, // Populate relationships
    });

    // Get unique periods from rankings
    const uniquePeriods = new Set();
    rankings.docs.forEach((r) => {
      if (r.period) {
        uniquePeriods.add(r.period);
      }
    });

    return NextResponse.json({
      totalRankings: rankings.totalDocs,
      uniquePeriods: Array.from(uniquePeriods),
      sampleRankings: rankings.docs.map((r) => ({
        id: r.id,
        tool: typeof r.tool === "object" ? r.tool.name : r.tool,
        position: r.position,
        period: r.period,
        score: r.score,
        updatedAt: r.updatedAt,
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
