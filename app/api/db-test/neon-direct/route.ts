import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const useDatabase = process.env["USE_DATABASE"];
    if (useDatabase !== "true") {
      return NextResponse.json({
        error: "Database disabled",
        USE_DATABASE: useDatabase,
      });
    }

    const databaseUrl = process.env["DATABASE_URL"];
    if (!databaseUrl) {
      return NextResponse.json({
        error: "No DATABASE_URL configured",
      });
    }

    // Test direct Neon connection
    const sql = neon(databaseUrl);

    // Test basic query
    const timeResult = await sql`SELECT NOW() as current_time`;
    const currentTime = timeResult[0]?.["current_time"];

    // Count articles
    const countResult = await sql`SELECT COUNT(*) as count FROM articles`;
    const articleCount = countResult[0]?.["count"] || 0;

    // Get sample article
    const sampleResult = await sql`
      SELECT id, title, created_at
      FROM articles
      LIMIT 1
    `;

    return NextResponse.json({
      status: "success",
      connection: "neon-direct",
      serverTime: currentTime,
      articleCount: articleCount,
      sampleArticle: sampleResult[0] || null,
      endpoint: databaseUrl.split("@")[1]?.split("-pooler")[0] || "unknown",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        stack: error instanceof Error ? error.stack?.split("\n").slice(0, 3) : undefined,
      },
      { status: 500 }
    );
  }
}
