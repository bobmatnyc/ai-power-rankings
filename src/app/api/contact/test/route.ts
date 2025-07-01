import { NextResponse } from "next/server";
import { Resend } from "resend";

export async function GET() {
  try {
    // Check if API key is present
    if (!process.env["RESEND_API_KEY"]) {
      return NextResponse.json({
        error: "RESEND_API_KEY is not configured",
        hasKey: false,
      });
    }

    // Initialize Resend
    const resend = new Resend(process.env["RESEND_API_KEY"]);

    // Try to send a test email
    const { data, error } = await resend.emails.send({
      from: "onboarding@resend.dev", // Resend's test domain
      to: "bob@matsuoka.com",
      subject: "Test Email from AI Power Rankings",
      html: "<p>This is a test email to verify Resend is working correctly.</p>",
      text: "This is a test email to verify Resend is working correctly.",
    });

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message || "Unknown error",
        details: error,
        hasKey: true,
        keyLength: process.env["RESEND_API_KEY"].length,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Test email sent successfully",
      id: data?.id,
      hasKey: true,
      keyLength: process.env["RESEND_API_KEY"].length,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unexpected error",
      hasKey: !!process.env["RESEND_API_KEY"],
    });
  }
}