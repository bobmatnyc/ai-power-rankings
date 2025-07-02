import { type NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { loggers } from "@/lib/logger";
import { getSubscribersRepo } from "@/lib/json-db";

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
          email: email.substring(0, 3) + "***",
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

        // Resend verification email with existing token
        const baseUrl =
          process.env["NEXT_PUBLIC_BASE_URL"] || process.env["VERCEL_URL"]
            ? `https://${process.env["VERCEL_URL"]}`
            : new URL(request.url).origin;
        const verificationUrl = `${baseUrl}/api/newsletter/verify/${existing.verification_token}`;

        await sendVerificationEmail(email, firstName, verificationUrl, baseUrl);

        return NextResponse.json({
          success: true,
          message: "We've resent the verification email. Please check your inbox.",
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
        email: email.substring(0, 3) + "***", // Log partial email for privacy
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

    // Generate verification URL
    const baseUrl =
      process.env["NEXT_PUBLIC_BASE_URL"] || process.env["VERCEL_URL"]
        ? `https://${process.env["VERCEL_URL"]}`
        : new URL(request.url).origin;
    const verificationUrl = `${baseUrl}/api/newsletter/verify/${verificationToken}`;

    // Send verification email
    await sendVerificationEmail(email, firstName, verificationUrl, baseUrl);

    return NextResponse.json({
      success: true,
      message: "Please check your email to verify your subscription",
      resent: false,
    });
  } catch (error) {
    loggers.api.error("Subscribe error", { error });
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}

async function sendVerificationEmail(
  email: string,
  firstName: string,
  verificationUrl: string,
  baseUrl: string
): Promise<void> {
  const resend = getResendClient();
  const { error: emailError } = await resend.emails.send({
    from: "AI Power Ranking <newsletter@aipowerranking.com>",
    to: email,
    subject: "Verify your subscription to AI Power Ranking",
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
            .wrapper {
              background-color: #f5f5f5;
              padding: 40px 20px;
            }
            .container { 
              max-width: 600px; 
              margin: 0 auto; 
              background-color: #ffffff;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            }
            .header { 
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              padding: 40px 20px;
              text-align: center;
            }
            .header h1 {
              margin: 0;
              color: #ffffff;
              font-size: 28px;
              font-weight: 700;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 12px;
            }
            .crown-icon {
              width: 48px;
              height: 48px;
              display: inline-block;
            }
            .gradient-text {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
              background-clip: text;
              font-weight: 700;
            }
            .content {
              padding: 40px 30px;
            }
            .button { 
              display: inline-block; 
              padding: 14px 32px; 
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white; 
              text-decoration: none; 
              border-radius: 8px; 
              margin: 24px 0;
              font-weight: 600;
              font-size: 16px;
              box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
            }
            .button:hover {
              box-shadow: 0 6px 16px rgba(102, 126, 234, 0.6);
            }
            .footer { 
              background-color: #f8f9fa;
              padding: 30px;
              text-align: center;
              font-size: 14px; 
              color: #6b7280; 
            }
            .divider {
              height: 1px;
              background-color: #e5e7eb;
              margin: 30px 0;
            }
            .feature-list {
              margin: 20px 0;
            }
            .feature-item {
              display: flex;
              align-items: center;
              margin: 12px 0;
              gap: 10px;
            }
            .check-icon {
              color: #10b981;
              font-size: 20px;
            }
            a.link {
              color: #667eea;
              text-decoration: none;
            }
            a.link:hover {
              text-decoration: underline;
            }
          </style>
        </head>
        <body>
          <div class="wrapper">
            <div class="container">
              <div class="header">
                <h1>
                  <img src="${baseUrl}/favicon.ico" alt="AI Power Ranking" class="crown-icon" />
                  AI Power Ranking
                </h1>
              </div>
              
              <div class="content">
                <p style="font-size: 18px; margin-bottom: 8px;">Hi ${firstName},</p>
                
                <p style="font-size: 16px; color: #4b5563;">Welcome to the <span class="gradient-text">AI Power Ranking</span> community! 🎉</p>
                
                <p>Thank you for subscribing to our weekly newsletter. You're now part of an exclusive group staying ahead of the AI coding revolution.</p>
                
                <div class="feature-list">
                  <p style="font-weight: 600; margin-bottom: 12px;">Here's what you'll receive:</p>
                  <div class="feature-item">
                    <span class="check-icon">✓</span>
                    <span>Weekly rankings of the top AI coding tools</span>
                  </div>
                  <div class="feature-item">
                    <span class="check-icon">✓</span>
                    <span>Breaking news about AI tool updates and launches</span>
                  </div>
                  <div class="feature-item">
                    <span class="check-icon">✓</span>
                    <span>In-depth analysis of emerging trends</span>
                  </div>
                  <div class="feature-item">
                    <span class="check-icon">✓</span>
                    <span>Exclusive insights not available on our website</span>
                  </div>
                </div>
                
                <div class="divider"></div>
                
                <p style="font-weight: 600; font-size: 18px; text-align: center;">Please verify your email address to start receiving updates:</p>
                
                <div style="text-align: center;">
                  <a href="${verificationUrl}" class="button">Verify Email Address</a>
                </div>
                
                <p style="font-size: 14px; color: #6b7280; text-align: center;">Or copy and paste this link into your browser:</p>
                <p style="word-break: break-all; font-size: 14px; text-align: center;">
                  <a href="${verificationUrl}" class="link">${verificationUrl}</a>
                </p>
              </div>
              
              <div class="footer">
                <p style="margin: 0 0 8px 0;">If you didn't subscribe to AI Power Ranking, you can safely ignore this email.</p>
                <p style="margin: 0 0 16px 0;">© 2025 AI Power Ranking. All rights reserved.</p>
                <p style="margin: 0;">
                  <a href="${baseUrl}" class="link">Visit our website</a> | 
                  <a href="${baseUrl}/about" class="link">About us</a> | 
                  <a href="${baseUrl}/methodology" class="link">Our methodology</a>
                </p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `,
  });

  if (emailError) {
    loggers.api.error("Resend email error during subscription", {
      error: emailError,
      message: emailError.message,
      name: emailError.name,
      statusCode: (emailError as { statusCode?: number }).statusCode,
      response: (emailError as { response?: unknown }).response,
      resendApiKey: process.env["RESEND_API_KEY"]
        ? "Set (length: " + process.env["RESEND_API_KEY"].length + ")"
        : "Not set",
      toEmail: email,
      fromEmail: "AI Power Ranking <newsletter@aipowerranking.com>",
    });

    throw new Error(
      process.env["NODE_ENV"] === "development"
        ? `Failed to send verification email: ${emailError.message}`
        : "Failed to send verification email"
    );
  }
}
