import type { NextConfig } from "next";

// Load dynamic environment configuration
// eslint-disable-next-line @typescript-eslint/no-require-imports
require("./next.config.env.js");

// Bundle analyzer for T-031
// eslint-disable-next-line @typescript-eslint/no-require-imports
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env["ANALYZE"] === 'true',
});

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
  // Image optimization for T-031
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 31536000, // 1 year cache
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  // Performance optimizations for T-031
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },
  // Compiler optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
};

export default withBundleAnalyzer(nextConfig);
