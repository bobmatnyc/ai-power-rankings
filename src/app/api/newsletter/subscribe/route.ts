import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import crypto from "crypto";

const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"] || "";
const supabaseKey = process.env["SUPABASE_SERVICE_ROLE_KEY"] || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const resend = new Resend(process.env["RESEND_API_KEY"]);
const TURNSTILE_SECRET_KEY = process.env["TURNSTILE_SECRET_KEY"] || "YOUR_TURNSTILE_SECRET_KEY";

interface SubscribeRequest {
  firstName: string;
  lastName: string;
  email: string;
  turnstileToken: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Validate environment variables
    if (!supabaseUrl || !supabaseKey) {
      console.error("Missing Supabase environment variables");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    if (!process.env["RESEND_API_KEY"]) {
      console.error("Missing Resend API key");
      return NextResponse.json({ error: "Email service configuration error" }, { status: 500 });
    }

    const body: SubscribeRequest = await request.json();
    const { firstName, lastName, email, turnstileToken } = body;

    // Verify Turnstile token
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
      return NextResponse.json({ error: "Invalid captcha verification" }, { status: 400 });
    }

    // Check if email already exists
    const { data: existingSubscriber } = await supabase
      .from("newsletter_subscriptions")
      .select("*")
      .eq("email", email)
      .single();

    if (existingSubscriber) {
      if (existingSubscriber.status === "verified") {
        return NextResponse.json({
          success: true,
          message: "You are already subscribed to our newsletter!",
          alreadySubscribed: true,
        });
      }
      // If pending or unsubscribed, we'll resend verification email
    }

    // Generate a verification token (use existing if re-subscribing)
    const verificationToken = existingSubscriber?.verification_token || crypto.randomUUID();

    // Insert or update subscription
    const { error: dbError } = await supabase
      .from("newsletter_subscriptions")
      .upsert(
        {
          email,
          first_name: firstName,
          last_name: lastName,
          status: existingSubscriber?.status || "pending",
          verification_token: verificationToken,
        },
        {
          onConflict: "email",
        }
      )
      .select()
      .single();

    if (dbError) {
      console.error("Database error details:", {
        error: dbError,
        message: dbError.message,
        details: dbError.details,
        hint: dbError.hint,
        code: dbError.code,
      });
      return NextResponse.json({ error: "Failed to save subscription" }, { status: 500 });
    }

    // Generate verification URL
    const verificationUrl = `${process.env["NEXT_PUBLIC_BASE_URL"]}/api/newsletter/verify?token=${verificationToken}`;

    // Send verification email
    const { error: emailError } = await resend.emails.send({
      from: "AI Power Rankings <newsletter@aipowerranking.com>",
      to: email,
      subject: "Verify your subscription to AI Power Rankings",
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
                    <img src="${process.env["NEXT_PUBLIC_BASE_URL"]}/favicon.ico" alt="AI Power Rankings" class="crown-icon" />
                    AI Power Rankings
                  </h1>
                </div>
                
                <div class="content">
                  <p style="font-size: 18px; margin-bottom: 8px;">Hi ${firstName},</p>
                  
                  <p style="font-size: 16px; color: #4b5563;">Welcome to the <span class="gradient-text">AI Power Rankings</span> community! 🎉</p>
                  
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
                  <p style="margin: 0 0 8px 0;">If you didn't subscribe to AI Power Rankings, you can safely ignore this email.</p>
                  <p style="margin: 0 0 16px 0;">© 2025 AI Power Rankings. All rights reserved.</p>
                  <p style="margin: 0;">
                    <a href="${process.env["NEXT_PUBLIC_BASE_URL"]}" class="link">Visit our website</a> | 
                    <a href="${process.env["NEXT_PUBLIC_BASE_URL"]}/about" class="link">About us</a> | 
                    <a href="${process.env["NEXT_PUBLIC_BASE_URL"]}/methodology" class="link">Our methodology</a>
                  </p>
                </div>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (emailError) {
      console.error("Resend email error details:", {
        error: emailError,
        message: emailError.message,
        name: emailError.name,
        statusCode: (emailError as { statusCode?: number }).statusCode,
        response: (emailError as { response?: unknown }).response,
        resendApiKey: process.env["RESEND_API_KEY"]
          ? "Set (length: " + process.env["RESEND_API_KEY"].length + ")"
          : "Not set",
        toEmail: email,
        fromEmail: "AI Power Rankings <newsletter@aipowerranking.com>",
      });
      return NextResponse.json({ error: "Failed to send verification email" }, { status: 500 });
    }

    // Different messages based on subscription status
    const isResend = existingSubscriber && existingSubscriber.status !== "verified";

    return NextResponse.json({
      success: true,
      message: isResend
        ? "We've resent the verification email. Please check your inbox."
        : "Please check your email to verify your subscription",
      resent: isResend,
    });
  } catch (error) {
    console.error("Subscribe error:", error);
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
