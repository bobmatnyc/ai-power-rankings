import { NextResponse } from "next/server";
import { getPayloadClient } from "@/lib/payload-direct";

export async function GET() {
  try {
    const payload = await getPayloadClient();

    // Get all ranking periods
    const periods = await payload.find({
      collection: "ranking-periods",
      limit: 100,
      sort: "-calculation_date",
    });

    // Get rankings count for each period
    const periodData = await Promise.all(
      periods.docs.map(async (period: any) => {
        const rankings = await payload.find({
          collection: "rankings",
          where: {
            period: {
              equals: period.period,
            },
          },
          limit: 0, // Just get count
        });

        return {
          id: period.id,
          period: period.period,
          display_name: period.display_name,
          status: period.status,
          calculation_date: period.calculation_date,
          ranking_count: rankings.totalDocs,
        };
      })
    );

    return NextResponse.json({
      total: periods.totalDocs,
      periods: periodData,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
