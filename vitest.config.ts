import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "src/test/",
        "**/*.d.ts",
        "**/*.config.*",
        "scripts/",
        "data/",
        "docs/",
        "public/",
        ".next/",
      ],
    },
    // Test timeout
    testTimeout: 10000,
    // Exclude specific patterns
    exclude: [
      "node_modules",
      "dist",
      ".next",
      "data",
      "docs",
      "public",
      "scripts",
      "**/*.config.*",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Define environment variables for tests
  define: {
    "process.env.NODE_ENV": '"test"',
  },
});
