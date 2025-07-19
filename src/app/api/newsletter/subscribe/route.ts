import { type NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getSubscribersRepo } from "@/lib/json-db";
import { loggers } from "@/lib/logger";

// Initialize Resend only when API key is available
const getResendClient = () => {
  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) {
    throw new Error("RESEND_API_KEY not configured");
  }
  return new Resend(apiKey);
};
const TURNSTILE_SECRET_KEY = process.env["TURNSTILE_SECRET_KEY"] || "YOUR_TURNSTILE_SECRET_KEY";

interface SubscribeRequest {
  firstName: string;
  lastName: string;
  email: string;
  turnstileToken: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Debug environment variables
    loggers.api.info("Environment check", {
      hasResendKey: !!process.env["RESEND_API_KEY"],
      nodeEnv: process.env["NODE_ENV"],
    });

    // Validate environment variables
    if (!process.env["RESEND_API_KEY"]) {
      loggers.api.error("Missing Resend API key");
      return NextResponse.json({ error: "Email service configuration error" }, { status: 500 });
    }

    const body: SubscribeRequest = await request.json();
    const { firstName, lastName, email, turnstileToken } = body;

    // Basic validation
    if (!firstName || !lastName || !email) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    // Verify Turnstile token (skip in development)
    if (process.env["NODE_ENV"] !== "development") {
      const turnstileResponse = await fetch(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            secret: TURNSTILE_SECRET_KEY,
            response: turnstileToken,
          }),
        }
      );

      const turnstileData = await turnstileResponse.json();

      if (!turnstileData.success) {
        loggers.api.warn("Turnstile verification failed", {
          email: `${email.substring(0, 3)}***`,
          errors: turnstileData["error-codes"],
        });
        return NextResponse.json({ error: "Invalid captcha verification" }, { status: 400 });
      }
    } else {
      loggers.api.info("Skipping Turnstile verification in development");
    }

    // Initialize subscriber repository
    const subscribersRepo = getSubscribersRepo();

    // Check if email already exists
    const existing = await subscribersRepo.getByEmail(email);

    if (existing) {
      // If already verified, return error
      if (existing.status === "verified") {
        return NextResponse.json({ error: "Email already registered" }, { status: 409 });
      }

      // If pending, resend verification email
      if (existing.status === "pending" && existing.verification_token) {
        // Update the subscriber's metadata in case it changed
        await subscribersRepo.updateSubscriber(existing.id, {
          metadata: {
            ...existing.metadata,
            firstName,
            lastName,
          },
        });

        // Send notification to admin about existing subscription
        await sendSubscriptionNotification(email, firstName, lastName, true);

        return NextResponse.json({
          success: true,
          message: "Thank you for your interest! We already have your subscription.",
          resent: true,
        });
      }
    }

    // Generate a verification token
    const verificationToken = subscribersRepo.generateVerificationToken();

    // Create new subscription
    try {
      await subscribersRepo.create({
        email,
        status: "pending",
        verification_token: verificationToken,
        metadata: {
          source: "website",
          user_agent: request.headers.get("user-agent") || undefined,
          firstName,
          lastName,
        },
      });
    } catch (dbError: any) {
      loggers.database.error("Database error during subscription", {
        error: dbError,
        message: dbError.message,
        email: `${email.substring(0, 3)}***`, // Log partial email for privacy
      });

      // Return more specific error based on the error
      if (dbError.message?.includes("Email already exists")) {
        return NextResponse.json({ error: "Email already registered" }, { status: 409 });
      }

      return NextResponse.json(
        {
          error: "Failed to save subscription",
          debug: process.env["NODE_ENV"] === "development" ? dbError.message : undefined,
        },
        { status: 500 }
      );
    }

    // Send notification email to admin instead of verification email
    await sendSubscriptionNotification(email, firstName, lastName);

    return NextResponse.json({
      success: true,
      message: "Thank you for subscribing! We'll be in touch soon.",
      resent: false,
    });
  } catch (error) {
    loggers.api.error("Subscribe error", { error });
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}

async function sendSubscriptionNotification(
  email: string,
  firstName: string,
  lastName: string,
  isExisting = false
): Promise<void> {
  const resend = getResendClient();
  const subject = isExisting
    ? "AI Power Ranking - Existing Subscription Attempt"
    : "AI Power Ranking - New Subscription";

  const { error: emailError } = await resend.emails.send({
    from: "AI Power Ranking <newsletter@aipowerranking.com>",
    to: "bob@matsuoka.com", // Send to admin email
    subject: subject,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
              line-height: 1.6; 
              color: #1a1a1a;
              margin: 0;
              padding: 0;
              background-color: #f5f5f5;
            }
            .container { 
              max-width: 600px; 
              margin: 40px auto; 
              background-color: #ffffff;
              border-radius: 12px;
              padding: 40px;
              box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            }
            .header { 
              text-align: center;
              margin-bottom: 30px;
            }
            .header h1 {
              margin: 0;
              color: #333;
              font-size: 24px;
              font-weight: 700;
            }
            .content {
              background-color: #f8f9fa;
              padding: 20px;
              border-radius: 8px;
              margin: 20px 0;
            }
            .field {
              margin: 10px 0;
            }
            .label {
              font-weight: 600;
              color: #555;
            }
            .value {
              color: #333;
            }
            .status {
              display: inline-block;
              padding: 4px 12px;
              border-radius: 4px;
              font-size: 14px;
              font-weight: 600;
            }
            .new {
              background-color: #d1fae5;
              color: #065f46;
            }
            .existing {
              background-color: #fef3c7;
              color: #92400e;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Newsletter Subscription ${isExisting ? "Attempt" : "Received"}</h1>
            </div>
            
            <p>A ${isExisting ? "repeat" : "new"} subscription request was received:</p>
            
            <div class="content">
              <div class="field">
                <span class="label">Status:</span> 
                <span class="status ${isExisting ? "existing" : "new"}">${isExisting ? "Existing Subscriber" : "New Subscription"}</span>
              </div>
              <div class="field">
                <span class="label">Name:</span> 
                <span class="value">${firstName} ${lastName}</span>
              </div>
              <div class="field">
                <span class="label">Email:</span> 
                <span class="value">${email}</span>
              </div>
              <div class="field">
                <span class="label">Timestamp:</span> 
                <span class="value">${new Date().toLocaleString()}</span>
              </div>
            </div>
            
            ${
              isExisting
                ? "<p><strong>Note:</strong> This email address has already subscribed and attempted to subscribe again.</p>"
                : "<p><strong>Action Required:</strong> Please follow up with this new subscriber manually until the verification system is implemented.</p>"
            }
            
            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
              This notification was sent from the AI Power Ranking subscription system.
            </p>
          </div>
        </body>
      </html>
    `,
  });

  if (emailError) {
    loggers.api.error("Resend email error during subscription notification", {
      error: emailError,
      message: emailError.message,
      name: emailError.name,
      statusCode: (emailError as { statusCode?: number }).statusCode,
      response: (emailError as { response?: unknown }).response,
      resendApiKey: process.env["RESEND_API_KEY"]
        ? `Set (length: ${process.env["RESEND_API_KEY"].length})`
        : "Not set",
      toEmail: "bob@matsuoka.com",
      fromEmail: "AI Power Ranking <newsletter@aipowerranking.com>",
      subscriberEmail: email,
    });

    throw new Error(
      process.env["NODE_ENV"] === "development"
        ? `Failed to send subscription notification: ${emailError.message}`
        : "Failed to send subscription notification"
    );
  }
}
