import { NextResponse } from "next/server";
import { payloadDirect } from "@/lib/payload-direct";
import { loggers } from "@/lib/logger";

export async function GET(): Promise<NextResponse> {
  try {
    // Check environment variables
    const hasDbUrl = !!process.env["SUPABASE_DATABASE_URL"];
    const hasSupabaseUrl = !!process.env["NEXT_PUBLIC_SUPABASE_URL"];
    const hasSupabaseKey = !!process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];

    // Try to connect and get tools count
    let toolsCount = 0;
    let dbError = null;

    try {
      const tools = await payloadDirect.getTools({ limit: 1 });
      toolsCount = tools.totalDocs;
    } catch (error) {
      dbError = error instanceof Error ? error.message : String(error);
      loggers.db.error("Database health check failed", { error });
    }

    return NextResponse.json({
      status: dbError ? "error" : "ok",
      timestamp: new Date().toISOString(),
      environment: {
        NODE_ENV: process.env["NODE_ENV"],
        VERCEL_ENV: process.env["VERCEL_ENV"],
        hasDbUrl,
        hasSupabaseUrl,
        hasSupabaseKey,
        dbUrlPrefix: process.env["SUPABASE_DATABASE_URL"]?.substring(0, 20) + "...",
      },
      database: {
        connected: !dbError,
        toolsCount,
        error: dbError,
      },
    });
  } catch (error) {
    loggers.db.error("Health check endpoint error", { error });
    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
