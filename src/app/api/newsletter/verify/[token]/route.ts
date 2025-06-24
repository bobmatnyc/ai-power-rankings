import { NextRequest, NextResponse } from "next/server";
import { getPayload } from "payload";
import config from "@payload-config";
import { loggers } from "@/lib/logger";

type RouteParams = Promise<{ token: string }>;

export async function GET(
  request: NextRequest,
  props: { params: RouteParams }
): Promise<NextResponse> {
  try {
    const params = await props.params;
    const token = params.token;

    if (!token) {
      return NextResponse.redirect(new URL("/newsletter/verify?error=missing-token", request.url));
    }

    // Initialize Payload
    const payload = await getPayload({ config });

    // Find subscription by token
    const { docs: subscriptions } = await payload.find({
      collection: "newsletter-subscribers",
      where: {
        verification_token: { equals: token },
      },
      limit: 1,
    });

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.redirect(new URL("/newsletter/verify?error=invalid-token", request.url));
    }

    const subscription = subscriptions[0];
    
    if (!subscription) {
      return NextResponse.redirect(new URL("/newsletter/verify?error=invalid-token", request.url));
    }

    if (subscription['status'] === "verified") {
      return NextResponse.redirect(
        new URL("/newsletter/verify?status=already-verified", request.url)
      );
    }

    // Update subscription status
    try {
      await payload.update({
        collection: "newsletter-subscribers",
        id: subscription['id'],
        data: {
          status: "verified",
          verified_at: new Date().toISOString(),
        },
      });
    } catch (updateError) {
      loggers.api.error("Failed to verify subscription", { updateError, token });
      return NextResponse.redirect(
        new URL("/newsletter/verify?error=verification-failed", request.url)
      );
    }

    return NextResponse.redirect(new URL("/newsletter/verify?status=success", request.url));
  } catch (error) {
    loggers.api.error("Verify error", { error });
    return NextResponse.redirect(new URL("/newsletter/verify?error=unexpected", request.url));
  }
}