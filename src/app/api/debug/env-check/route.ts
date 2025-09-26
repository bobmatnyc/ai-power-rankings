import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const envCheck = {
      timestamp: new Date().toISOString(),
      environment: {
        NODE_ENV: process.env["NODE_ENV"],
        VERCEL_ENV: process.env["VERCEL_ENV"],
        VERCEL_URL: process.env["VERCEL_URL"] ? "SET" : "NOT_SET",
        VERCEL_BRANCH_URL: process.env["VERCEL_BRANCH_URL"] ? "SET" : "NOT_SET",
        NEXT_PUBLIC_BASE_URL: process.env["NEXT_PUBLIC_BASE_URL"] ? "SET" : "NOT_SET",
        NEXT_PUBLIC_API_URL: process.env["NEXT_PUBLIC_API_URL"] ? "SET" : "NOT_SET",
        NEXT_PUBLIC_DISABLE_AUTH: process.env["NEXT_PUBLIC_DISABLE_AUTH"],
        DATABASE_URL: process.env["DATABASE_URL"] ? "SET" : "NOT_SET",
        NEXTAUTH_URL: process.env["NEXTAUTH_URL"] ? "SET" : "NOT_SET",
        __NEXT_PRIVATE_ORIGIN: process.env["__NEXT_PRIVATE_ORIGIN"] ? "SET" : "NOT_SET",
      },
      urls: {
        requestUrl: request.url,
        requestHeaders: Object.fromEntries(request.headers.entries()),
      },
      runtime: {
        isServer: typeof window === "undefined",
        hasProcess: typeof process !== "undefined",
        processVersions: typeof process !== "undefined" ? process.versions : "undefined",
      },
    };

    return NextResponse.json(envCheck, {
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Environment check failed",
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : "No stack",
      },
      { status: 500 }
    );
  }
}
