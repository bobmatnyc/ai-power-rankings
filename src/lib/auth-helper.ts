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
    const authData = await auth();
    const user = authData.userId ? await currentUser() : null;

    return {
      userId: authData.userId,
      sessionId: authData.sessionId,
      user: user
        ? {
            id: user.id,
            emailAddresses: user.emailAddresses || [],
            firstName: user.firstName,
            lastName: user.lastName,
            fullName: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
            username: user.username,
            isAdmin: user.publicMetadata?.isAdmin === true, // Check public metadata for admin flag
          }
        : null,
    };
  } catch (error) {
    console.error("Auth error:", error);
    // If Clerk fails, return null to trigger redirect
    return { userId: null, sessionId: null, user: null };
  }
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated() {
  if (isAuthDisabled) {
    return true; // Always authenticated in dev mode
  }

  try {
    const { userId } = await auth();
    return !!userId;
  } catch (error) {
    console.error("Auth check error:", error);
    return false;
  }
}

/**
 * Check if user is an admin
 */
export async function isAdmin() {
  const authData = await getAuth();
  return authData.user?.isAdmin === true;
}
