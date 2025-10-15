const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  // Moved from experimental to top-level in Next.js 15
  skipTrailingSlashRedirect: true,
  // Fix workspace root warning by explicitly setting the output file tracing root
  outputFileTracingRoot: path.join(__dirname),
  // Disable static optimization for specific pages
  async headers() {
    return []
  },
  // Image configuration for Next.js 16 compatibility
  images: {
    qualities: [75, 90, 100],
    localPatterns: [
      {
        pathname: '/**',
        search: '',
      },
    ],
  },
  // Phase 2 FCP Optimizations + Lighthouse Performance Optimizations
  experimental: {
    optimizeCss: true, // Enable critical CSS extraction and route-specific CSS splitting
    optimizePackageImports: ['lucide-react', '@radix-ui/react-dialog', '@radix-ui/react-alert-dialog'], // Tree-shake icon and UI imports
  },
  // Remove console logs in production except errors/warnings
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
  // Lighthouse Performance Optimizations
  productionBrowserSourceMaps: false, // Disable source maps in production for smaller bundle size
  // Optimize chunks for better code splitting
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Optimize client-side bundle splitting
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            // Vendor chunk for stable dependencies
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendor',
              priority: 10,
              reuseExistingChunk: true,
            },
            // Separate chunk for Radix UI components
            radix: {
              test: /[\\/]node_modules[\\/]@radix-ui[\\/]/,
              name: 'radix-ui',
              priority: 20,
              reuseExistingChunk: true,
            },
            // Separate chunk for Clerk
            clerk: {
              test: /[\\/]node_modules[\\/]@clerk[\\/]/,
              name: 'clerk',
              priority: 20,
              reuseExistingChunk: true,
            },
            // Common shared components
            commons: {
              minChunks: 2,
              priority: 5,
              reuseExistingChunk: true,
            },
          },
        },
      };
    }
    return config;
  },
}

module.exports = nextConfig