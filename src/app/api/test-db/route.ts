import { NextResponse } from "next/server";

export async function GET(): Promise<NextResponse> {
  try {
    // Simple test without any authentication
    const envVars = {
      NODE_ENV: process.env["NODE_ENV"],
      VERCEL_ENV: process.env["VERCEL_ENV"],
      hasDbUrl: !!process.env["SUPABASE_DATABASE_URL"],
      dbUrlLength: process.env["SUPABASE_DATABASE_URL"]?.length || 0,
      dbUrlPrefix: process.env["SUPABASE_DATABASE_URL"]?.substring(0, 30) + "...",
    };

    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      message: "Simple test endpoint - no DB calls",
      environment: envVars,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
