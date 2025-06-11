import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/database";
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
    // Find subscription by token
    const { data: subscription, error: findError } = await supabaseAdmin
      .from("newsletter_subscriptions")
      .select("*")
      .eq("verification_token", token)
      .single();

    if (findError || !subscription) {
      loggers.api.error("Newsletter unsubscribe find error", { findError, token });
      return NextResponse.redirect(
        new URL("/newsletter/unsubscribe?status=error&error=invalid-token", request.url)
      );
    }

    // Update subscription status to unsubscribed
    const { error: updateError } = await supabaseAdmin
      .from("newsletter_subscriptions")
      .update({
        status: "unsubscribed",
        unsubscribed_at: new Date().toISOString(),
      })
      .eq("verification_token", token);

    if (updateError) {
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
