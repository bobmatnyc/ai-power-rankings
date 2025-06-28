import type { NextConfig } from "next";

// Load dynamic environment configuration
// eslint-disable-next-line @typescript-eslint/no-require-imports
require("./next.config.env.js");

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    // During production builds, do not fail on warnings
    ignoreDuringBuilds: true,
  },
  env: {
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env["TURNSTILE_SITE_KEY"],
  },
  // Treat warnings as warnings, not errors
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
