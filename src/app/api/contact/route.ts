import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";

// Initialize Resend lazily to avoid build-time errors
const getResendClient = () => {
  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey || apiKey === "re_test_key_for_build") {
    throw new Error("RESEND_API_KEY not configured for production use");
  }
  return new Resend(apiKey);
};

// Log to verify API key is loaded (remove in production)
if (!process.env["RESEND_API_KEY"]) {
  console.error("RESEND_API_KEY is not set in environment variables");
} else {
  console.log("RESEND_API_KEY is configured (length:", process.env["RESEND_API_KEY"].length, ")");
}

// Validation schema
const contactSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  subject: z.string().optional(),
  category: z.string().min(1, "Category is required"),
  message: z.string().min(10, "Message must be at least 10 characters long"),
});

// Category labels map
const categoryLabels: Record<string, string> = {
  general: "General Inquiry",
  press: "Press & Media",
  partnership: "Partnership & Business",
  technical: "Technical Support",
  methodology: "Ranking Methodology",
  "tool-submission": "Tool Submission",
  "issue-report": "Report an Issue",
  legal: "Legal Matters",
};

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();

    // Validate input
    const validationResult = contactSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid form data", details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { name, email, subject, category, message } = validationResult.data;

    // Check if Resend API key is configured
    if (!process.env["RESEND_API_KEY"]) {
      console.error("RESEND_API_KEY is not configured");
      return NextResponse.json({ error: "Email service is not configured" }, { status: 500 });
    }

    // Get category label
    const categoryLabel = categoryLabels[category] || category;

    // Create email subject
    const emailSubject = subject
      ? `[${categoryLabel}] ${subject}`
      : `[${categoryLabel}] Contact Form Submission`;

    // Create HTML email content
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">New Contact Form Submission</h2>
        
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0 0 10px 0;"><strong>Name:</strong> ${name}</p>
          <p style="margin: 0 0 10px 0;"><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
          <p style="margin: 0 0 10px 0;"><strong>Category:</strong> ${categoryLabel}</p>
          ${subject ? `<p style="margin: 0 0 10px 0;"><strong>Subject:</strong> ${subject}</p>` : ""}
        </div>
        
        <div style="background-color: #fff; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h3 style="color: #333; margin-top: 0;">Message:</h3>
          <p style="white-space: pre-wrap; color: #555;">${message}</p>
        </div>
        
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #e0e0e0;">
        
        <p style="color: #888; font-size: 12px;">
          This email was sent via the AI Power Rankings contact form.
        </p>
      </div>
    `;

    // Create plain text version
    const textContent = `
New Contact Form Submission

Name: ${name}
Email: ${email}
Category: ${categoryLabel}
${subject ? `Subject: ${subject}` : ""}

Message:
${message}

---
This email was sent via the AI Power Rankings contact form.
    `.trim();

    // Send email using Resend
    // IMPORTANT: Resend accounts start in sandbox mode and can only send to your verified email
    // To send to other recipients:
    // 1. Verify your domain at resend.com/domains
    // 2. Update 'from' to use your verified domain (e.g., 'noreply@aipowerranking.com')
    // 3. Update 'to' to your desired recipient email
    const resend = getResendClient();
    const { data, error } = await resend.emails.send({
      from: "AI Power Rankings <onboarding@resend.dev>", // Uses Resend's test domain
      to: ["bob@matsuoka.com"], // Must be your verified email in sandbox mode
      subject: emailSubject,
      replyTo: email,
      html: htmlContent,
      text: textContent,
    });

    if (error) {
      console.error("Resend API error:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));

      // Provide more specific error messages
      let errorMessage = "Failed to send email";
      if (error.message) {
        errorMessage = error.message;
      }

      return NextResponse.json({ error: errorMessage, details: error }, { status: 500 });
    }

    // Return success response
    return NextResponse.json(
      {
        success: true,
        message: "Your message has been sent successfully. We'll get back to you within 48 hours.",
        id: data?.id,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Contact form error:", error);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
