/**
 * Get the current application URL dynamically
 * Works in both server and client environments
 */

export function getUrl(): string {
  // Production URLs
  if (process.env.NODE_ENV === "production") {
    // Always prefer VERCEL_URL for preview deployments
    if (process.env["VERCEL_URL"]) {
      return `https://${process.env["VERCEL_URL"]}`;
    }
    if (process.env["NEXTAUTH_URL"]) {
      return process.env["NEXTAUTH_URL"];
    }
    return "https://aipowerrankings.com";
  }

  // Development - browser
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  // Development - server with headers (Next.js 13+)
  if (typeof process !== "undefined" && process.env["__NEXT_PRIVATE_ORIGIN"]) {
    return process.env["__NEXT_PRIVATE_ORIGIN"];
  }

  // Development - fallback to PORT
  const port = process.env["PORT"] || "3000";
  return `http://localhost:${port}`;
}

/**
 * Get the base URL for API routes
 */
export function getApiUrl(): string {
  // In the browser, use relative URLs
  if (typeof window !== "undefined") {
    return "";
  }

  return getUrl();
}

/**
 * Get the auth URL for NextAuth
 */
export function getAuthUrl(): string {
  // For Vercel preview deployments, always use the preview URL
  if (process.env["VERCEL_URL"]) {
    return `https://${process.env["VERCEL_URL"]}`;
  }

  // If explicitly set, use it
  if (process.env["NEXTAUTH_URL"]) {
    return process.env["NEXTAUTH_URL"];
  }

  return getUrl();
}
