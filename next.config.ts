import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    // During production builds, do not fail on warnings
    ignoreDuringBuilds: false,
    dirs: ["src"],
  },
  env: {
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.TURNSTILE_SITE_KEY,
  },
  // Treat warnings as warnings, not errors
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
