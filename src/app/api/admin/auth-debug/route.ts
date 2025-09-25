import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    // Log all headers
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value.substring(0, 100); // Truncate for safety
    });

    // Check cookies
    const cookies = request.cookies.getAll();
    const cookieInfo = cookies.map((c) => ({
      name: c.name,
      hasValue: !!c.value,
      length: c.value?.length || 0,
    }));

    // Try to import and use Clerk auth
    let authResult = null;
    let authError = null;

    try {
      const { auth } = await import("@clerk/nextjs/server");
      console.log("[auth-debug] About to call auth()");

      // Call auth and see what happens
      const authResponse = await auth();
      console.log("[auth-debug] Auth response received");

      authResult = {
        hasUserId: !!authResponse?.userId,
        userId: authResponse?.userId || null,
        sessionId: authResponse?.sessionId || null,
        hasSession: !!authResponse?.sessionId,
      };
    } catch (err: unknown) {
      console.error("[auth-debug] Auth error:", err);
      authError = {
        message: err instanceof Error ? err.message : String(err),
        name: err instanceof Error ? err.name : "Unknown",
        stack: err instanceof Error ? err.stack?.split("\n").slice(0, 5).join("\n") : undefined,
      };
    }

    return NextResponse.json({
      success: !authError,
      debug: {
        headers: {
          hasAuthorization: !!headers["authorization"],
          hasCookie: !!headers["cookie"],
          contentType: headers["content-type"],
          origin: headers["origin"],
          referer: headers["referer"],
        },
        cookies: {
          count: cookies.length,
          hasSessionCookie: cookies.some((c) => c.name.includes("__session")),
          hasClerkCookie: cookies.some((c) => c.name.includes("__clerk")),
          details: cookieInfo,
        },
        environment: {
          nodeEnv: process.env["NODE_ENV"],
          hasPublishableKey: !!process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"],
          hasSecretKey: !!process.env["CLERK_SECRET_KEY"],
          runtime: process.env["NEXT_RUNTIME"] || "nodejs",
        },
        authResult,
        authError,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    console.error("[auth-debug] Outer error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorName = error instanceof Error ? error.name : "Unknown";

    return NextResponse.json(
      {
        success: false,
        error: {
          message: errorMessage,
          name: errorName,
        },
      },
      { status: 500 }
    );
  }
}
