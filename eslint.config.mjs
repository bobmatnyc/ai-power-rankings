import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "public/**",
      ".vercel/**",
      "*.config.js",
      "*.config.mjs",
      "*.config.ts",
      "next-env.d.ts",
      "data/**",
      "src/app/api/mcp/**",
    ],
    rules: {
      // TypeScript rules - more lenient for production
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { 
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_"
      }],
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-non-null-assertion": "warn",
      
      // React/Next.js rules
      "react/no-unescaped-entities": "error",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
      "@next/next/no-img-element": "off",
      
      // General code quality
      "no-console": "off",
      "no-debugger": "error",
      "no-alert": "error",
      "prefer-const": "error",
      "no-var": "error",
      "eqeqeq": ["error", "always"],
      "curly": ["error", "all"],
      
      // Async/Promise rules
      "no-async-promise-executor": "error",
      "prefer-promise-reject-errors": "error",
    },
  },
];

export default eslintConfig;
