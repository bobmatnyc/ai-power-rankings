import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSubscribersRepo } from "@/lib/json-db";
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

    // Initialize subscriber repository
    const subscribersRepo = getSubscribersRepo();

    // Fetch subscriber
    const subscriber = await subscribersRepo.getById(id);

    if (!subscriber) {
      return NextResponse.json({ error: "Subscriber not found" }, { status: 404 });
    }

    // Get first name from metadata or use default
    const firstName = subscriber.metadata?.firstName || "Subscriber";

    // Send test email
    await sendTestEmail(subscriber.email, firstName);

    return NextResponse.json({ success: true, message: "Test email sent successfully" });
  } catch (error) {
    console.error("Error sending test email:", error);
    return NextResponse.json({ error: "Failed to send test email" }, { status: 500 });
  }
}