/**
 * PostCSS Configuration with Production CSS Optimization
 *
 * WHY: Provides basic CSS optimization for Next.js 15.3.3 compatibility.
 * PurgeCSS and advanced optimization will be handled through Tailwind configuration
 * to avoid PostCSS plugin loading conflicts in Next.js.
 *
 * DESIGN DECISION: Use minimal PostCSS config and rely on Tailwind's built-in purging
 * and Next.js built-in CSS optimization for better compatibility.
 */

module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {
      // Target modern browsers to reduce vendor prefixes
      overrideBrowserslist: [
        "Chrome >= 95",
        "Firefox >= 95",
        "Safari >= 15.4",
        "Edge >= 95",
        "not dead",
      ],
    },
  },
};
