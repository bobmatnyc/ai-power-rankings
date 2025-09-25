import { auth } from "@clerk/nextjs/server";
import {
  withErrorBoundary,
  safeClerkAuth,
  createSuccessResponse,
  createErrorResponse,
  validateRuntime
} from "@/lib/api-error-handler";

// Force Node.js runtime to match middleware configuration
export const runtime = "nodejs";

/**
 * Enhanced test endpoint using the new error handling system
 * Tests Clerk auth() function with comprehensive runtime validation
 */
export const GET = withErrorBoundary(async () => {
  console.log("[TEST-AUTH-V2] Starting enhanced auth test");

  // Step 1: Validate runtime environment
  const runtimeValidation = validateRuntime();
  console.log("[TEST-AUTH-V2] Runtime validation:", runtimeValidation);

  // Step 2: Check if auth is disabled
  const isAuthDisabled = process.env["NEXT_PUBLIC_DISABLE_AUTH"] === "true";
  if (isAuthDisabled) {
    return createSuccessResponse({
      authStatus: "disabled",
      message: "Authentication is disabled via environment variable",
      runtime: runtimeValidation,
      test: "auth-disabled"
    }, "Auth test completed (auth disabled)");
  }

  // Step 3: Check environment configuration
  const hasClerkKey = !!process.env["CLERK_SECRET_KEY"];
  const clerkKeyLength = process.env["CLERK_SECRET_KEY"]?.length || 0;

  if (!hasClerkKey) {
    return createErrorResponse(
      new Error("Missing configuration"),
      "CLERK_SECRET_KEY environment variable is not configured",
      500,
      "MISSING_CLERK_KEY",
      { runtime: runtimeValidation }
    );
  }

  // Step 4: Test Clerk auth() function with safe wrapper
  console.log("[TEST-AUTH-V2] Testing Clerk auth() function...");
  const authResult = await safeClerkAuth(auth, "test-auth endpoint");

  if (!authResult.success) {
    // Return the error response from safeClerkAuth
    return authResult.error!;
  }

  // Step 5: Prepare success response
  const authData = authResult.data;
  const responseData = {
    authStatus: "success",
    message: "Clerk auth() function working correctly",
    runtime: runtimeValidation,
    environment: {
      hasClerkKey: true,
      clerkKeyLength: `${clerkKeyLength} characters`,
      nodeEnv: process.env["NODE_ENV"],
      vercelEnv: process.env["VERCEL_ENV"] || "not-vercel"
    },
    authResult: {
      hasUserId: !!authData?.userId,
      hasSessionId: !!authData?.sessionId,
      userId: authData?.userId || null,
      authKeys: Object.keys(authData || {}),
      isAuthenticated: !!authData?.userId
    },
    test: {
      endpoint: "test-auth",
      version: "v2-with-error-handling",
      stage: "auth_success"
    }
  };

  console.log("[TEST-AUTH-V2] Test completed successfully");
  return createSuccessResponse(responseData, "Authentication test completed successfully");
});