import { getAuth } from "@/lib/auth-helper";
import { withAuth } from "@/lib/clerk-auth";
import { SubscribersRepository } from "@/lib/json-db/subscribers-repository";
import { type NextRequest, NextResponse } from "next/server";

/**
 * POST /api/newsletter/signup
 * Handles authenticated signups for newsletter updates using Clerk auth
 */
export async function POST(request: NextRequest) {
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
      const existingSubscriber = await repo.getByEmail(email);
      if (existingSubscriber && existingSubscriber.status === "verified") {
        return NextResponse.json({
          message: "You're already subscribed to updates!",
          alreadySubscribed: true,
        } as any);
      }

      // Create or update subscriber
      if (existingSubscriber) {
        // Reactivate existing subscriber
        await repo.updateSubscriber(existingSubscriber.id, {
          status: "verified",
          verified_at: new Date().toISOString(),
          metadata: {
            ...existingSubscriber.metadata,
            firstName: firstName || existingSubscriber.metadata?.firstName,
            lastName: lastName || existingSubscriber.metadata?.lastName,
          },
        });
      } else {
        // Create new subscriber
        await repo.create({
          email,
          status: "verified",
          metadata: {
            firstName: firstName || "",
            lastName: lastName || "",
            source: "clerk-auth",
          },
        });
      }

      // Log the subscription
      console.log(`✅ User ${userId} subscribed to updates with email ${email}`);

      return NextResponse.json({
        success: true,
        message: "Successfully signed up for updates!",
      } as any);
    } catch (error) {
      console.error("Newsletter signup error:", error);
      return NextResponse.json(
        { error: "Failed to process signup" },
        { status: 500 }
      );
    }
  });
}