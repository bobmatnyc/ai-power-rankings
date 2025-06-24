import { withPayload } from "@payloadcms/next/withPayload";
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
    // Pass through dynamic URLs to client
    NEXT_PUBLIC_PAYLOAD_URL: process.env["NEXT_PUBLIC_PAYLOAD_URL"],
  },
  // Treat warnings as warnings, not errors
  typescript: {
    ignoreBuildErrors: false,
  },
  // Remove serverExternalPackages as it's handled by withPayload
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@payload-config": require.resolve("./payload.config.ts"),
    };
    return config;
  },
};

export default withPayload(nextConfig);
