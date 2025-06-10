import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"] || "";
const supabaseKey = process.env["SUPABASE_SERVICE_ROLE_KEY"] || "";
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.redirect(new URL("/newsletter/verify?error=missing-token", request.url));
    }

    // Find subscription by token
    const { data: subscription, error: findError } = await supabase
      .from("newsletter_subscriptions")
      .select("*")
      .eq("verification_token", token)
      .single();

    if (findError || !subscription) {
      return NextResponse.redirect(new URL("/newsletter/verify?error=invalid-token", request.url));
    }

    if (subscription.status === "verified") {
      return NextResponse.redirect(
        new URL("/newsletter/verify?status=already-verified", request.url)
      );
    }

    // Update subscription status
    const { error: updateError } = await supabase
      .from("newsletter_subscriptions")
      .update({
        status: "verified",
        verified_at: new Date().toISOString(),
      })
      .eq("verification_token", token);

    if (updateError) {
      console.error("Failed to verify subscription:", updateError);
      return NextResponse.redirect(
        new URL("/newsletter/verify?error=verification-failed", request.url)
      );
    }

    return NextResponse.redirect(new URL("/newsletter/verify?status=success", request.url));
  } catch (error) {
    console.error("Verify error:", error);
    return NextResponse.redirect(new URL("/newsletter/verify?error=unexpected", request.url));
  }
}
