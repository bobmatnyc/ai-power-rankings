/**
 * Startup validation for required environment variables
 * This module ensures critical configuration is present before the application starts
 */

// Define required environment variables with descriptive error messages
const REQUIRED_ENV_VARS = [
  {
    name: "OPENROUTER_API_KEY",
    description: "OpenRouter API key for news analysis",
    documentation: "https://openrouter.ai/keys",
    errorMessage:
      "OpenRouter API key is required for news analysis functionality. Please set OPENROUTER_API_KEY in your .env.local file.",
  },
] as const;

/**
 * Validates that all required environment variables are configured
 * Throws an error at startup if any required variables are missing
 */
export function validateEnvironment(): void {
  console.log("[Startup] Validating environment configuration...");

  const missingVars: string[] = [];
  const errors: string[] = [];

  for (const envVar of REQUIRED_ENV_VARS) {
    const value = process.env[envVar.name];

    if (!value || value.trim() === "") {
      missingVars.push(envVar.name);
      errors.push(`
  ❌ Missing ${envVar.name}
     ${envVar.errorMessage}
     Documentation: ${envVar.documentation}
      `);
    } else {
      // Log successful validation (mask sensitive data)
      const maskedValue = `${value.substring(0, 10)}...${value.substring(value.length - 4)}`;
      console.log(`[Startup] ✓ ${envVar.name} configured (${maskedValue})`);
    }
  }

  if (missingVars.length > 0) {
    const errorTitle = `
================================================================================
🚨 STARTUP VALIDATION FAILED
================================================================================

The application cannot start because required environment variables are missing.
`;

    const errorFooter = `
================================================================================
To fix this issue:

1. Create or update your .env.local file in the project root
2. Add the missing environment variables:

   # .env.local
   OPENROUTER_API_KEY=your_api_key_here

3. Get your OpenRouter API key from: https://openrouter.ai/keys
4. Restart the application

For more information, see the documentation:
- OpenRouter Setup: https://openrouter.ai/docs
================================================================================
`;

    const fullError = errorTitle + errors.join("\n") + errorFooter;

    console.error(fullError);

    // Throw error to prevent application startup
    throw new Error(
      `Application startup failed: Missing required environment variables: ${missingVars.join(", ")}`
    );
  }

  console.log("[Startup] ✅ All required environment variables are configured");
}

/**
 * Check if OpenRouter API is configured (non-throwing version)
 * Useful for conditional feature availability
 */
export function isOpenRouterConfigured(): boolean {
  const apiKey = process.env["OPENROUTER_API_KEY"];
  return Boolean(apiKey && apiKey.trim() !== "");
}

/**
 * Get OpenRouter API key with validation
 * Throws if not configured
 */
export function getOpenRouterApiKey(): string {
  const apiKey = process.env["OPENROUTER_API_KEY"];

  if (!apiKey || apiKey.trim() === "") {
    throw new Error(
      "OpenRouter API key is not configured. Please set OPENROUTER_API_KEY in your .env.local file. Get your key at: https://openrouter.ai/keys"
    );
  }

  return apiKey;
}

// Run validation immediately when this module is imported in production
// This ensures the app fails fast if misconfigured
if (process.env["NODE_ENV"] === "production") {
  try {
    validateEnvironment();
  } catch (error) {
    console.error("[Startup] Fatal error during environment validation:", error);

    // Check if we're in Edge Runtime (like middleware) where process.exit is not available
    // Edge Runtime detection: check for absence of Node.js specific globals
    const isEdgeRuntime =
      typeof process === "undefined" ||
      typeof process.exit !== "function" ||
      (globalThis as any).EdgeRuntime !== undefined;

    if (isEdgeRuntime) {
      console.error(
        "[Startup] Running in Edge Runtime, throwing error instead of calling process.exit"
      );
      throw error;
    }

    // In Node.js runtime, we can safely call process.exit
    // Use dynamic reference to avoid webpack static analysis warnings
    const nodeProcess = globalThis.process as any;
    if (nodeProcess && typeof nodeProcess.exit === "function") {
      nodeProcess.exit(1);
    } else {
      throw error;
    }
  }
}
