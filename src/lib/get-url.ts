/**
 * Get the current application URL dynamically
 * Works in both server and client environments
 */

export function getUrl(): string {
  // Try all available URL sources in order of preference

  // 1. Check for explicit base URL (works everywhere)
  if (process.env["NEXT_PUBLIC_BASE_URL"]) {
    return process.env["NEXT_PUBLIC_BASE_URL"];
  }

  // 2. Check for Vercel URL (preview deployments)
  if (process.env["VERCEL_URL"]) {
    return `https://${process.env["VERCEL_URL"]}`;
  }

  // 3. Check for NextAuth URL
  if (process.env["NEXTAUTH_URL"]) {
    return process.env["NEXTAUTH_URL"];
  }

  // 4. Browser environment - use current origin
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  // 5. Next.js private origin (server-side)
  if (process?.env["__NEXT_PRIVATE_ORIGIN"]) {
    return process.env["__NEXT_PRIVATE_ORIGIN"];
  }

  // 6. Development fallback with PORT
  if (process.env["NODE_ENV"] === "development") {
    const port = process.env["PORT"] || "3000";
    return `http://localhost:${port}`;
  }

  // 7. Production/staging fallback - return empty string to be resolved at runtime
  // This prevents SSR errors when URL can't be determined
  return "";
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
