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
  // Phase 2 FCP Optimizations
  experimental: {
    optimizeCss: true, // Enable critical CSS extraction and route-specific CSS splitting
    optimizePackageImports: ['lucide-react'], // Tree-shake icon imports
  },
  // Remove console logs in production except errors/warnings
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
}

module.exports = nextConfig