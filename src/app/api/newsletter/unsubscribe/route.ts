import { NextRequest, NextResponse } from "next/server";
import { loggers } from "@/lib/logger";
import { getSubscribersRepo } from "@/lib/json-db";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(
      new URL("/newsletter/unsubscribe?status=error&error=missing-token", request.url)
    );
  }

  try {
    // Initialize subscriber repository
    const subscribersRepo = getSubscribersRepo();

    // Find subscription by token
    const subscribers = await subscribersRepo.getAll();
    const subscription = subscribers.find((s) => s.verification_token === token);

    if (!subscription) {
      loggers.api.error("Newsletter unsubscribe subscription not found", { token });
      return NextResponse.redirect(
        new URL("/newsletter/unsubscribe?status=error&error=invalid-token", request.url)
      );
    }

    // Update subscription status to unsubscribed
    try {
      await subscribersRepo.updateSubscriber(subscription.id, {
        status: "unsubscribed",
        unsubscribed_at: new Date().toISOString(),
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
