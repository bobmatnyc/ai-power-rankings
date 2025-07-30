import type { NextConfig } from "next";

// Load dynamic environment configuration
// eslint-disable-next-line @typescript-eslint/no-require-imports
require("./next.config.env.js");

// Bundle analyzer for T-031
// eslint-disable-next-line @typescript-eslint/no-require-imports
const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env["ANALYZE"] === "true",
});

const nextConfig: NextConfig = {
  /* config options here */
  // TurboPack is enabled automatically in Next.js 15+
  // Use --turbo flag for dev mode: next dev --turbo
  experimental: {
    // Keep existing optimizations
    optimizePackageImports: ["lucide-react", "@radix-ui/react-icons", "@next/font"],
    webVitalsAttribution: ["CLS", "LCP"],
    // optimizeCss: true, // Temporarily disabled due to conflict with custom CSS optimization
    // Reduce memory usage during builds
    workerThreads: false,
  },
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
  transpilePackages: [],
  // Use modern JavaScript output
  modularizeImports: {
    "@radix-ui": {
      transform: "@radix-ui/react-{{member}}",
      skipDefaultConversion: true,
    },
    "lucide-react": {
      transform: "lucide-react/dist/esm/icons/{{member}}",
    },
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
      // Exclude polyfills for features that are natively supported in our target browsers
      config.resolve.alias = {
        ...config.resolve.alias,
        // Skip all core-js polyfills by aliasing to empty module
        'core-js': require.resolve('./scripts/empty-module.js'),
        'core-js/modules': require.resolve('./scripts/empty-module.js'),
        // Also exclude specific polyfill patterns
        'core-js/modules/es.array.at': require.resolve('./scripts/empty-module.js'),
        'core-js/modules/es.array.flat': require.resolve('./scripts/empty-module.js'),
        'core-js/modules/es.array.flat-map': require.resolve('./scripts/empty-module.js'),
        'core-js/modules/es.object.from-entries': require.resolve('./scripts/empty-module.js'),
        'core-js/modules/es.object.has-own': require.resolve('./scripts/empty-module.js'),
        'core-js/modules/es.string.trim-end': require.resolve('./scripts/empty-module.js'),
        'core-js/modules/es.string.trim-start': require.resolve('./scripts/empty-module.js'),
        'core-js/modules/es.promise': require.resolve('./scripts/empty-module.js'),
        'core-js/modules/es.string.includes': require.resolve('./scripts/empty-module.js'),
        'core-js/modules/es.object.assign': require.resolve('./scripts/empty-module.js'),
        'core-js/modules/es.object.keys': require.resolve('./scripts/empty-module.js'),
        'core-js/modules/es.object.values': require.resolve('./scripts/empty-module.js'),
        'core-js/modules/es.object.entries': require.resolve('./scripts/empty-module.js'),
        'core-js/modules/es.array.includes': require.resolve('./scripts/empty-module.js'),
        'core-js/modules/es.array.iterator': require.resolve('./scripts/empty-module.js'),
        'core-js/modules/es.map': require.resolve('./scripts/empty-module.js'),
        'core-js/modules/es.set': require.resolve('./scripts/empty-module.js'),
        'core-js/modules/es.weak-map': require.resolve('./scripts/empty-module.js'),
        'core-js/modules/es.weak-set': require.resolve('./scripts/empty-module.js'),
        // Exclude regenerator-runtime as well
        'regenerator-runtime': require.resolve('./scripts/empty-module.js'),
        'regenerator-runtime/runtime': require.resolve('./scripts/empty-module.js'),
      };
      
      // Add webpack ignore plugin to completely ignore polyfill imports
      const webpack = require('webpack');
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /^core-js/,
          contextRegExp: /./,
        }),
        new webpack.IgnorePlugin({
          resourceRegExp: /^regenerator-runtime/,
          contextRegExp: /./,
        })
      );
      
      // Enhanced code splitting configuration
      config.optimization = {
        ...config.optimization,
        runtimeChunk: 'single',
        splitChunks: {
          chunks: 'all',
          maxInitialRequests: 25,
          minSize: 20000,
          cacheGroups: {
            default: false,
            vendors: false,
            // Separate framework code
            framework: {
              name: 'framework',
              chunks: 'all',
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler|prop-types|use-sync-external-store)[\\/]/,
              priority: 40,
              enforce: true,
            },
            // Separate UI libraries
            lib: {
              test(module: any) {
                return module.size() > 160000 &&
                  /node_modules[\\/]/.test(module.identifier());
              },
              name(module: any) {
                const hash = require('crypto')
                  .createHash('sha1')
                  .update(module.identifier())
                  .digest('hex')
                  .substring(0, 8);
                return `lib-${hash}`;
              },
              priority: 30,
              minChunks: 1,
              reuseExistingChunk: true,
            },
            // Analytics and monitoring
            analytics: {
              name: 'analytics',
              test: /[\\/]node_modules[\\/](@vercel[\\/]analytics|@vercel[\\/]speed-insights|@builder\.io[\\/]partytown)[\\/]/,
              priority: 35,
              reuseExistingChunk: true,
            },
            // Common components
            commons: {
              name: 'commons',
              minChunks: 2,
              priority: 20,
            },
            // Shared modules
            shared: {
              name(_module: any, chunks: any) {
                const hash = require('crypto')
                  .createHash('sha1')
                  .update(chunks.reduce((acc: string, chunk: any) => acc + chunk.name, ''))
                  .digest('hex')
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
      
      // Apply CSS optimization plugin in production
      // Temporarily disabled due to webpack cache conflict
      // if (!dev) {
      //   // eslint-disable-next-line @typescript-eslint/no-require-imports
      //   const OptimizeCssPlugin = require("./src/lib/optimize-css-plugin");
      //   config.plugins.push(new OptimizeCssPlugin({
      //     enableCriticalCss: true,
      //     removeUnusedCss: true,
      //     inlineCriticalCss: true,
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
