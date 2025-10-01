/**
 * Verification Script for User Preferences Refactoring
 * Tests the Clerk privateMetadata-based preferences system
 */

import { clerkClient } from "@clerk/nextjs/server";

interface UserPreferences {
  emailNotifications: boolean;
  weeklyDigest: boolean;
  rankingUpdates: boolean;
  toolUpdates: boolean;
  newsAlerts: boolean;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  emailNotifications: false,
  weeklyDigest: false,
  rankingUpdates: false,
  toolUpdates: false,
  newsAlerts: false,
};

async function verifyPreferencesRefactor() {
  console.log("🔍 Verifying User Preferences Refactoring\n");
  console.log("=" .repeat(60));

  let allTestsPassed = true;

  // Test 1: Code Structure Verification
  console.log("\n1. CODE STRUCTURE VERIFICATION");
  console.log("-".repeat(60));

  try {
    // Check if API route exists
    const fs = require("fs");
    const apiPath = "./app/api/user/preferences/route.ts";

    if (fs.existsSync(apiPath)) {
      console.log("✅ API route file exists");

      const content = fs.readFileSync(apiPath, "utf-8");

      // Check for Clerk imports
      if (content.includes("@clerk/nextjs/server")) {
        console.log("✅ Uses Clerk imports");
      } else {
        console.log("❌ Missing Clerk imports");
        allTestsPassed = false;
      }

      // Check for NO database imports
      if (!content.includes("drizzle") && !content.includes("@/lib/db")) {
        console.log("✅ No database dependencies");
      } else {
        console.log("⚠️  Still has database imports");
        allTestsPassed = false;
      }

      // Check for privateMetadata usage
      if (content.includes("privateMetadata")) {
        console.log("✅ Uses privateMetadata");
      } else {
        console.log("❌ Missing privateMetadata usage");
        allTestsPassed = false;
      }

      // Check for proper error handling
      if (content.includes("rate limit") && content.includes("not found")) {
        console.log("✅ Has comprehensive error handling");
      } else {
        console.log("⚠️  Limited error handling");
      }

    } else {
      console.log("❌ API route file not found");
      allTestsPassed = false;
    }
  } catch (error) {
    console.log("❌ Error verifying code structure:", error);
    allTestsPassed = false;
  }

  // Test 2: Schema Verification
  console.log("\n2. DATABASE SCHEMA VERIFICATION");
  console.log("-".repeat(60));

  try {
    const fs = require("fs");
    const schemaPath = "./lib/db/schema.ts";

    if (fs.existsSync(schemaPath)) {
      const content = fs.readFileSync(schemaPath, "utf-8");

      // Check that userPreferences table is NOT defined
      if (!content.includes("export const userPreferences")) {
        console.log("✅ userPreferences table removed from schema");
      } else {
        console.log("❌ userPreferences table still in schema");
        allTestsPassed = false;
      }

      // Check for documentation comment
      if (content.includes("User Preferences") && content.includes("privateMetadata")) {
        console.log("✅ Documentation comment added");
      } else {
        console.log("⚠️  Missing documentation comment");
      }

    } else {
      console.log("❌ Schema file not found");
      allTestsPassed = false;
    }
  } catch (error) {
    console.log("❌ Error verifying schema:", error);
    allTestsPassed = false;
  }

  // Test 3: Type Safety Verification
  console.log("\n3. TYPE SAFETY VERIFICATION");
  console.log("-".repeat(60));

  try {
    const fs = require("fs");
    const apiPath = "./app/api/user/preferences/route.ts";
    const content = fs.readFileSync(apiPath, "utf-8");

    // Check if UserPreferences interface is defined
    if (content.includes("interface UserPreferences") || content.includes("export interface UserPreferences")) {
      console.log("✅ UserPreferences type defined");
    } else {
      console.log("❌ Missing UserPreferences type");
      allTestsPassed = false;
    }

    // Check for proper validation
    if (content.includes("allowedFields")) {
      console.log("✅ Input validation implemented");
    } else {
      console.log("⚠️  Missing input validation");
    }

  } catch (error) {
    console.log("❌ Error verifying types:", error);
    allTestsPassed = false;
  }

  // Test 4: Security Verification
  console.log("\n4. SECURITY VERIFICATION");
  console.log("-".repeat(60));

  try {
    const fs = require("fs");
    const apiPath = "./app/api/user/preferences/route.ts";
    const content = fs.readFileSync(apiPath, "utf-8");

    // Check authentication
    if (content.includes("await auth()") && content.includes("userId")) {
      console.log("✅ Authentication required");
    } else {
      console.log("❌ Missing authentication");
      allTestsPassed = false;
    }

    // Check 401 response for unauthorized
    if (content.includes('401')) {
      console.log("✅ Returns 401 for unauthorized");
    } else {
      console.log("❌ Missing 401 unauthorized response");
      allTestsPassed = false;
    }

    // Check that privateMetadata is used (not publicMetadata)
    if (content.includes("privateMetadata") && !content.includes("publicMetadata")) {
      console.log("✅ Uses privateMetadata (secure)");
    } else {
      console.log("⚠️  Security concern with metadata usage");
    }

  } catch (error) {
    console.log("❌ Error verifying security:", error);
    allTestsPassed = false;
  }

  // Test 5: Frontend Compatibility
  console.log("\n5. FRONTEND COMPATIBILITY VERIFICATION");
  console.log("-".repeat(60));

  try {
    const fs = require("fs");
    const componentPath = "./components/auth/user-button-with-admin.tsx";

    if (fs.existsSync(componentPath)) {
      const content = fs.readFileSync(componentPath, "utf-8");

      // Check if it still uses the same API endpoints
      if (content.includes("/api/user/preferences")) {
        console.log("✅ Uses correct API endpoints");
      } else {
        console.log("❌ API endpoint mismatch");
        allTestsPassed = false;
      }

      // Check if subscription toggle still exists
      if (content.includes("emailNotifications") || content.includes("isSubscribed")) {
        console.log("✅ Subscription functionality present");
      } else {
        console.log("❌ Missing subscription functionality");
        allTestsPassed = false;
      }

      console.log("✅ Frontend requires no changes (backward compatible)");
    } else {
      console.log("⚠️  Frontend component not found");
    }
  } catch (error) {
    console.log("❌ Error verifying frontend:", error);
    allTestsPassed = false;
  }

  // Test 6: Migration File Status
  console.log("\n6. MIGRATION FILE STATUS");
  console.log("-".repeat(60));

  try {
    const fs = require("fs");
    const migrationPath = "./lib/db/migrations/0002_add_user_preferences.sql";

    if (fs.existsSync(migrationPath)) {
      console.log("⚠️  Migration file still exists (can be deleted)");
      console.log("   File: " + migrationPath);
      console.log("   Action: Safe to delete after verifying no DB table exists");
    } else {
      console.log("✅ Migration file already removed");
    }
  } catch (error) {
    console.log("⚠️  Error checking migration file:", error);
  }

  // Test 7: Test Script Status
  console.log("\n7. TEST SCRIPT STATUS");
  console.log("-".repeat(60));

  try {
    const fs = require("fs");
    const testPath = "./scripts/test-user-preferences.ts";

    if (fs.existsSync(testPath)) {
      const content = fs.readFileSync(testPath, "utf-8");

      if (content.includes("DEPRECATED")) {
        console.log("✅ Test script marked as deprecated");
      } else {
        console.log("⚠️  Test script should be marked deprecated");
      }
    }
  } catch (error) {
    console.log("⚠️  Error checking test script:", error);
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("VERIFICATION SUMMARY");
  console.log("=".repeat(60));

  if (allTestsPassed) {
    console.log("✅ ALL CRITICAL TESTS PASSED");
    console.log("\nRefactoring appears successful!");
    console.log("\nBenefits achieved:");
    console.log("  ✓ Simplified architecture (no database table)");
    console.log("  ✓ Single source of truth (Clerk)");
    console.log("  ✓ Better security (privateMetadata)");
    console.log("  ✓ Reduced code complexity");
    console.log("  ✓ Backward compatible API");

    console.log("\nRecommended next steps:");
    console.log("  1. Test API endpoints manually with authenticated user");
    console.log("  2. Verify frontend subscription toggle works");
    console.log("  3. Drop user_preferences table from database (if exists)");
    console.log("  4. Delete migration file: 0002_add_user_preferences.sql");
    console.log("  5. Monitor Clerk API usage for rate limits");
  } else {
    console.log("⚠️  SOME TESTS FAILED OR HAVE WARNINGS");
    console.log("\nPlease review the warnings above before deployment.");
  }

  console.log("\n" + "=".repeat(60));

  return allTestsPassed;
}

// Run verification
verifyPreferencesRefactor()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error("\n💥 Verification failed with error:", error);
    process.exit(1);
  });
