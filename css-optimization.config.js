/**
 * CSS Optimization Configuration
 *
 * WHY: Centralized configuration for CSS optimization strategies to reduce
 * unused styles and improve performance metrics.
 *
 * DESIGN DECISION: Separate configuration file allows for easy adjustment
 * of optimization strategies without modifying core config files.
 */

module.exports = {
  // PurgeCSS specific patterns for AI Power Rankings
  purgePatterns: {
    // Component-specific patterns
    components: [
      // Rankings table classes
      /^ranking-/,
      /^rank-/,
      /^score-/,
      /^metric-/,

      // Tool card classes
      /^tool-/,
      /^feature-/,
      /^capability-/,

      // News article classes
      /^article-/,
      /^news-/,
      /^publication-/,

      // Chart and visualization classes
      /^chart-/,
      /^graph-/,
      /^visualization-/,
    ],

    // Dynamic class patterns that might be generated at runtime
    dynamic: [
      // Dynamic ranking positions
      /^(top|rank)-(1|2|3|4|5|10|20|50)$/,

      // Dynamic score colors
      /^score-(high|medium|low|excellent|good|fair|poor)$/,

      // Dynamic tool categories
      /^category-(ide|editor|assistant|agent|completion)$/,

      // Dynamic language tags
      /^lang-(en|ja|zh|es|fr|de|ko|pt)$/,
    ],

    // State-based patterns
    states: [
      // Loading states
      /^(is|has)-(loading|loaded|error|success)$/,

      // Interactive states
      /^(is|has)-(active|selected|expanded|collapsed)$/,

      // Visibility states
      /^(is|has)-(visible|hidden|shown|concealed)$/,
    ],
  },

  // Critical CSS extraction patterns
  criticalPatterns: {
    // Above-the-fold selectors
    selectors: [
      "body",
      "html",
      ".hero-section",
      ".stats-grid",
      ".main-header",
      ".primary-navigation",
      ".ranking-header",
      ".top-tools-preview",
    ],

    // Critical utility classes
    utilities: [
      // Layout
      "container",
      "grid",
      "flex",
      "block",
      "inline-block",

      // Spacing
      "p-0",
      "p-1",
      "p-2",
      "p-3",
      "p-4",
      "p-6",
      "p-8",
      "m-0",
      "m-1",
      "m-2",
      "m-3",
      "m-4",
      "m-6",
      "m-8",

      // Typography
      "text-xs",
      "text-sm",
      "text-base",
      "text-lg",
      "text-xl",
      "text-2xl",
      "text-3xl",
      "text-4xl",
      "font-normal",
      "font-medium",
      "font-semibold",
      "font-bold",

      // Colors
      "text-primary",
      "bg-primary",
      "border-primary",
      "text-secondary",
      "bg-secondary",
      "border-secondary",

      // Common responsive modifiers
      "sm:hidden",
      "md:block",
      "lg:grid",
      "xl:flex",
    ],
  },

  // CSS minification options
  minification: {
    // Remove all comments in production
    removeComments: true,

    // Merge duplicate rules
    mergeDuplicates: true,

    // Optimize calc() expressions
    optimizeCalc: true,

    // Convert colors to shortest representation
    colorOptimization: true,

    // Remove unused @keyframes
    removeUnusedKeyframes: true,

    // Merge media queries
    mergeMediaQueries: true,
  },

  // Performance targets
  targets: {
    // Maximum CSS bundle size (in KB)
    maxBundleSize: 20,

    // Maximum unused CSS percentage
    maxUnusedPercentage: 20,

    // Critical CSS size limit (in KB)
    criticalCssLimit: 14,
  },
};
