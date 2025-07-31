// Simplified PostCSS configuration to focus on polyfill issues first
// CSS optimization temporarily disabled until PostCSS loading issue is resolved

module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {
      // Target modern browsers only to reduce polyfills and CSS vendor prefixes
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
