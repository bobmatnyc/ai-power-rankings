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
 * Check if authentication is disabled or not configured
 */
function isAuthDisabled(): boolean {
  const isDisabled = process.env["NEXT_PUBLIC_DISABLE_AUTH"] === "true";
  const hasClerkKey = !!process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"];
  const hasClerkSecret = !!process.env["CLERK_SECRET_KEY"];

  return isDisabled || !hasClerkKey || !hasClerkSecret;
}

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
  try {
    // Check if auth is disabled
    if (isAuthDisabled()) {
      // Return a mock userId when auth is disabled for development/testing
      return { userId: "mock-user-id", error: null };
    }

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
    console.error("[API Auth] Authentication check failed:", error);

    // Enhanced error handling for different failure modes
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Check for specific useContext errors
    if (errorMessage.includes("useContext") || errorMessage.includes("createContext")) {
      console.error("[API Auth] React Context error detected - auth may be running in wrong runtime");

      // If auth is disabled, return mock data
      if (isAuthDisabled()) {
        return { userId: "mock-user-id", error: null };
      }

      return {
        error: NextResponse.json(
          {
            error: "Authentication runtime error",
            message: "Authentication service encountered a runtime error",
            code: "AUTH_RUNTIME_ERROR",
          },
          { status: 503 }
        ),
      };
    }

    // Handle module import failures
    if (errorMessage.includes("Cannot find module") || errorMessage.includes("not available")) {
      if (isAuthDisabled()) {
        return { userId: "mock-user-id", error: null };
      }
    }

    return {
      error: NextResponse.json(
        {
          error: "Authentication failed",
          message: process.env["NODE_ENV"] === "development" ? errorMessage : "Authentication service error",
          code: "AUTH_ERROR",
        },
        { status: 500 }
      ),
    };
  }
}

/**
 * Require admin privileges for an API route
 * Returns the userId and user if admin, or an error response if not
 *
 * Enhanced for Next.js 15 with proper server/client boundary isolation
 */
export async function requireAdmin() {
  try {
    // Check if auth is disabled
    if (isAuthDisabled()) {
      // Return mock admin user when auth is disabled for development/testing
      return {
        userId: "mock-admin-id",
        user: {
          id: "mock-admin-id",
          publicMetadata: { isAdmin: true },
          emailAddresses: [{ emailAddress: "admin@mock.local" }],
          firstName: "Mock",
          lastName: "Admin",
        } as any, // Mock user object
        error: null,
      };
    }

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

    const isAdmin = user.publicMetadata?.isAdmin === true;
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
    console.error("[API Auth] Admin check failed:", error);

    // Enhanced error handling for different failure modes
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Check for specific useContext errors
    if (errorMessage.includes("useContext") || errorMessage.includes("createContext")) {
      console.error("[API Auth] React Context error detected in admin check");

      // If auth is disabled, return mock data
      if (isAuthDisabled()) {
        return {
          userId: "mock-admin-id",
          user: {
            id: "mock-admin-id",
            publicMetadata: { isAdmin: true },
            emailAddresses: [{ emailAddress: "admin@mock.local" }],
            firstName: "Mock",
            lastName: "Admin",
          } as any,
          error: null,
        };
      }

      return {
        error: NextResponse.json(
          {
            error: "Authentication runtime error",
            message: "Authentication service encountered a runtime error",
            code: "AUTH_RUNTIME_ERROR",
          },
          { status: 503 }
        ),
      };
    }

    // Handle module import failures
    if (errorMessage.includes("Cannot find module") || errorMessage.includes("not available")) {
      if (isAuthDisabled()) {
        return {
          userId: "mock-admin-id",
          user: {
            id: "mock-admin-id",
            publicMetadata: { isAdmin: true },
            emailAddresses: [{ emailAddress: "admin@mock.local" }],
            firstName: "Mock",
            lastName: "Admin",
          } as any,
          error: null,
        };
      }
    }

    return {
      error: NextResponse.json(
        {
          error: "Authentication failed",
          message: process.env["NODE_ENV"] === "development" ? errorMessage : "Authentication service error",
          code: "AUTH_ERROR",
        },
        { status: 500 }
      ),
    };
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
    // Check if auth is disabled
    if (isAuthDisabled()) {
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
