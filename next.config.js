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
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-dialog',
      '@radix-ui/react-alert-dialog',
      '@radix-ui/react-tabs',
      '@radix-ui/react-tooltip',
      '@radix-ui/react-select',
    ],
  },

  // Better tree-shaking for icon libraries
  modularizeImports: {
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{kebabCase member}}',
    },
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
          maxInitialRequests: 25,
          minSize: 20000,
          cacheGroups: {
            // Split Clerk into smaller chunks
            clerkCore: {
              test: /[\\/]node_modules[\\/]@clerk[\\/]clerk-js[\\/]/,
              name: 'clerk-core',
              priority: 30,
              reuseExistingChunk: true,
            },
            clerkReact: {
              test: /[\\/]node_modules[\\/]@clerk[\\/](clerk-react|nextjs)[\\/]/,
              name: 'clerk-react',
              priority: 25,
              reuseExistingChunk: true,
            },
            // Separate chunk for Radix UI components
            radix: {
              test: /[\\/]node_modules[\\/]@radix-ui[\\/]/,
              name: 'radix-ui',
              priority: 20,
              reuseExistingChunk: true,
            },
            // Split large vendor dependencies
            reactVendor: {
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              name: 'react-vendor',
              priority: 15,
              reuseExistingChunk: true,
            },
            // Other vendors
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name(module) {
                // Get the package name
                const match = module.context && module.context.match(/[\\/]node_modules[\\/](.*?)([\\/]|$)/);
                if (match && match[1]) {
                  const packageName = match[1];
                  // npm package names are URL-safe, but some servers don't like @ symbols
                  return `vendor.${packageName.replace('@', '')}`;
                }
                return 'vendor';
              },
              priority: 10,
              reuseExistingChunk: true,
              minChunks: 1,
            },
            // Common shared components
            commons: {
              minChunks: 2,
              priority: 5,
              reuseExistingChunk: true,
            },
          },
        },
        // Enable module concatenation for smaller bundles
        concatenateModules: true,
        // Minimize runtime chunk
        runtimeChunk: { name: 'runtime' },
      };
    }
    return config;
  },
}

module.exports = nextConfig