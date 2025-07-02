module.exports = {
  plugins: {
    'tailwindcss': {},
    'autoprefixer': {},
    ...(process.env.NODE_ENV === 'production' && {
      '@fullhuman/postcss-purgecss': {
        content: [
          './src/pages/**/*.{js,ts,jsx,tsx}',
          './src/components/**/*.{js,ts,jsx,tsx}',
          './src/app/**/*.{js,ts,jsx,tsx}',
          './src/lib/**/*.{js,ts,jsx,tsx}',
        ],
        defaultExtractor: content => {
          // Capture as many selectors as possible
          const broadMatches = content.match(/[^<>"'`\s]*[^<>"'`\s:]/g) || [];
          
          // Capture classes and ids more specifically
          const innerMatches = content.match(/[^<>"'`\s.()]*[^<>"'`\s.():]/g) || [];
          
          return broadMatches.concat(innerMatches);
        },
        safelist: [
          // Always keep these critical classes
          'html', 'body', 'root',
          
          // Dynamic classes that might not be detected
          /^text-/, /^bg-/, /^border-/, /^hover:/, /^focus:/, /^active:/,
          /^md:/, /^lg:/, /^xl:/, /^sm:/, /^2xl:/,
          /^dark:/, /^light:/,
          
          // Lucide icon classes
          /^lucide/, /^lucide-/,
          
          // Custom gradient classes
          'gradient-primary', 'text-gradient',
          
          // Animation classes
          /^animate-/, /^transition-/, /^duration-/, /^ease-/,
          
          // Grid and flex utilities
          /^grid/, /^flex/, /^gap-/,
          
          // Spacing utilities that are commonly used
          /^p-/, /^m-/, /^px-/, /^py-/, /^mx-/, /^my-/,
          /^pt-/, /^pb-/, /^pl-/, /^pr-/, /^mt-/, /^mb-/, /^ml-/, /^mr-/,
          
          // Common component classes
          'card', 'card-header', 'card-content', 'card-title',
          'button', 'badge', 'input', 'label',
          'dropdown', 'menu', 'tooltip',
          
          // State classes
          'loading', 'error', 'success', 'warning',
          'disabled', 'active', 'inactive',
          
          // Specific to our app
          'rankings-table', 'tool-card', 'news-item',
          'hero-section', 'stats-grid',
        ],
        // Remove unused CSS but keep critical selectors
        rejected: process.env.NODE_ENV === 'development',
      },
      'cssnano': {
        preset: ['default', {
          discardComments: {
            removeAll: true,
          },
          normalizeWhitespace: true,
          colormin: true,
          convertValues: true,
          discardDuplicates: true,
          discardEmpty: true,
          mergeIdents: true,
          mergeLonghand: true,
          mergeRules: true,
          minifyFontValues: true,
          minifyGradients: true,
          minifyParams: true,
          minifySelectors: true,
          normalizeCharset: true,
          normalizeDisplayValues: true,
          normalizePositions: true,
          normalizeRepeatStyle: true,
          normalizeString: true,
          normalizeTimingFunctions: true,
          normalizeUnicode: true,
          normalizeUrl: true,
          orderedValues: true,
          reduceIdents: true,
          reduceInitial: true,
          reduceTransforms: true,
          svgo: true,
          uniqueSelectors: true,
        }],
      },
    }),
  },
}
