#!/usr/bin/env tsx

/**
 * Debug Clerk admin authentication issue
 * Run with: pnpm tsx scripts/debug-clerk-admin.ts
 */

console.log("🔍 Debugging Clerk Admin Authentication...\n");
console.log("=".repeat(60));
console.log("IMPORTANT: The user needs admin permissions in Clerk");
console.log("=".repeat(60));

console.log("\n📋 Steps to Fix the Issue:\n");

console.log("1️⃣  **Go to Clerk Dashboard**");
console.log("   https://dashboard.clerk.com");
console.log("   - Select your production app (uses pk_live_ keys)");
console.log("");

console.log("2️⃣  **Find Your User Account**");
console.log("   - Go to 'Users' in the left sidebar");
console.log("   - Search for your email address");
console.log("   - Click on your user profile");
console.log("");

console.log("3️⃣  **Add Admin Metadata**");
console.log("   - Scroll down to 'Public metadata'");
console.log("   - Click 'Edit'");
console.log("   - Add this JSON:");
console.log("   ```json");
console.log("   {");
console.log('     "isAdmin": true');
console.log("   }");
console.log("   ```");
console.log("   - Save the changes");
console.log("");

console.log("4️⃣  **Sign Out and Sign In Again**");
console.log("   - Go to https://aipowerranking.com/admin");
console.log("   - Sign out completely");
console.log("   - Sign in again with your account");
console.log("");

console.log("=".repeat(60));
console.log("Why This Is Happening:");
console.log("=".repeat(60));
console.log("");
console.log("The middleware is now correctly checking for admin permissions.");
console.log("Your user account needs the 'isAdmin: true' flag in Clerk's");
console.log("public metadata to access admin API endpoints.");
console.log("");
console.log("The code checks: user?.publicMetadata?.isAdmin === true");
console.log("");

console.log("=".repeat(60));
console.log("Alternative: Disable Auth Temporarily (Development Only)");
console.log("=".repeat(60));
console.log("");
console.log("For local development, you can set:");
console.log("NEXT_PUBLIC_DISABLE_AUTH=true");
console.log("");
console.log("⚠️  WARNING: Never use this in production!");
console.log("");

console.log("=".repeat(60));
console.log("Current Environment:");
console.log("=".repeat(60));
console.log(`NODE_ENV: ${process.env.NODE_ENV || "not set"}`);
console.log(`Auth Disabled: ${process.env.NEXT_PUBLIC_DISABLE_AUTH === "true" ? "Yes" : "No"}`);
console.log(`Clerk Key Present: ${!!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}`);
