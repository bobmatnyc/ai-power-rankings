/**
 * Dynamic environment configuration
 * Handles dynamic URLs based on the current environment and port
 */

// Get the current URL dynamically
function getCurrentUrl(): string {
  // In production, use the configured URLs
  if (process.env.NODE_ENV === "production") {
    return process.env.NEXTAUTH_URL || "https://aipowerrankings.com";
  }

  // In development, detect the port dynamically
  if (typeof window !== "undefined") {
    // Client-side: use window.location
    return window.location.origin;
  }

  // Server-side: use the PORT env var or default
  const port = process.env.PORT || "3000";
  return `http://localhost:${port}`;
}

// Export dynamic environment variables
export const env = {
  // URLs that adapt to the current environment
  NEXTAUTH_URL: process.env.NEXTAUTH_URL || getCurrentUrl(),
  NEXT_PUBLIC_PAYLOAD_URL: process.env.NEXT_PUBLIC_PAYLOAD_URL || getCurrentUrl(),

  // Other environment variables remain as-is
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  SUPABASE_DATABASE_URL: process.env.SUPABASE_DATABASE_URL!,

  // Auth
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET!,
  AUTH_SECRET: process.env.AUTH_SECRET!,

  // Payload
  PAYLOAD_SECRET: process.env.PAYLOAD_SECRET!,

  // Feature flags
  NODE_ENV: process.env.NODE_ENV || "development",
  isDevelopment: process.env.NODE_ENV === "development",
  isProduction: process.env.NODE_ENV === "production",
};

// Helper to get the base URL for API calls
export function getBaseUrl(): string {
  if (typeof window !== "undefined") {
    // Browser should use relative path
    return "";
  }

  if (process.env.VERCEL_URL) {
    // Reference for vercel.com
    return `https://${process.env.VERCEL_URL}`;
  }

  // Use dynamic URL
  return env.NEXTAUTH_URL;
}

// Helper to get the public URL for client-side usage
export function getPublicUrl(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return env.NEXT_PUBLIC_PAYLOAD_URL;
}
