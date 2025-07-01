import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const publicPath = path.join(process.cwd(), "public");
    const dataPath = path.join(publicPath, "data");
    const rankingsPath = path.join(dataPath, "rankings.json");

    const checks: any = {
      cwd: process.cwd(),
      publicExists: fs.existsSync(publicPath),
      dataExists: fs.existsSync(dataPath),
      rankingsExists: fs.existsSync(rankingsPath),
      env: {
        NODE_ENV: process.env["NODE_ENV"],
        VERCEL: process.env["VERCEL"],
        VERCEL_ENV: process.env["VERCEL_ENV"],
        NEXT_PUBLIC_BASE_URL: process.env["NEXT_PUBLIC_BASE_URL"],
      },
      files: {
        publicContents: fs.existsSync(publicPath) ? fs.readdirSync(publicPath).slice(0, 10) : [],
        dataContents: fs.existsSync(dataPath) ? fs.readdirSync(dataPath) : [],
      },
    };

    if (fs.existsSync(rankingsPath)) {
      const stats = fs.statSync(rankingsPath);
      checks.rankingsStats = {
        size: stats.size,
        modified: stats.mtime,
      };
    }

    return NextResponse.json(checks, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error.message,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}
