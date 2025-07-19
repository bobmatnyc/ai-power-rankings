import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const env = {
    NODE_ENV: process.env["NODE_ENV"],
    VERCEL_ENV: process.env["VERCEL_ENV"],
    VERCEL_URL: process.env["VERCEL_URL"],
    NEXT_PUBLIC_BASE_URL: process.env["NEXT_PUBLIC_BASE_URL"],
    hasDbUrl: !!process.env["SUPABASE_DATABASE_URL"],
    dbUrlPrefix: `${process.env["SUPABASE_DATABASE_URL"]?.substring(0, 50)}...`,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(env);
}
