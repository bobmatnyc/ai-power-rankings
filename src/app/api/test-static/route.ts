import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const rankingsPath = path.join(process.cwd(), "public", "data", "rankings.json");

    if (fs.existsSync(rankingsPath)) {
      const content = fs.readFileSync(rankingsPath, "utf-8");
      const data = JSON.parse(content);

      return NextResponse.json({
        success: true,
        fileExists: true,
        dataLength: content.length,
        rankingsCount: data.rankings?.length || 0,
        firstTool: data.rankings?.[0]?.tool?.name || "unknown",
        timestamp: data._timestamp || "unknown",
      });
    } else {
      return NextResponse.json({
        success: false,
        fileExists: false,
        path: rankingsPath,
      });
    }
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}
