/**
 * Get the current application URL dynamically
 * Works in both server and client environments
 */

export function getUrl(): string {
  // Production URLs
  if (process.env["NODE_ENV"] === "production") {
    // Always prefer VERCEL_URL for preview deployments
    if (process.env["VERCEL_URL"]) {
      return `https://${process.env["VERCEL_URL"]}`;
    }
    // Check for custom production URL
    if (process.env["NEXT_PUBLIC_BASE_URL"]) {
      return process.env["NEXT_PUBLIC_BASE_URL"];
    }
    if (process.env["NEXTAUTH_URL"]) {
      return process.env["NEXTAUTH_URL"];
    }
    // Fallback for staging/production when no URL is configured
    // This allows the app to render even if the URL can't be determined
    // The URL will be determined from the request headers at runtime
    if (typeof window !== "undefined") {
      return window.location.origin;
    }
    // Return empty string to be resolved at runtime
    // This prevents SSR errors during build
    return "";
  }

  // Development - browser
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  // Development - server with headers (Next.js 13+)
  if (process?.env["__NEXT_PRIVATE_ORIGIN"]) {
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
