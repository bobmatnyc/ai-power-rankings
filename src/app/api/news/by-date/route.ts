import { type NextRequest, NextResponse } from "next/server";
import { getNewsRepo } from "@/lib/json-db";
import { loggers } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get("date"); // YYYY-MM format
    const availableOnly = searchParams.get("availableOnly") === "true";

    const newsRepo = getNewsRepo();

    // If requesting available dates
    if (availableOnly) {
      const availableDates = await newsRepo.getAvailableDates();

      // Sort dates descending
      const sortedDates = Object.entries(availableDates)
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([date, count]) => ({ date, count }));

      return NextResponse.json({
        dates: sortedDates,
        total: sortedDates.length,
        _source: "json-db",
      });
    }

    // If no date specified, return error
    if (!date) {
      return NextResponse.json(
        { error: "Date parameter required (YYYY-MM format)" },
        { status: 400 }
      );
    }

    // Validate date format
    if (!/^\d{4}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "Invalid date format. Use YYYY-MM" }, { status: 400 });
    }

    const articles = await newsRepo.getByDate(date);

    return NextResponse.json({
      articles,
      count: articles.length,
      date,
      _source: "json-db",
    });
  } catch (error) {
    loggers.api.error("News by date API error", { error });

    return NextResponse.json(
      {
        error: "Failed to fetch news by date",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
