import { auth, currentUser } from "@clerk/nextjs/server";

// Check if authentication should be disabled
const isAuthDisabled = process.env["NEXT_PUBLIC_DISABLE_AUTH"] === "true";

/**
 * Server-side auth helper that works with both Clerk and no-auth mode
 * Returns user information or mock data in development mode
 */
export async function getAuth() {
  // In development mode with auth disabled, return mock user data
  if (isAuthDisabled) {
    return {
      userId: "dev-user",
      sessionId: "dev-session",
      user: {
        id: "dev-user",
        emailAddresses: [{ emailAddress: "dev@localhost" }],
        firstName: "Dev",
        lastName: "User",
        fullName: "Dev User",
        username: "devuser",
        isAdmin: true, // Dev mode always has admin access
      },
    };
  }

  // In production or when auth is enabled, use Clerk
  try {
    console.log("[auth-helper] Getting auth data from Clerk...");
    const authData = await auth();
    console.log("[auth-helper] Auth data received, userId:", authData?.userId);

    let user = null;
    if (authData?.userId) {
      try {
        console.log("[auth-helper] Fetching current user...");
        user = await currentUser();
        console.log("[auth-helper] Current user fetched:", user?.id);
      } catch (userError) {
        console.error("[auth-helper] Error fetching current user:", userError);
        console.error(
          "[auth-helper] User error stack:",
          userError instanceof Error ? userError.stack : "No stack"
        );
        // Continue without user data rather than failing completely
        user = null;
      }
    }

    return {
      userId: authData?.userId || null,
      sessionId: authData?.sessionId || null,
      user: user
        ? {
            id: user.id,
            emailAddresses: user.emailAddresses || [],
            firstName: user.firstName || null,
            lastName: user.lastName || null,
            fullName: `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Unknown",
            username: user.username || null,
            isAdmin: user.privateMetadata?.isAdmin === true, // Check private metadata for admin flag
          }
        : null,
    };
  } catch (error) {
    console.error("[auth-helper] Auth error in getAuth:", error);
    console.error("[auth-helper] Error stack:", error instanceof Error ? error.stack : "No stack");
    console.error("[auth-helper] Error type:", typeof error);
    console.error("[auth-helper] Error constructor:", error?.constructor?.name);
    // If Clerk fails, return null to trigger redirect
    return { userId: null, sessionId: null, user: null };
  }
}

/**
 * Check if user is authenticated
 * Simplified version that relies on Clerk middleware setting up context properly
 */
export async function isAuthenticated() {
  if (isAuthDisabled) {
    return true; // Always authenticated in dev mode
  }

  const { userId } = await auth();
  return !!userId;
}

/**
 * Check if user is an admin
 */
export async function isAdmin() {
  try {
    console.log("[auth-helper] Checking admin status...");
    const authData = await getAuth();

    // In development mode, grant admin access to all authenticated users
    if (process.env["NODE_ENV"] === "development" && authData.userId) {
      console.log("[auth-helper] Development mode: granting admin access to authenticated user");
      return true;
    }

    const adminStatus = authData.user?.isAdmin === true;
    console.log("[auth-helper] Admin status:", adminStatus);
    return adminStatus;
  } catch (error) {
    console.error("[auth-helper] Error checking admin status:", error);
    console.error("[auth-helper] Error stack:", error instanceof Error ? error.stack : "No stack");
    return false;
  }
}
