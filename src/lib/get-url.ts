/**
 * Get the current application URL dynamically
 * Works in both server and client environments
 */

export function getUrl(): string {
  try {
    // Try all available URL sources in order of preference
    console.log("[getUrl] Checking for URL sources...");
    console.log("[getUrl] Environment checks:", {
      HAS_NEXT_PUBLIC_BASE_URL: !!process.env["NEXT_PUBLIC_BASE_URL"],
      HAS_VERCEL_URL: !!process.env["VERCEL_URL"],
      HAS_NEXTAUTH_URL: !!process.env["NEXTAUTH_URL"],
      NODE_ENV: process.env["NODE_ENV"],
      VERCEL_ENV: process.env["VERCEL_ENV"],
      IS_BROWSER: typeof window !== "undefined",
      HAS_NEXT_PRIVATE_ORIGIN: !!process?.env["__NEXT_PRIVATE_ORIGIN"],
    });

    // 1. Check for explicit base URL (works everywhere)
    if (process.env["NEXT_PUBLIC_BASE_URL"]) {
      console.log("[getUrl] Using NEXT_PUBLIC_BASE_URL");
      return process.env["NEXT_PUBLIC_BASE_URL"];
    }

    // 2. Check for Vercel URL (preview deployments)
    if (process.env["VERCEL_URL"]) {
      const url = `https://${process.env["VERCEL_URL"]}`;
      console.log("[getUrl] Using VERCEL_URL:", url);
      return url;
    }

    // 3. Check for NextAuth URL
    if (process.env["NEXTAUTH_URL"]) {
      console.log("[getUrl] Using NEXTAUTH_URL");
      return process.env["NEXTAUTH_URL"];
    }

    // 4. Browser environment - use current origin
    if (typeof window !== "undefined") {
      console.log("[getUrl] Using window.location.origin");
      return window.location.origin;
    }

    // 5. Next.js private origin (server-side)
    if (process?.env["__NEXT_PRIVATE_ORIGIN"]) {
      console.log("[getUrl] Using __NEXT_PRIVATE_ORIGIN");
      return process.env["__NEXT_PRIVATE_ORIGIN"];
    }

    // 6. Development fallback with PORT
    if (process.env["NODE_ENV"] === "development") {
      const port = process.env["PORT"] || "3001";
      const url = `http://localhost:${port}`;
      console.log("[getUrl] Using development fallback:", url);
      return url;
    }

    // 7. Staging/Production fallback - construct from Vercel environment
    if (process.env["VERCEL_ENV"] === "preview" && process.env["VERCEL_BRANCH_URL"]) {
      const url = `https://${process.env["VERCEL_BRANCH_URL"]}`;
      console.log("[getUrl] Using VERCEL_BRANCH_URL for preview:", url);
      return url;
    }

    // 8. Last resort production fallbacks
    if (process.env["NODE_ENV"] === "production") {
      // Try to determine the production URL
      const productionUrl = "https://aipowerrankings.com";
      console.log("[getUrl] Using production fallback:", productionUrl);
      return productionUrl;
    }

    // 9. Final fallback - return empty string to be resolved at runtime
    // This prevents SSR errors when URL can't be determined
    console.log("[getUrl] WARNING: No URL source found, returning empty string");
    return "";
  } catch (error) {
    console.error("[getUrl] Error determining URL:", error);
    // Return production URL as ultimate fallback
    return process.env["NODE_ENV"] === "production" ? "https://aipowerrankings.com" : "";
  }
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
