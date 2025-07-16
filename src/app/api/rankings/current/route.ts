import { readFileSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Read the latest historical rankings
    const rankingsPath = path.resolve(
      process.cwd(),
      "data/exports/historical-rankings-june-2025.json"
    );
    const rankingsData = JSON.parse(readFileSync(rankingsPath, "utf8"));

    // Return the rankings data
    return NextResponse.json({
      success: true,
      data: rankingsData,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching rankings:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch rankings data",
        timestamp: new Date().toISOString(),
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
