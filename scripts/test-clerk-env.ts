#!/usr/bin/env tsx

/**
 * Test script to verify Clerk environment variables
 * Run with: pnpm tsx scripts/test-clerk-env.ts
 */

console.log("🔍 Checking Clerk Environment Variables...\n");

// Check required variables
const requiredVars = ["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY"];

const optionalVars = [
  "NEXT_PUBLIC_CLERK_SIGN_IN_URL",
  "NEXT_PUBLIC_CLERK_SIGN_UP_URL",
  "NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL",
  "NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL",
];

console.log("📋 Required Variables:");
console.log("=".repeat(50));

let hasErrors = false;

for (const varName of requiredVars) {
  const value = process.env[varName];
  if (!value) {
    console.log(`❌ ${varName}: NOT SET`);
    hasErrors = true;
  } else {
    // Check for common issues
    const issues = [];

    if (value.includes("\\n")) {
      issues.push("contains \\n characters");
    }

    if (value.endsWith("\n")) {
      issues.push("has trailing newline");
    }

    if (varName === "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY") {
      if (!value.startsWith("pk_")) {
        issues.push("should start with pk_");
      }
      if (value.startsWith("pk_test_")) {
        issues.push("using TEST key (should be pk_live_ for production)");
      }
    }

    if (varName === "CLERK_SECRET_KEY") {
      if (!value.startsWith("sk_")) {
        issues.push("should start with sk_");
      }
      if (value.startsWith("sk_test_")) {
        issues.push("using TEST key (should be sk_live_ for production)");
      }
    }

    if (issues.length > 0) {
      console.log(`⚠️  ${varName}: SET but has issues: ${issues.join(", ")}`);
      console.log(`   Value: "${value.substring(0, 20)}..."`);
    } else {
      const prefix = value.substring(0, 10);
      console.log(`✅ ${varName}: ${prefix}...`);
    }
  }
}

console.log("\n📋 Optional Variables:");
console.log("=".repeat(50));

for (const varName of optionalVars) {
  const value = process.env[varName];
  if (!value) {
    console.log(`⚪ ${varName}: not set (optional)`);
  } else {
    console.log(`✅ ${varName}: ${value}`);
  }
}

console.log("\n🔍 Environment Check:");
console.log("=".repeat(50));
console.log(`NODE_ENV: ${process.env.NODE_ENV || "not set"}`);
console.log(`VERCEL_ENV: ${process.env.VERCEL_ENV || "not set (local)"}`);

// Check for auth disable flag
if (process.env.NEXT_PUBLIC_DISABLE_AUTH === "true") {
  console.log("\n⚠️  WARNING: NEXT_PUBLIC_DISABLE_AUTH is set to 'true'");
  console.log("   This disables Clerk authentication entirely!");
}

console.log("\n📝 Vercel Configuration Instructions:");
console.log("=".repeat(50));
console.log(
  "1. Go to: https://vercel.com/bobmatnyc/ai-power-rankings/settings/environment-variables"
);
console.log("2. Ensure these variables are set for 'Production' environment:");
console.log("   - NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY (without \\n)");
console.log("   - CLERK_SECRET_KEY (without \\n)");
console.log("3. After updating, redeploy from Vercel dashboard");

if (hasErrors) {
  console.log("\n❌ Errors found in Clerk configuration!");
  process.exit(1);
} else {
  console.log("\n✅ Clerk environment variables look good!");
}
