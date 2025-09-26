import type { NextConfig } from "next";

// Load dynamic environment configuration
// eslint-disable-next-line @typescript-eslint/no-require-imports
require("./next.config.env.js");

// Bundle analyzer for T-031 - temporarily disabled due to missing dependency
// TODO: Re-enable when @next/bundle-analyzer is reinstalled
// const withBundleAnalyzer = require("@next/bundle-analyzer")({
//   enabled: process.env["ANALYZE"] === "true",
// });
const withBundleAnalyzer = (config: NextConfig) => config;

const nextConfig: NextConfig = {
  /* config options here */
  // TurboPack is enabled automatically in Next.js 15+
  // Use --turbo flag for dev mode: next dev --turbo

  // CRITICAL: Enable Node.js runtime for API routes to fix Clerk auth() issues
  // This resolves the Edge Runtime vs Node.js runtime mismatch causing useContext errors in production
  // Middleware runs in Edge Runtime, API routes run in Node.js runtime
  serverExternalPackages: ["@clerk/nextjs"],

  experimental: {
    // Keep existing optimizations
    optimizePackageImports: ["lucide-react", "@radix-ui/react-icons", "@next/font"],
    webVitalsAttribution: ["CLS", "LCP"],
    // Enable CSS optimization
    optimizeCss: true,
    // Reduce memory usage during builds and prevent timeout
    workerThreads: false,
    // Disable all polyfills for modern browsers
    esmExternals: true,
    // Note: staticPageGenerationTimeout is not available in NextConfig
    // Instead we use force-dynamic on individual pages

    // Next.js 15 specific optimizations for App Router
    // Improve server component performance
    serverComponentsExternalPackages: ["@clerk/nextjs"],
    // Optimize server-side imports
    serverSourceMaps: process.env["NODE_ENV"] === "development",
  },
  // Removed turbopack config - let Next.js handle defaults
  // to avoid module resolution conflicts
  // Optimize output for faster builds
  // Disable static export to avoid Html import issue in Next.js 15.3.x
  output: undefined, // process.env["NEXT_OUTPUT"] === "export" ? "export" : undefined,
  eslint: {
    // During production builds, do not fail on warnings
    ignoreDuringBuilds: true,
  },
  env: {
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env["NEXT_PUBLIC_TURNSTILE_SITE_KEY"],
  },
  // Temporarily ignore TypeScript errors for performance testing
  typescript: {
    ignoreBuildErrors: true,
  },
  // Image optimization for T-031
  images: {
    formats: ["image/webp", "image/avif"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 31536000, // 1 year cache
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  // Enhanced compiler optimizations
  compiler: {
    removeConsole: process.env["NODE_ENV"] === "production",
    // Remove React dev warnings in production
    reactRemoveProperties:
      process.env["NODE_ENV"] === "production"
        ? {
            properties: ["^data-testid$"],
          }
        : false,
  },
  // Modern browser targeting for T-040 - remove legacy polyfills
  // Note: swcMinify is now enabled by default in Next.js 15
  // Disable polyfills for modern browsers
  transpilePackages: ["recharts"],

  // Use modern JavaScript output
  modularizeImports: {
    "@radix-ui": {
      transform: "@radix-ui/react-{{member}}",
      skipDefaultConversion: true,
    },
    // Removed lucide-react transform - causing module resolution issues
    // Let Next.js handle lucide-react imports normally
  },
  // Headers for T-040 cache optimization
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
        ],
      },
      {
        source: "/favicon.ico",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/crown-of-technology.webp",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/:path*.webp",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/:path*.png",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/:path*.jpg",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/:path*.jpeg",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/:path*.svg",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/:path*.woff2",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      // API routes - ensure fresh data
      {
        source: "/api/rankings",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, s-maxage=300, stale-while-revalidate=600, must-revalidate",
          },
          {
            key: "Surrogate-Control",
            value: "max-age=300",
          },
        ],
      },
      {
        source: "/api/tools",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
          },
        ],
      },
    ];
  },
  // Simplified webpack configuration to avoid module resolution conflicts
  webpack: (config, { isServer }) => {
    // Only apply minimal necessary customizations
    if (!isServer && process.env["NODE_ENV"] === "production") {
      // Minimal polyfill disabling for production only
      config.resolve.alias = {
        ...config.resolve.alias,
        "core-js": false,
        "regenerator-runtime": false,
      };
    }
    return config;
  },
  // TurboPack handles bundling, no webpack config needed
  // Disable x-powered-by header
  poweredByHeader: false,
  // Enable compression
  compress: true,
};

export default withBundleAnalyzer(nextConfig);
