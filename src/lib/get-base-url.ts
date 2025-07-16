/**
 * Get the base URL for the application
 * Works with Vercel preview deployments and production
 */
export function getBaseUrl(): string {
  // Client-side
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  // Server-side: Check environment variables in order of preference
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL;
  }

  // Local development fallback
  if (process.env.NODE_ENV === "development") {
    return `http://localhost:${process.env.PORT || 3000}`;
  }

  // Should not reach here in production
  console.warn("No base URL configured. Using relative paths.");
  return "";
}
