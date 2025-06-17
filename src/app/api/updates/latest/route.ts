import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import path from "path";

export async function GET() {
  try {
    // Get the latest update file
    const updatePath = path.resolve(process.cwd(), "data/updates/2025-06-17-ranking-update.md");

    const updateContent = readFileSync(updatePath, "utf8");

    return NextResponse.json({
      success: true,
      content: updateContent,
      date: "2025-06-17",
      title: "Ranking Update - June 17, 2025",
    });
  } catch (error) {
    console.error("Error fetching latest update:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch latest update",
      },
      { status: 500 }
    );
  }
}

// Enable CORS for this endpoint
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
