const isProduction = process.env.NODE_ENV === "production";
const cssOptimizationConfig = require("./css-optimization.config");

module.exports = {
  plugins: [
    "tailwindcss",
    [
      "autoprefixer",
      {
        // Use the same browserslist configuration as package.json
        // This ensures autoprefixer targets only modern browsers
        overrideBrowserslist: [
          "Chrome >= 95",
          "Firefox >= 95",
          "Safari >= 15.4",
          "Edge >= 95",
          "not dead",
        ],
      },
    ],
    // Only apply PurgeCSS and cssnano in production builds
    ...(isProduction
      ? [
          [
            "@fullhuman/postcss-purgecss",
            {
              content: [
                "./src/**/*.{js,jsx,ts,tsx}",
                "./src/app/**/*.{js,jsx,ts,tsx}",
                "./src/components/**/*.{js,jsx,ts,tsx}",
                "./src/lib/**/*.{js,jsx,ts,tsx}",
              ],
              // Default extractor for Tailwind CSS
              defaultExtractor: (content) => {
                // Capture as liberally as possible, including things like `h-(screen-1.5)`
                const broadMatches = content.match(/[^<>"'`\s]*[^<>"'`\s:]/g) || [];

                // Capture classes within quotes for dynamic class names
                const innerMatches = content.match(/[^<>"'`\s.()]*[^<>"'`\s.():]/g) || [];

                return broadMatches.concat(innerMatches);
              },
              // Safelist patterns to prevent removal of dynamically generated classes
              safelist: {
                standard: [
                  // Preserve all CSS variables and custom properties
                  /^--/,
                  // Preserve dark mode classes
                  /^dark:/,
                  // Preserve responsive variants
                  /^(sm|md|lg|xl|2xl):/,
                  // Preserve state variants
                  /^(hover|focus|active|disabled|group-hover):/,
                  // Animation classes
                  /^animate-/,
                  // Gradient utilities
                  /^gradient-/,
                  // Text gradient
                  /^text-gradient/,
                  // Add patterns from optimization config
                  ...cssOptimizationConfig.purgePatterns.components,
                  ...cssOptimizationConfig.purgePatterns.dynamic,
                  ...cssOptimizationConfig.purgePatterns.states,
                ],
                deep: [
                  // Preserve Radix UI classes
                  /radix/,
                  // Preserve sidebar classes
                  /sidebar/,
                ],
                greedy: [
                  // Preserve color classes that might be generated dynamically
                  /^bg-/,
                  /^text-/,
                  /^border-/,
                  /^ring-/,
                ],
              },
              // Remove unused keyframes
              keyframes: true,
              // Remove unused font faces
              fontFace: true,
            },
          ],
          [
            "cssnano",
            {
              preset: [
                "default",
                {
                  // Optimize CSS for production
                  discardComments: {
                    removeAll: true,
                  },
                  // Merge media queries
                  mergeRules: true,
                  // Optimize calc() expressions
                  calc: true,
                  // Minimize z-index values
                  zindex: true,
                  // Don't discard unused @keyframes in case they're used dynamically
                  discardUnused: {
                    keyframes: false,
                  },
                },
              ],
            },
          ],
        ]
      : []),
  ],
};
