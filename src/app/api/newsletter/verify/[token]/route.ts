import { type NextRequest, NextResponse } from "next/server";
import { loggers } from "@/lib/logger";
import { getSubscribersRepo } from "@/lib/json-db";

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

    // Initialize subscriber repository
    const subscribersRepo = getSubscribersRepo();

    // Find and verify subscription by token
    const subscription = await subscribersRepo.verifyWithToken(token);

    if (!subscription) {
      return NextResponse.redirect(new URL("/newsletter/verify?error=invalid-token", request.url));
    }

    if (subscription.status === "verified") {
      return NextResponse.redirect(
        new URL("/newsletter/verify?status=already-verified", request.url)
      );
    }

    return NextResponse.redirect(new URL("/newsletter/verify?status=success", request.url));
  } catch (error) {
    loggers.api.error("Verify error", { error });
    return NextResponse.redirect(new URL("/newsletter/verify?error=unexpected", request.url));
  }
}
