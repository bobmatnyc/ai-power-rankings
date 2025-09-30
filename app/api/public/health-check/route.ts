import { NextResponse } from "next/server";

/**
 * Public health check endpoint - no authentication required
 * This should ALWAYS work regardless of cookies or authentication status
 */
export async function GET() {
  try {
    console.log("[health-check] Processing health check request");

    const response = {
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "AI Power Rankings API",
      version: "1.0.0",
      environment: process.env["NODE_ENV"] || "development",
      message: "Service is healthy and responding",
    };

    console.log("[health-check] Returning successful health check");

    return NextResponse.json(response, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("[health-check] Error in health check:", error);

    const errorResponse = {
      status: "error",
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
      service: "AI Power Rankings API",
    };

    return NextResponse.json(errorResponse, {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}

// Ensure we're using Node.js runtime to avoid edge runtime issues
export const runtime = "nodejs";
