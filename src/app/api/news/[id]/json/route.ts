import { NextRequest, NextResponse } from "next/server";
import { loggers } from "@/lib/logger";
import { getNewsRepo } from "@/lib/json-db";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    loggers.api.debug("Getting news article by ID", { id });

    const newsRepo = getNewsRepo();

    // Try to get by ID first
    let article = await newsRepo.getById(id);

    // If not found by ID, try by slug
    if (!article) {
      article = await newsRepo.getBySlug(id);
    }

    if (!article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    return NextResponse.json(
      { article },
      {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=3600", // Cache for 1 hour
        },
      }
    );
  } catch (error) {
    loggers.api.error("News detail JSON API error", { error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
