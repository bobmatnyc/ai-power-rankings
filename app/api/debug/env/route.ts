import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Debug endpoint to check which environment variables are available
 * Only shows keys, not values for security
 */
export async function GET(_request: NextRequest) {
  try {
    console.log("[Debug API] Environment check requested");

    // Get all environment variable keys (not values for security)
    const envKeys = Object.keys(process.env).sort();

    // Categorize environment variables
    const categorized = {
      // Next.js specific
      nextjs: envKeys.filter((key) => key.startsWith("NEXT_")),
      // Vercel specific
      vercel: envKeys.filter((key) => key.startsWith("VERCEL_")),
      // Database
      database: envKeys.filter((key) => key.includes("DATABASE") || key.includes("DB_")),
      // Authentication
      auth: envKeys.filter(
        (key) => key.includes("CLERK") || key.includes("AUTH") || key.includes("SESSION")
      ),
      // API Keys (show presence only)
      apiKeys: envKeys.filter(
        (key) =>
          key.includes("API") ||
          key.includes("KEY") ||
          key.includes("TOKEN") ||
          key.includes("SECRET")
      ),
      // Node/System
      system: envKeys.filter(
        (key) =>
          key === "NODE_ENV" ||
          key === "PORT" ||
          key === "PWD" ||
          key === "HOME" ||
          key === "USER" ||
          key === "PATH"
      ),
      // Other (excluding sensitive patterns)
      other: envKeys.filter(
        (key) =>
          !key.startsWith("NEXT_") &&
          !key.startsWith("VERCEL_") &&
          !key.includes("DATABASE") &&
          !key.includes("DB_") &&
          !key.includes("CLERK") &&
          !key.includes("AUTH") &&
          !key.includes("SESSION") &&
          !key.includes("API") &&
          !key.includes("KEY") &&
          !key.includes("TOKEN") &&
          !key.includes("SECRET") &&
          !["NODE_ENV", "PORT", "PWD", "HOME", "USER", "PATH"].includes(key)
      ),
    };

    // Check critical variables
    const criticalChecks = {
      hasNodeEnv: !!process.env["NODE_ENV"],
      nodeEnvValue: process.env["NODE_ENV"] || "not set",
      hasVercelEnv: !!process.env["VERCEL_ENV"],
      vercelEnvValue: process.env["VERCEL_ENV"] || "not set",
      hasBaseUrl: !!process.env["NEXT_PUBLIC_BASE_URL"],
      hasVercelUrl: !!process.env["VERCEL_URL"],
      hasDatabase: envKeys.some((key) => key.includes("DATABASE_URL")),
      hasClerkPublishable: !!process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"],
      hasClerkSecret: !!process.env["CLERK_SECRET_KEY"],
      authDisabled: process.env["NEXT_PUBLIC_DISABLE_AUTH"] === "true",
    };

    // Runtime information
    const runtimeInfo = {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      isVercel: !!process.env["VERCEL"],
      isProduction: process.env["NODE_ENV"] === "production",
      isDevelopment: process.env["NODE_ENV"] === "development",
    };

    // Check for common issues
    const issues = [];
    if (!criticalChecks.hasNodeEnv) {
      issues.push("NODE_ENV is not set");
    }
    if (!criticalChecks.hasDatabase) {
      issues.push("No database URL found");
    }
    if (!criticalChecks.authDisabled && !criticalChecks.hasClerkPublishable) {
      issues.push("Auth is enabled but NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is missing");
    }
    if (!criticalChecks.authDisabled && !criticalChecks.hasClerkSecret) {
      issues.push("Auth is enabled but CLERK_SECRET_KEY is missing");
    }
    if (!criticalChecks.hasBaseUrl && !criticalChecks.hasVercelUrl) {
      issues.push("Neither NEXT_PUBLIC_BASE_URL nor VERCEL_URL is set");
    }

    console.log("[Debug API] Critical checks:", criticalChecks);
    console.log("[Debug API] Issues found:", issues);

    return NextResponse.json(
      {
        success: true,
        timestamp: new Date().toISOString(),
        environment: {
          totalKeys: envKeys.length,
          categorized,
          criticalChecks,
          issues,
        },
        runtime: runtimeInfo,
        warnings: issues.length > 0 ? issues : null,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("[Debug API] Error checking environment:", error);
    console.error("[Debug API] Error stack:", error instanceof Error ? error.stack : "No stack");

    return NextResponse.json(
      {
        success: false,
        error: "Failed to check environment",
        message: error instanceof Error ? error.message : String(error),
        stack: process.env["NODE_ENV"] === "development" && error instanceof Error ? error.stack : undefined,
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  }
}