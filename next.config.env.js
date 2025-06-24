/**
 * Dynamic environment configuration for Next.js
 * This file sets up dynamic URLs based on the port the dev server is running on
 */

// Get the current port from environment or default
const PORT = process.env.PORT || "3000";

// In development, don't set these URLs initially
// Let the getUrl() function handle dynamic detection
// Only set them if explicitly provided
if (process.env.NODE_ENV === "development") {
  // Don't override if already explicitly set
  if (!process.env.NEXTAUTH_URL) {
    // Will be dynamically determined by getUrl() function
  }

  if (!process.env.NEXT_PUBLIC_PAYLOAD_URL) {
    // Will be dynamically determined by getUrl() function
  }
} else {
  // In production, set defaults if not provided
  if (!process.env.NEXTAUTH_URL) {
    process.env.NEXTAUTH_URL = `http://localhost:${PORT}`;
  }

  if (!process.env.NEXT_PUBLIC_PAYLOAD_URL) {
    process.env.NEXT_PUBLIC_PAYLOAD_URL = `http://localhost:${PORT}`;
  }
}

// Log the configuration in development
if (process.env.NODE_ENV === "development") {
  console.log("🔧 Dynamic Environment Configuration:");
  console.log(`   PORT: ${PORT}`);
  console.log(`   NEXTAUTH_URL: ${process.env.NEXTAUTH_URL || "Dynamic (via getUrl())"}`);
  console.log(
    `   NEXT_PUBLIC_PAYLOAD_URL: ${process.env.NEXT_PUBLIC_PAYLOAD_URL || "Dynamic (via getUrl())"}`
  );
}

module.exports = {
  PORT,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  NEXT_PUBLIC_PAYLOAD_URL: process.env.NEXT_PUBLIC_PAYLOAD_URL,
};
