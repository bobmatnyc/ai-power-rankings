import { NextRequest, NextResponse } from "next/server";
import { getPayload } from "payload";
import config from "@payload-config";
import { loggers } from "@/lib/logger";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(
      new URL("/newsletter/unsubscribe?status=error&error=missing-token", request.url)
    );
  }

  try {
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
      loggers.api.error("Newsletter unsubscribe find error", { token });
      return NextResponse.redirect(
        new URL("/newsletter/unsubscribe?status=error&error=invalid-token", request.url)
      );
    }

    const subscription = subscriptions[0];
    
    if (!subscription) {
      loggers.api.error("Newsletter unsubscribe subscription not found", { token });
      return NextResponse.redirect(
        new URL("/newsletter/unsubscribe?status=error&error=invalid-token", request.url)
      );
    }

    // Update subscription status to unsubscribed
    try {
      await payload.update({
        collection: "newsletter-subscribers",
        id: subscription['id'],
        data: {
          status: "unsubscribed",
          unsubscribed_at: new Date().toISOString(),
        },
      });
    } catch (updateError) {
      loggers.api.error("Newsletter unsubscribe update error", { updateError, token });
      return NextResponse.redirect(
        new URL("/newsletter/unsubscribe?status=error&error=unsubscribe-failed", request.url)
      );
    }

    return NextResponse.redirect(new URL("/newsletter/unsubscribe?status=success", request.url));
  } catch (error) {
    loggers.api.error("Newsletter unsubscribe error", { error });
    return NextResponse.redirect(new URL("/newsletter/unsubscribe?status=error", request.url));
  }
}