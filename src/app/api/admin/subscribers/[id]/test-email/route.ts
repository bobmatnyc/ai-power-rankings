import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { EmailService } from "@/lib/email/email-service";

interface RouteParams {
  params: { id: string };
}

export async function POST(_request: Request, { params }: RouteParams) {
  try {
    // Check authentication
    const session = await auth();
    if (!session || session.user?.email !== "bob@matsuoka.com") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;

    // Fetch subscriber
    const { data: subscriber, error } = await supabaseAdmin
      .from("newsletter_subscriptions")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !subscriber) {
      return NextResponse.json({ error: "Subscriber not found" }, { status: 404 });
    }

    // Send test email
    const emailService = new EmailService();
    await emailService.sendEmail({
      to: subscriber.email,
      subject: "Test Email - AI Power Rankings Newsletter",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Test Email</h2>
          <p>Hi ${subscriber.first_name},</p>
          <p>This is a test email from AI Power Rankings to verify that our email system is working correctly.</p>
          <p>If you're receiving this, it means everything is set up properly!</p>
          <p>Best regards,<br>AI Power Rankings Team</p>
        </div>
      `,
      text: `Test Email\n\nHi ${subscriber.first_name},\n\nThis is a test email from AI Power Rankings to verify that our email system is working correctly.\n\nIf you're receiving this, it means everything is set up properly!\n\nBest regards,\nAI Power Rankings Team`,
    });

    return NextResponse.json({ success: true, message: "Test email sent successfully" });
  } catch (error) {
    console.error("Error sending test email:", error);
    return NextResponse.json({ error: "Failed to send test email" }, { status: 500 });
  }
}
