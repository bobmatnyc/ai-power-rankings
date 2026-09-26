/**
 * API Route Authentication Utilities for Next.js 15
 *
 * These utilities handle authentication directly in API routes to avoid
 * Edge Runtime conflicts with Clerk middleware.
 *
 * IMPORTANT: API routes run in Node.js runtime and handle their own authentication.
 * This prevents useContext errors that occur when Clerk components are imported
 * in Edge Runtime contexts.
 */

import { NextResponse } from "next/server";

// Import types only to avoid runtime dependencies
// Note: Only importing for type checking, actual imports are dynamic

/**
 * How the auth helpers treat the current environment.
 *
 * - `enforced`: Clerk is configured; every check runs against Clerk.
 * - `local-bypass`: local development with auth disabled or Clerk keys unset;
 *   the helpers return mock identities.
 * - `misconfigured`: a production or preview deployment without Clerk keys;
 *   the helpers refuse the request with 503.
 */
type AuthMode = "enforced" | "local-bypass" | "misconfigured";

/** True for `next start`/production builds and for Vercel production or preview deployments. */
function isProductionLike(): boolean {
  const vercelEnv = process.env["VERCEL_ENV"];
  return (
    process.env["NODE_ENV"] === "production" || vercelEnv === "production" || vercelEnv === "preview"
  );
}

let bypassWarningLogged = false;

/**
 * Decides whether the auth helpers enforce Clerk, bypass it, or refuse.
 *
 * Why: Missing Clerk keys used to mean "auth disabled", so a deployment whose
 * keys were unset returned a mock admin to every caller.
 * What: In a production-like environment the bypass is never used — Clerk is
 * enforced when both keys are set, and the mode is `misconfigured` otherwise.
 * `NEXT_PUBLIC_DISABLE_AUTH` and missing keys only bypass auth outside
 * production, with a one-time warning.
 * Test: `tests/unit/api-auth-fail-closed.test.ts`.
 */
function resolveAuthMode(): AuthMode {
  const disabledByFlag = process.env["NEXT_PUBLIC_DISABLE_AUTH"] === "true";
  const hasClerkKey = !!process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"];
  const hasClerkSecret = !!process.env["CLERK_SECRET_KEY"];
  const configured = hasClerkKey && hasClerkSecret;

  if (isProductionLike()) {
    if (configured) return "enforced";
    console.error(
      "[API Auth] Clerk keys are missing in a production environment; refusing authenticated requests.",
      { hasClerkKey, hasClerkSecret }
    );
    return "misconfigured";
  }

  if (!disabledByFlag && configured) return "enforced";

  if (!bypassWarningLogged) {
    bypassWarningLogged = true;
    console.warn(
      "[API Auth] Authentication is bypassed for local development (auth disabled or Clerk keys unset). Mock identities are returned."
    );
  }
  return "local-bypass";
}

/** 503 returned when a production-like environment has no Clerk configuration. */
function authNotConfiguredResponse() {
  return NextResponse.json(
    {
      error: "Authentication service unavailable",
      message: "The authentication service is not configured",
      code: "AUTH_NOT_CONFIGURED",
    },
    { status: 503 }
  );
}

const MOCK_ADMIN_USER = {
  id: "mock-admin-id",
  privateMetadata: { isAdmin: true },
  emailAddresses: [{ emailAddress: "admin@mock.local" }],
  firstName: "Mock",
  lastName: "Admin",
};

/**
 * Next.js 15 safe dynamic import with React Context isolation
 * This prevents useContext errors in production builds
 */
async function safeImportClerk(): Promise<{
  auth?: typeof import("@clerk/nextjs/server")["auth"];
  currentUser?: typeof import("@clerk/nextjs/server")["currentUser"];
  error?: Error;
}> {
  try {
    // Ensure we're in Node.js runtime, not Edge Runtime
    if (typeof process === "undefined" || typeof process.env === "undefined") {
      throw new Error("Clerk can only be imported in Node.js runtime");
    }

    // Dynamic import with explicit server-side path
    const clerkModule = await import("@clerk/nextjs/server");

    // Validate the imported module structure
    if (!clerkModule || typeof clerkModule.auth !== "function") {
      throw new Error("Clerk server module did not export expected functions");
    }

    return {
      auth: clerkModule.auth,
      currentUser: clerkModule.currentUser,
    };
  } catch (error) {
    console.error("[API Auth] Failed to import Clerk safely:", error);
    return { error: error as Error };
  }
}

/**
 * Require authentication for an API route
 * Returns the userId if authenticated, or an error response if not
 *
 * Enhanced for Next.js 15 with proper server/client boundary isolation
 */
export async function requireAuth() {
  const mode = resolveAuthMode();
  if (mode === "misconfigured") {
    return { error: authNotConfiguredResponse() };
  }
  if (mode === "local-bypass") {
    return { userId: "mock-user-id", error: null };
  }

  try {
    // Use safe import to prevent useContext errors
    const { auth, error: importError } = await safeImportClerk();

    if (importError || !auth) {
      console.error("[API Auth] Clerk import failed:", importError?.message);
      return {
        error: NextResponse.json(
          {
            error: "Authentication service unavailable",
            message: "The authentication service is not properly configured",
            code: "AUTH_SERVICE_ERROR",
            details: process.env["NODE_ENV"] === "development" ? importError?.message : undefined,
          },
          { status: 503 }
        ),
      };
    }

    // Call auth() in a try-catch to handle React Context errors
    let authResult: Awaited<ReturnType<typeof auth>>;
    try {
      authResult = await auth();
    } catch (contextError) {
      console.error("[API Auth] React Context error in auth():", contextError);
      throw new Error("Authentication context not available in server environment");
    }

    const userId = authResult?.userId;

    if (!userId) {
      return {
        error: NextResponse.json(
          {
            error: "Unauthorized",
            message: "Authentication required",
            code: "AUTH_REQUIRED",
          },
          { status: 401 }
        ),
      };
    }

    return { userId, error: null };
  } catch (error) {
    return { error: authFailureResponse(error, "Authentication check failed") };
  }
}

/**
 * Maps an unexpected failure inside an auth check to an error response.
 * Never grants access: every arm is a 5xx.
 */
function authFailureResponse(error: unknown, logLabel: string) {
  console.error(`[API Auth] ${logLabel}:`, error);
  const errorMessage = error instanceof Error ? error.message : "Unknown error";

  if (errorMessage.includes("useContext") || errorMessage.includes("createContext")) {
    console.error("[API Auth] React Context error detected - auth may be running in wrong runtime");
    return NextResponse.json(
      {
        error: "Authentication runtime error",
        message: "Authentication service encountered a runtime error",
        code: "AUTH_RUNTIME_ERROR",
      },
      { status: 503 }
    );
  }

  return NextResponse.json(
    {
      error: "Authentication failed",
      message: process.env["NODE_ENV"] === "development" ? errorMessage : "Authentication service error",
      code: "AUTH_ERROR",
    },
    { status: 500 }
  );
}

/**
 * Require admin privileges for an API route.
 *
 * Why: Admin handlers rely on this as their only gate, so any path that
 * returns a user without a verified Clerk session is an open admin API.
 * What: Returns `{ userId, user, error: null }` for a signed-in user whose
 * `privateMetadata.isAdmin` is `true`; otherwise `{ error }` carrying 401
 * (no session), 403 (not an admin), 404 (user lookup empty), 503 (Clerk not
 * configured in a production-like environment, or unavailable) or 500.
 * Outside production, with auth disabled or Clerk keys unset, it returns a
 * mock admin.
 * Test: `tests/unit/api-auth-fail-closed.test.ts`, `tests/unit/admin-api-auth.test.ts`.
 */
export async function requireAdmin() {
  const mode = resolveAuthMode();
  if (mode === "misconfigured") {
    return { error: authNotConfiguredResponse() };
  }
  if (mode === "local-bypass") {
    return {
      userId: "mock-admin-id",
      user: MOCK_ADMIN_USER as any, // Mock user object
      error: null,
    };
  }

  try {
    // Use safe import to prevent useContext errors
    const { auth, currentUser, error: importError } = await safeImportClerk();

    if (importError || !auth || !currentUser) {
      console.error("[API Auth] Clerk import failed for admin check:", importError?.message);
      return {
        error: NextResponse.json(
          {
            error: "Authentication service unavailable",
            message: "The authentication service is not properly configured",
            code: "AUTH_SERVICE_ERROR",
            details: process.env["NODE_ENV"] === "development" ? importError?.message : undefined,
          },
          { status: 503 }
        ),
      };
    }

    // Call auth() in a try-catch to handle React Context errors
    let authResult: Awaited<ReturnType<typeof auth>>;
    let user: Awaited<ReturnType<typeof currentUser>>;

    try {
      authResult = await auth();
      const userId = authResult?.userId;

      if (!userId) {
        return {
          error: NextResponse.json(
            {
              error: "Unauthorized",
              message: "Authentication required",
              code: "AUTH_REQUIRED",
            },
            { status: 401 }
          ),
        };
      }

      user = await currentUser();
    } catch (contextError) {
      console.error("[API Auth] React Context error in admin check:", contextError);
      throw new Error("Authentication context not available in server environment");
    }

    if (!user) {
      return {
        error: NextResponse.json(
          {
            error: "User not found",
            message: "Unable to retrieve user information",
            code: "USER_NOT_FOUND",
          },
          { status: 404 }
        ),
      };
    }

    const isAdmin = user.privateMetadata?.isAdmin === true;
    const userId = authResult.userId;

    if (!isAdmin) {
      return {
        error: NextResponse.json(
          {
            error: "Forbidden",
            message: "Admin privileges required",
            code: "ADMIN_REQUIRED",
            userId,
          },
          { status: 403 }
        ),
      };
    }

    return { userId, user, error: null };
  } catch (error) {
    return { error: authFailureResponse(error, "Admin check failed") };
  }
}

/**
 * Optional authentication - returns userId if authenticated, null if not
 * Never returns an error response
 *
 * Enhanced for Next.js 15 with proper server/client boundary isolation
 */
export async function optionalAuth() {
  try {
    // No Clerk session to read: bypassed locally, or unconfigured in production.
    if (resolveAuthMode() !== "enforced") {
      return { userId: null, error: null };
    }

    // Use safe import to prevent useContext errors
    const { auth, error: importError } = await safeImportClerk();

    if (importError || !auth) {
      console.warn("[API Auth] Clerk module not available for optional auth:", importError?.message);
      return { userId: null, error: null };
    }

    // Call auth() in a try-catch to handle React Context errors gracefully
    try {
      const authResult = await auth();
      const userId = authResult?.userId || null;
      return { userId, error: null };
    } catch (contextError) {
      console.warn("[API Auth] React Context error in optional auth:", contextError);
      // For optional auth, we return null instead of throwing
      return { userId: null, error: null };
    }
  } catch (error) {
    console.error("[API Auth] Optional auth check failed:", error);
    // Optional auth should never fail - always return null userId
    return { userId: null, error: null };
  }
}
