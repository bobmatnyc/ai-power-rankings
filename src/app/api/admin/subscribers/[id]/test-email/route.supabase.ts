import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { sendTestEmail } from "@/lib/email/email-service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication
    const session = await auth();
    if (!session || session.user?.email !== "bob@matsuoka.com") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Fetch subscriber
    const supabaseAdmin = createServiceClient();
    const { data: subscriber, error } = await supabaseAdmin
      .from("newsletter_subscriptions")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !subscriber) {
      return NextResponse.json({ error: "Subscriber not found" }, { status: 404 });
    }

    // Send test email
    await sendTestEmail(subscriber.email, subscriber.first_name || "Subscriber");

    return NextResponse.json({ success: true, message: "Test email sent successfully" });
  } catch (error) {
    console.error("Error sending test email:", error);
    return NextResponse.json({ error: "Failed to send test email" }, { status: 500 });
  }
}
