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
  experimental: {
    // Keep existing optimizations
    optimizePackageImports: ["lucide-react", "@radix-ui/react-icons", "@next/font"],
    webVitalsAttribution: ["CLS", "LCP"],
    // Disable experimental CSS optimization to avoid conflicts with custom webpack plugin
    // optimizeCss: true,
    // Reduce memory usage during builds and prevent timeout
    workerThreads: false,
    // Disable all polyfills for modern browsers
    esmExternals: true,
    // Note: staticPageGenerationTimeout is not available in NextConfig
    // Instead we use force-dynamic on individual pages
  },
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
  // Configure webpack to exclude unnecessary polyfills for modern browsers
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Completely disable core-js polyfills for modern browsers
      config.resolve.alias = {
        ...config.resolve.alias,
        // Disable all core-js polyfills - our browsers support these natively
        "core-js": false,
        "core-js/modules": false,
        "core-js/stable": false,
        "core-js/features": false,
        "core-js/fn": false,
        "core-js/library": false,
        "core-js/stage": false,
        "core-js/web": false,
        "core-js/modules/es.array.at": false,
        "core-js/modules/es.array.flat": false,
        "core-js/modules/es.array.flat-map": false,
        "core-js/modules/es.object.from-entries": false,
        "core-js/modules/es.object.has-own": false,
        "core-js/modules/es.string.trim-end": false,
        "core-js/modules/es.string.trim-start": false,
        "core-js/modules/es.promise": false,
        "core-js/modules/es.string.includes": false,
        "core-js/modules/es.object.assign": false,
        "core-js/modules/es.object.keys": false,
        "core-js/modules/es.object.values": false,
        "core-js/modules/es.object.entries": false,
        "core-js/modules/es.array.includes": false,
        "core-js/modules/es.array.iterator": false,
        "core-js/modules/es.map": false,
        "core-js/modules/es.set": false,
        "core-js/modules/es.weak-map": false,
        "core-js/modules/es.weak-set": false,
        // Also disable regenerator-runtime
        "regenerator-runtime": false,
        "regenerator-runtime/runtime": false,
        "@babel/runtime/regenerator": false,
        // Simplified SWC helper handling - allow necessary helpers to avoid module resolution issues
        // Remove selective blocking to prevent production issues
      };

      // Completely ignore polyfill imports
      const webpack = require("webpack");
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /^core-js/,
        }),
        new webpack.IgnorePlugin({
          resourceRegExp: /^regenerator-runtime/,
        }),
        new webpack.IgnorePlugin({
          resourceRegExp: /@babel\/runtime\/regenerator/,
        }),
        // Simplified: only ignore broad @swc/helpers to prevent module resolution issues
        // Allow specific helpers that might be needed for dynamic imports
        new webpack.IgnorePlugin({
          resourceRegExp: /^@swc\/helpers$/,
        })
      );

      // Force modern browser targets in Babel/SWC
      if (config.module?.rules) {
        config.module.rules.forEach((rule: any) => {
          if (rule.use && Array.isArray(rule.use)) {
            rule.use.forEach((useEntry: any) => {
              if (useEntry.loader?.includes("swc-loader")) {
                useEntry.options = {
                  ...useEntry.options,
                  env: {
                    targets: {
                      chrome: "95",
                      firefox: "95",
                      safari: "15.4",
                      edge: "95",
                    },
                    loose: true,
                    modules: false,
                    forceAllTransforms: false,
                  },
                };
              }
            });
          }
        });
      }

      // Enhanced code splitting configuration
      config.optimization = {
        ...config.optimization,
        runtimeChunk: "single",
        splitChunks: {
          chunks: "all",
          maxInitialRequests: 25,
          minSize: 20000,
          cacheGroups: {
            default: false,
            vendors: false,
            // Separate framework code
            framework: {
              name: "framework",
              chunks: "all",
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler|prop-types|use-sync-external-store)[\\/]/,
              priority: 40,
              enforce: true,
            },
            // Separate UI libraries
            lib: {
              test(module: any) {
                return module.size() > 160000 && /node_modules[\\/]/.test(module.identifier());
              },
              name(module: any) {
                const hash = require("node:crypto")
                  .createHash("sha1")
                  .update(module.identifier())
                  .digest("hex")
                  .substring(0, 8);
                return `lib-${hash}`;
              },
              priority: 30,
              minChunks: 1,
              reuseExistingChunk: true,
            },
            // Analytics and monitoring
            analytics: {
              name: "analytics",
              test: /[\\/]node_modules[\\/](@vercel[\\/]analytics|@vercel[\\/]speed-insights|@qwik\.dev[\\/]partytown)[\\/]/,
              priority: 35,
              reuseExistingChunk: true,
            },
            // Common components
            commons: {
              name: "commons",
              minChunks: 2,
              priority: 20,
            },
            // Shared modules
            shared: {
              name(_module: any, chunks: any) {
                const hash = require("node:crypto")
                  .createHash("sha1")
                  .update(chunks.reduce((acc: string, chunk: any) => acc + chunk.name, ""))
                  .digest("hex")
                  .substring(0, 8);
                return `shared-${hash}`;
              },
              priority: 10,
              minChunks: 2,
              reuseExistingChunk: true,
            },
          },
        },
      };

      // Temporarily disable custom CSS optimization plugin to avoid webpack cache conflicts
      // Rely on Next.js built-in CSS optimization and Tailwind purging instead
      // if (process.env.NODE_ENV === 'production') {
      //   const OptimizeCssPlugin = require("./src/lib/optimize-css-plugin");
      //   config.plugins.push(new OptimizeCssPlugin({
      //     enableCriticalCss: true,
      //     removeUnusedCss: true,
      //     inlineCriticalCss: false,
      //   }));
      // }
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
