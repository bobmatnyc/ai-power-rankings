/**
 * Startup validation for required environment variables
 * This module ensures critical configuration is present before the application starts
 */

// Define optional environment variables with descriptive messages
// These are not required for the app to start, but enable specific features
const OPTIONAL_ENV_VARS = [
  {
    name: "OPENROUTER_API_KEY",
    description: "OpenRouter API key for news analysis",
    documentation: "https://openrouter.ai/keys",
    warningMessage:
      "OpenRouter API key is not configured. News analysis features will be disabled. Set OPENROUTER_API_KEY in your .env.local file to enable.",
  },
] as const;

// Define truly required environment variables (currently none - all are optional)
const REQUIRED_ENV_VARS: Array<{
  name: string;
  description: string;
  documentation: string;
  errorMessage: string;
}> = [];

/**
 * Validates that all required environment variables are configured
 * Logs warnings for optional environment variables that enable features
 */
export function validateEnvironment(): void {
  // Skip validation in Edge Runtime environments (like middleware)
  if (typeof process === "undefined" || typeof process.env === "undefined") {
    return;
  }

  console.log("[Startup] Validating environment configuration...");

  const missingVars: string[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required environment variables (currently none)
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

  // Check optional environment variables and log warnings
  for (const envVar of OPTIONAL_ENV_VARS) {
    const value = process.env[envVar.name];

    if (!value || value.trim() === "") {
      warnings.push(`
  ⚠️  Optional: ${envVar.name}
     ${envVar.warningMessage}
      `);
      console.log(`[Startup] ⚠️  ${envVar.name} not configured (optional - some features disabled)`);
    } else {
      // Log successful validation (mask sensitive data)
      const maskedValue = `${value.substring(0, 10)}...${value.substring(value.length - 4)}`;
      console.log(`[Startup] ✓ ${envVar.name} configured (${maskedValue})`);
    }
  }

  // Only throw error if required variables are missing
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
2. Add the missing environment variables
3. Restart the application
================================================================================
`;

    const fullError = errorTitle + errors.join("\n") + errorFooter;

    console.error(fullError);

    // Throw error to prevent application startup
    throw new Error(
      `Application startup failed: Missing required environment variables: ${missingVars.join(", ")}`
    );
  }

  // Log warnings for optional variables (but don't throw error)
  if (warnings.length > 0) {
    console.log(`
================================================================================
⚠️  OPTIONAL FEATURES DISABLED
================================================================================
${warnings.join("\n")}
================================================================================
`);
  }

  console.log("[Startup] ✅ Environment validation complete");
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

// Run validation in development mode for immediate feedback
// In production, validation happens lazily when features are accessed
// This prevents startup failures from optional environment variables
if (process.env["NODE_ENV"] === "development") {
  try {
    // Check if we're in Edge Runtime (like middleware)
    const isEdgeRuntime =
      typeof process === "undefined" ||
      typeof process.env === "undefined" ||
      (globalThis as any).EdgeRuntime !== undefined;

    // Only validate in Node.js runtime, not Edge Runtime
    if (!isEdgeRuntime) {
      validateEnvironment();
    }
  } catch (error) {
    console.error("[Startup] Error during environment validation:", error);
    // In development, log but don't exit so developers can still work
  }
}
