/**
 * Authentication utilities for development and production environments
 */

/**
 * Check if the application is running in a local development environment
 * Returns true for development mode or localhost deployments
 */
export function isLocalEnvironment(): boolean {
  // Check NODE_ENV
  if (process.env["NODE_ENV"] === "development") {
    return true;
  }

  // Check if running on localhost (for local builds)
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname.startsWith("192.168.");
  }

  // Check Vercel environment variables (server-side)
  // VERCEL_ENV is not set in local development
  if (!process.env["VERCEL_ENV"]) {
    return true;
  }

  // Check if it's a preview deployment (not production)
  if (process.env["VERCEL_ENV"] === "development" || process.env["VERCEL_ENV"] === "preview") {
    return false; // Still require auth for preview deployments
  }

  return false;
}

/**
 * Mock session for local development
 * Provides admin access without OAuth
 */
export function getLocalMockSession() {
  return {
    user: {
      name: "Local Admin",
      email: "admin@localhost",
      isAdmin: true,
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
  };
}

/**
 * Check if authentication should be bypassed
 * Returns true if we're in local environment and should skip auth
 */
export function shouldBypassAuth(): boolean {
  return isLocalEnvironment();
}
