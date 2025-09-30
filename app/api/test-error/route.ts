import { NextResponse } from "next/server";

/**
 * Test endpoint to verify error logging
 */
export async function GET() {
  try {
    console.log("[Test Error] Starting test");
    console.log("[Test Error] Environment check:", {
      NODE_ENV: process.env["NODE_ENV"],
      VERCEL_ENV: process.env["VERCEL_ENV"],
      HAS_BASE_URL: !!process.env["NEXT_PUBLIC_BASE_URL"],
      HAS_VERCEL_URL: !!process.env["VERCEL_URL"],
    });

    // Test if we can get URL
    const baseUrl =
      process.env["NEXT_PUBLIC_BASE_URL"] ||
      (process.env["VERCEL_URL"] ? `https://${process.env["VERCEL_URL"]}` : "");
    console.log("[Test Error] Base URL:", baseUrl);

    // Intentionally throw an error to test error handling
    const shouldError = false; // Set to true to test error handling
    if (shouldError) {
      throw new Error("This is a test error to verify error logging");
    }

    return NextResponse.json({
      success: true,
      message: "Error logging test passed",
      environment: {
        NODE_ENV: process.env["NODE_ENV"],
        VERCEL_ENV: process.env["VERCEL_ENV"],
        hasBaseUrl: !!process.env["NEXT_PUBLIC_BASE_URL"],
        hasVercelUrl: !!process.env["VERCEL_URL"],
        computedUrl: baseUrl,
      },
    });
  } catch (error) {
    console.error("[Test Error] Caught error:", error);
    console.error("[Test Error] Error stack:", error instanceof Error ? error.stack : "No stack");

    return NextResponse.json(
      {
        success: false,
        error: "Test error occurred",
        message: error instanceof Error ? error.message : String(error),
        stack:
          process.env["NODE_ENV"] === "development" && error instanceof Error
            ? error.stack
            : undefined,
      },
      { status: 500 }
    );
  }
}