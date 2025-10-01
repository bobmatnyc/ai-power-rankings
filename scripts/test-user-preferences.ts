/**
 * DEPRECATED: This test script is no longer needed
 * User preferences are now stored in Clerk's privateMetadata
 * instead of a database table.
 *
 * To test preferences, use the API endpoints:
 * - GET /api/user/preferences
 * - PUT /api/user/preferences
 *
 * Or test directly through the UI in the user dropdown menu.
 */

// This file is kept for reference but should not be used
console.log("⚠️  This test script is deprecated.");
console.log("User preferences are now stored in Clerk's privateMetadata.");
console.log("Please test through the API endpoints or UI instead.");
process.exit(0);

/* DEPRECATED CODE - DO NOT USE
import { getDb } from "../lib/db/connection";
import { userPreferences } from "../lib/db/schema";
import { eq } from "drizzle-orm";

async function testUserPreferences() {
  console.log("🧪 Testing User Preferences Implementation\n");

  try {
    // Get database connection
    const db = getDb();
    console.log("✅ Database connection established\n");

    // Test 1: Create a test user preference
    console.log("Test 1: Creating test user preferences...");
    const testUserId = `test_user_${Date.now()}`;

    const [created] = await db
      .insert(userPreferences)
      .values({
        clerkUserId: testUserId,
        emailNotifications: true,
        weeklyDigest: false,
        rankingUpdates: true,
        toolUpdates: false,
        newsAlerts: true,
      })
      .returning();

    console.log("✅ Created preferences:", {
      id: created.id,
      clerkUserId: created.clerkUserId,
      emailNotifications: created.emailNotifications,
    });
    console.log();

    // Test 2: Fetch the created preference
    console.log("Test 2: Fetching user preferences...");
    const [fetched] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.clerkUserId, testUserId))
      .limit(1);

    if (fetched) {
      console.log("✅ Fetched preferences:", {
        id: fetched.id,
        emailNotifications: fetched.emailNotifications,
        rankingUpdates: fetched.rankingUpdates,
      });
    } else {
      console.error("❌ Failed to fetch preferences");
    }
    console.log();

    // Test 3: Update preferences
    console.log("Test 3: Updating preferences...");
    const [updated] = await db
      .update(userPreferences)
      .set({
        emailNotifications: false,
        weeklyDigest: true,
        updatedAt: new Date(),
      })
      .where(eq(userPreferences.clerkUserId, testUserId))
      .returning();

    console.log("✅ Updated preferences:", {
      emailNotifications: updated.emailNotifications,
      weeklyDigest: updated.weeklyDigest,
      updatedAt: updated.updatedAt,
    });
    console.log();

    // Test 4: Clean up - delete test preference
    console.log("Test 4: Cleaning up test data...");
    await db
      .delete(userPreferences)
      .where(eq(userPreferences.clerkUserId, testUserId));
    console.log("✅ Test data cleaned up\n");

    console.log("🎉 All tests passed successfully!");
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

// Run tests
testUserPreferences()
  .then(() => {
    console.log("\n✨ Test completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Test failed with error:", error);
    process.exit(1);
  });
*/