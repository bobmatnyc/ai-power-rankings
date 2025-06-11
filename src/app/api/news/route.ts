import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/database";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");
    const filter = searchParams.get("filter") || "all";

    const supabase = supabaseAdmin;

    // Build the query
    let query = supabase
      .from("news_updates")
      .select("*, count", { count: "exact" })
      .order("published_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filter if not "all"
    if (filter !== "all") {
      query = query.eq("category", filter);
    }

    const { data: newsItems, error, count } = await query;

    if (error) {
      console.error("Error fetching news:", error);
      return NextResponse.json({ error: "Failed to fetch news" }, { status: 500 });
    }

    // Transform the data to match the expected format
    const transformedNews =
      newsItems?.map((item) => {
        // Extract tool info from related_tools JSON
        const relatedTools = item.related_tools?.tools || [];
        const primaryTool = relatedTools[0] || "";

        // Map category to event_type for the component
        const eventTypeMap: Record<string, string> = {
          milestone: "milestone",
          growth: "milestone",
          technical: "update",
          feature: "feature",
          funding: "announcement",
          partnership: "partnership",
        };

        return {
          id: item.id,
          tool_id: primaryTool,
          tool_name: primaryTool.charAt(0).toUpperCase() + primaryTool.slice(1).replace(/-/g, " "),
          tool_category: "unknown", // We'll need to look this up if needed
          tool_website: "",
          event_date: item.published_at,
          event_type: eventTypeMap[item.category] || item.category || "update",
          title: item.title,
          description: item.summary || "",
          source_url: item.url,
          source_name: item.source,
          metrics: {},
          tags: item.category ? [item.category] : [],
        };
      }) || [];

    return NextResponse.json({
      news: transformedNews,
      total: count || 0,
      hasMore: transformedNews.length === limit,
    });
  } catch (error) {
    console.error("News API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
