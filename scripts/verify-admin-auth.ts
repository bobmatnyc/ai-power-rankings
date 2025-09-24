#!/usr/bin/env tsx

/**
 * Script to verify and configure admin authentication
 *
 * This script helps diagnose and fix authentication issues:
 * 1. Checks if Clerk environment variables are configured
 * 2. Tests authentication flow
 * 3. Verifies admin permissions
 * 4. Provides instructions to grant admin access
 *
 * Usage:
 *   pnpm tsx scripts/verify-admin-auth.ts
 */

import { resolve } from "node:path";
import { clerkClient } from "@clerk/nextjs/server";
import { config } from "dotenv";

// Load environment variables
config({ path: resolve(process.cwd(), ".env.local") });

const CLERK_SECRET_KEY = process.env["CLERK_SECRET_KEY"];
const NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"];
const NEXT_PUBLIC_DISABLE_AUTH = process.env["NEXT_PUBLIC_DISABLE_AUTH"];

async function verifyAdminAuth() {
  console.log("🔍 Verifying Admin Authentication Configuration\n");
  console.log("=".repeat(60));

  // Step 1: Check environment variables
  console.log("\n1️⃣  Checking Environment Variables:");
  console.log("-".repeat(40));

  if (NEXT_PUBLIC_DISABLE_AUTH === "true") {
    console.log("✅ Authentication is DISABLED (NEXT_PUBLIC_DISABLE_AUTH=true)");
    console.log("   You can access admin features without authentication in development mode.");
    return;
  }

  const hasPublishableKey = !!NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const hasSecretKey = !!CLERK_SECRET_KEY;

  console.log(`Clerk Publishable Key: ${hasPublishableKey ? "✅ Found" : "❌ Missing"}`);
  console.log(`Clerk Secret Key: ${hasSecretKey ? "✅ Found" : "❌ Missing"}`);

  if (!hasPublishableKey || !hasSecretKey) {
    console.error("\n❌ Missing Clerk configuration!");
    console.log("\n📝 To fix this:");
    console.log("1. Go to https://dashboard.clerk.com");
    console.log("2. Select your application");
    console.log("3. Go to 'API Keys' section");
    console.log("4. Copy the keys and add them to your .env.local file:");
    console.log("\n   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_publishable_key");
    console.log("   CLERK_SECRET_KEY=your_secret_key");
    console.log("\nAlternatively, for local development, you can disable auth:");
    console.log("   NEXT_PUBLIC_DISABLE_AUTH=true");
    process.exit(1);
  }

  // Step 2: Test Clerk connection
  console.log("\n2️⃣  Testing Clerk Connection:");
  console.log("-".repeat(40));

  try {
    const client = clerkClient({ secretKey: CLERK_SECRET_KEY });
    const userList = await client.users.getUserList({ limit: 1 });
    console.log("✅ Successfully connected to Clerk");
    console.log(`   Found ${userList.totalCount} total users in your application`);
  } catch (error) {
    console.error("❌ Failed to connect to Clerk:");
    console.error(`   ${error instanceof Error ? error.message : "Unknown error"}`);
    console.log("\n📝 Please verify:");
    console.log("1. Your Clerk keys are correct");
    console.log("2. Your Clerk application is active");
    console.log("3. You have internet connectivity");
    process.exit(1);
  }

  // Step 3: Get user email to check
  console.log("\n3️⃣  Checking Admin Users:");
  console.log("-".repeat(40));

  const userEmail = process.argv[2];
  if (!userEmail) {
    console.log("\n📝 To check a specific user's admin status:");
    console.log("   pnpm tsx scripts/verify-admin-auth.ts your.email@example.com");
    console.log("\nListing all admin users instead...\n");

    try {
      const client = clerkClient({ secretKey: CLERK_SECRET_KEY });
      const users = await client.users.getUserList({ limit: 100 });
      const adminUsers = users.data.filter((user) => user.publicMetadata?.isAdmin === true);

      if (adminUsers.length === 0) {
        console.log("⚠️  No admin users found!");
        console.log("\n📝 To grant admin access to a user:");
        console.log("1. Go to https://dashboard.clerk.com");
        console.log("2. Navigate to 'Users' section");
        console.log("3. Find the user you want to make admin");
        console.log("4. Click on the user to view details");
        console.log("5. Click 'Edit' on the 'Public metadata' section");
        console.log("6. Add this JSON:");
        console.log('   { "isAdmin": true }');
        console.log("7. Save the changes");
        console.log("\nAlternatively, run this script with an email:");
        console.log("   pnpm tsx scripts/verify-admin-auth.ts user@example.com grant");
      } else {
        console.log(`✅ Found ${adminUsers.length} admin user(s):`);
        adminUsers.forEach((user) => {
          const email = user.emailAddresses[0]?.emailAddress || "No email";
          console.log(`   • ${user.firstName || ""} ${user.lastName || ""} (${email})`);
          console.log(`     ID: ${user.id}`);
        });
      }
    } catch (error) {
      console.error("❌ Failed to list users:");
      console.error(`   ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  } else {
    // Check specific user
    const grantAdmin = process.argv[3] === "grant";

    try {
      const client = clerkClient({ secretKey: CLERK_SECRET_KEY });
      const users = await client.users.getUserList({ emailAddress: [userEmail] });

      if (users.data.length === 0) {
        console.log(`❌ No user found with email: ${userEmail}`);
        console.log("\n📝 Make sure the user has signed up first at:");
        console.log("   http://localhost:3001/sign-up");
        process.exit(1);
      }

      const user = users.data[0];
      const isAdmin = user.publicMetadata?.isAdmin === true;

      console.log(`\nUser: ${user.firstName || ""} ${user.lastName || ""}`);
      console.log(`Email: ${userEmail}`);
      console.log(`User ID: ${user.id}`);
      console.log(`Admin Status: ${isAdmin ? "✅ Admin" : "❌ Not Admin"}`);

      if (grantAdmin && !isAdmin) {
        console.log("\n🔄 Granting admin access...");
        await client.users.updateUserMetadata(user.id, {
          publicMetadata: {
            ...user.publicMetadata,
            isAdmin: true,
          },
        });
        console.log("✅ Admin access granted successfully!");
        console.log("\nThe user can now access admin features at:");
        console.log("   http://localhost:3001/admin");
      } else if (!isAdmin) {
        console.log("\n📝 To grant admin access to this user, run:");
        console.log(`   pnpm tsx scripts/verify-admin-auth.ts ${userEmail} grant`);
      }
    } catch (error) {
      console.error("❌ Failed to check/update user:");
      console.error(`   ${error instanceof Error ? error.message : "Unknown error"}`);
      process.exit(1);
    }
  }

  // Step 4: Test API endpoint
  console.log("\n4️⃣  Testing API Endpoint:");
  console.log("-".repeat(40));
  console.log("\n📝 To test the admin API endpoint:");
  console.log("1. Start the development server: pnpm run dev:pm2 start");
  console.log("2. Sign in as an admin user");
  console.log("3. Visit: http://localhost:3001/admin");
  console.log("4. The article management UI should load without errors");
  console.log("\nOr test directly with curl (after signing in):");
  console.log("   curl http://localhost:3001/api/admin/articles");

  console.log(`\n${"=".repeat(60)}`);
  console.log("✅ Verification complete!");
}

// Run the script
verifyAdminAuth().catch((error) => {
  console.error("\n❌ Script failed:");
  console.error(error);
  process.exit(1);
});
