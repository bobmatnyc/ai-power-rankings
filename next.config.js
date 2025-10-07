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
}

module.exports = nextConfig