import { getAuth } from "@/lib/auth-helper";
import { withAuth } from "@/lib/clerk-auth";
import { SubscribersRepository } from "@/lib/json-db/subscribers-repository";
import { type NextRequest, NextResponse } from "next/server";

/**
 * POST /api/newsletter/signup
 * Handles authenticated signups for newsletter updates using Clerk auth
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  return withAuth(async () => {
    try {
      const { userId, email, firstName, lastName } = await request.json();

      // Verify the userId matches the authenticated user
      const auth = await getAuth();
      if (!auth.userId || auth.userId !== userId) {
        return NextResponse.json(
          { error: "User ID mismatch" },
          { status: 403 }
        );
      }

      // Validate required fields
      if (!email) {
        return NextResponse.json(
          { error: "Email is required" },
          { status: 400 }
        );
      }

      // Initialize repository
      const repo = new SubscribersRepository();

      // Check if already subscribed
      const existingSubscriber = await repo.findByEmail(email);
      if (existingSubscriber?.isActive) {
        return NextResponse.json({
          message: "You're already subscribed to updates!",
          alreadySubscribed: true,
        });
      }

      // Create or update subscriber
      if (existingSubscriber) {
        // Reactivate existing subscriber
        await repo.update(existingSubscriber.id, {
          isActive: true,
          firstName: firstName || existingSubscriber.firstName,
          lastName: lastName || existingSubscriber.lastName,
          clerkUserId: userId,
          subscribedAt: new Date().toISOString(),
        });
      } else {
        // Create new subscriber
        await repo.create({
          email,
          firstName: firstName || "",
          lastName: lastName || "",
          isActive: true,
          clerkUserId: userId,
          subscribedAt: new Date().toISOString(),
        });
      }

      // Log the subscription
      console.log(`✅ User ${userId} subscribed to updates with email ${email}`);

      return NextResponse.json({
        success: true,
        message: "Successfully signed up for updates!",
      });
    } catch (error) {
      console.error("Newsletter signup error:", error);
      return NextResponse.json(
        { error: "Failed to process signup" },
        { status: 500 }
      );
    }
  });
}