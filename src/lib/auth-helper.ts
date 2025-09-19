// Check if authentication should be disabled
const isAuthDisabled = process.env["NEXT_PUBLIC_DISABLE_AUTH"] === "true";

// Conditionally import Clerk auth
let clerkAuth: any = null;
if (!isAuthDisabled) {
  try {
    const clerkModule = require("@clerk/nextjs/server");
    clerkAuth = clerkModule.auth;
  } catch (error) {
    console.warn("Clerk not available, running in no-auth mode");
  }
}

/**
 * Server-side auth helper that works with both Clerk and no-auth mode
 * Returns user information or mock data in development mode
 */
export async function getAuth() {
  // In development mode with auth disabled, return mock user data
  if (isAuthDisabled || !clerkAuth) {
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
      }
    };
  }

  // In production or when auth is enabled, use Clerk
  try {
    const authData = await clerkAuth();
    return authData;
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
  if (isAuthDisabled || !clerkAuth) {
    return true; // Always authenticated in dev mode
  }

  try {
    const { userId } = await clerkAuth();
    return !!userId;
  } catch (error) {
    console.error("Auth check error:", error);
    return false;
  }
}