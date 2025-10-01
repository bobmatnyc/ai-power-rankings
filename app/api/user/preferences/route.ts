/**
 * User Preferences API Route
 * Handles GET and PUT requests for user notification preferences
 * Stored in Clerk's privateMetadata for simplified architecture
 * Requires Clerk authentication
 */

import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * User Preferences Type
 * Stored in Clerk's privateMetadata.preferences
 */
export interface UserPreferences {
  emailNotifications: boolean;
  weeklyDigest: boolean;
  rankingUpdates: boolean;
  toolUpdates: boolean;
  newsAlerts: boolean;
}

/**
 * Default preferences for new users
 */
const DEFAULT_PREFERENCES: UserPreferences = {
  emailNotifications: false,
  weeklyDigest: false,
  rankingUpdates: false,
  toolUpdates: false,
  newsAlerts: false,
};

/**
 * GET /api/user/preferences
 * Fetches user preferences from Clerk privateMetadata
 * Returns default preferences if not set
 */
export async function GET() {
  try {
    // Get authenticated user ID from Clerk
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch user from Clerk to access privateMetadata
    const client = await clerkClient();
    const user = await client.users.getUser(userId);

    // Get preferences from privateMetadata or use defaults
    const preferences = (user.privateMetadata?.preferences as UserPreferences) || DEFAULT_PREFERENCES;

    // Return preferences with consistent structure (matching old database response)
    return NextResponse.json({
      id: userId, // Use userId as ID for compatibility
      clerkUserId: userId,
      ...preferences,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  } catch (error) {
    console.error("[API] Error fetching user preferences:", error);

    // Check if it's a Clerk API error
    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(
      { error: "Failed to fetch user preferences" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/user/preferences
 * Updates user preferences in Clerk privateMetadata
 */
export async function PUT(request: Request) {
  try {
    // Get authenticated user ID from Clerk
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();

    // Validate that at least one preference field is provided
    const allowedFields = [
      "emailNotifications",
      "weeklyDigest",
      "rankingUpdates",
      "toolUpdates",
      "newsAlerts",
    ] as const;

    const updates: Partial<UserPreferences> = {};
    let hasValidUpdates = false;

    for (const field of allowedFields) {
      if (field in body && typeof body[field] === "boolean") {
        updates[field] = body[field];
        hasValidUpdates = true;
      }
    }

    if (!hasValidUpdates) {
      return NextResponse.json(
        { error: "No valid preference updates provided" },
        { status: 400 }
      );
    }

    // Get current user to access existing preferences
    const client = await clerkClient();
    const user = await client.users.getUser(userId);

    // Merge updates with existing preferences or defaults
    const currentPreferences = (user.privateMetadata?.preferences as UserPreferences) || DEFAULT_PREFERENCES;
    const updatedPreferences: UserPreferences = {
      ...currentPreferences,
      ...updates,
    };

    // Update user's privateMetadata with new preferences
    const updatedUser = await client.users.updateUserMetadata(userId, {
      privateMetadata: {
        ...user.privateMetadata,
        preferences: updatedPreferences,
      },
    });

    // Return updated preferences with consistent structure
    return NextResponse.json({
      id: userId,
      clerkUserId: userId,
      ...updatedPreferences,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
    });
  } catch (error) {
    console.error("[API] Error updating user preferences:", error);

    // Check if it's a Clerk API error
    if (error instanceof Error) {
      if (error.message.includes("not found")) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      if (error.message.includes("rate limit")) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
      }
    }

    return NextResponse.json(
      { error: "Failed to update user preferences" },
      { status: 500 }
    );
  }
}
