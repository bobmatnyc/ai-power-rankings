import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const month = searchParams.get("month"); // Format: YYYY-MM
    const toolId = searchParams.get("tool_id");
    const includeDetails = searchParams.get("include_details") === "true";

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: "Invalid month format. Use YYYY-MM" }, { status: 400 });
    }

    const supabase = await createClient();

    // Convert month to date range
    const startDate = `${month}-01`;
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);
    endDate.setDate(0); // Last day of the month
    const referenceDate = endDate.toISOString();

    if (toolId) {
      // Get news impacts for a specific tool
      const { data: impacts, error } = await supabase.rpc("get_tool_news_impacts_at_date", {
        p_tool_id: toolId,
        p_reference_date: referenceDate,
        p_lookback_days: 730, // 2 years
      });

      if (error) {
        logger.error("Error fetching tool news impacts:", error);
        throw error;
      }

      // Get aggregate impact
      const { data: aggregate, error: aggError } = await supabase.rpc(
        "calculate_aggregate_news_impact",
        {
          p_tool_id: toolId,
          p_reference_date: referenceDate,
        }
      );

      if (aggError) {
        logger.error("Error calculating aggregate impact:", error);
        throw aggError;
      }

      const response = {
        tool_id: toolId,
        month,
        reference_date: referenceDate,
        aggregate: aggregate?.[0] || {
          total_impact: 0,
          positive_impact: 0,
          negative_impact: 0,
          article_count: 0,
          recent_article_count: 0,
          avg_impact: 0,
        },
        news_impact_modifier: 0,
      };

      // Calculate modifier
      if (aggregate?.[0]) {
        response.news_impact_modifier = Math.max(-2, Math.min(2, aggregate[0].total_impact / 10));
      }

      if (includeDetails) {
        response["articles"] = impacts || [];
      }

      return NextResponse.json(response);
    } else {
      // Get summary for all tools in the month
      const { data: monthlyData, error } = await supabase
        .from("news_impact_monthly_summary")
        .select("*")
        .eq("month", startDate)
        .order("total_impact", { ascending: false });

      if (error) {
        logger.error("Error fetching monthly summary:", error);
        throw error;
      }

      // Get overall stats for the month
      const { data: monthStats, error: statsError } = await supabase
        .from("news_by_month")
        .select("*")
        .eq("month", startDate)
        .single();

      if (statsError && statsError.code !== "PGRST116") {
        // Not found is ok
        logger.error("Error fetching month stats:", statsError);
        throw statsError;
      }

      return NextResponse.json({
        month,
        reference_date: referenceDate,
        overall_stats: monthStats || {
          article_count: 0,
          unique_sources: 0,
          news_types: [],
          tools_mentioned: 0,
        },
        tool_impacts: monthlyData || [],
      });
    }
  } catch (error) {
    logger.error("Error in historical news API:", error);
    return NextResponse.json({ error: "Failed to fetch historical news data" }, { status: 500 });
  }
}

// API to get news impact over time for a tool
export async function POST(request: NextRequest) {
  try {
    const { tool_id, start_date, end_date, interval = "month" } = await request.json();

    if (!tool_id) {
      return NextResponse.json({ error: "tool_id is required" }, { status: 400 });
    }

    const supabase = await createClient();

    // Generate date series
    const { data: dateSeries, error: dateError } = await supabase.rpc("generate_series", {
      start_date: start_date || "2024-01-01",
      end_date: end_date || new Date().toISOString(),
      interval: `1 ${interval}`,
    });

    if (dateError) {
      // Fallback to manual date generation
      const dates = [];
      const current = new Date(start_date || "2024-01-01");
      const end = new Date(end_date || new Date());

      while (current <= end) {
        dates.push(new Date(current));
        if (interval === "month") {
          current.setMonth(current.getMonth() + 1);
        } else if (interval === "week") {
          current.setDate(current.getDate() + 7);
        } else {
          current.setDate(current.getDate() + 1);
        }
      }

      const impacts = [];
      for (const date of dates) {
        const { data: impact } = await supabase.rpc("calculate_aggregate_news_impact", {
          p_tool_id: tool_id,
          p_reference_date: date.toISOString(),
        });

        impacts.push({
          date: date.toISOString(),
          ...(impact?.[0] || {
            total_impact: 0,
            positive_impact: 0,
            negative_impact: 0,
            article_count: 0,
            recent_article_count: 0,
            avg_impact: 0,
          }),
        });
      }

      return NextResponse.json({
        tool_id,
        start_date: start_date || "2024-01-01",
        end_date: end_date || new Date().toISOString(),
        interval,
        time_series: impacts,
      });
    }

    // If generate_series worked, use it to get impacts
    const impacts = await Promise.all(
      dateSeries.map(async (row: any) => {
        const { data: impact } = await supabase.rpc("calculate_aggregate_news_impact", {
          p_tool_id: tool_id,
          p_reference_date: row.generate_series,
        });

        return {
          date: row.generate_series,
          ...(impact?.[0] || {
            total_impact: 0,
            positive_impact: 0,
            negative_impact: 0,
            article_count: 0,
            recent_article_count: 0,
            avg_impact: 0,
          }),
        };
      })
    );

    return NextResponse.json({
      tool_id,
      start_date: dateSeries[0]?.generate_series,
      end_date: dateSeries[dateSeries.length - 1]?.generate_series,
      interval,
      time_series: impacts,
    });
  } catch (error) {
    logger.error("Error in news time series API:", error);
    return NextResponse.json(
      { error: "Failed to generate news impact time series" },
      { status: 500 }
    );
  }
}
