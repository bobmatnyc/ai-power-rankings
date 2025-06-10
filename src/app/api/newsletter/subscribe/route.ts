import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const resend = new Resend(process.env.RESEND_API_KEY);
const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY || 'YOUR_TURNSTILE_SECRET_KEY';

interface SubscribeRequest {
  firstName: string;
  lastName: string;
  email: string;
  turnstileToken: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: SubscribeRequest = await request.json();
    const { firstName, lastName, email, turnstileToken } = body;

    // Verify Turnstile token
    const turnstileResponse = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          secret: TURNSTILE_SECRET_KEY,
          response: turnstileToken,
        }),
      }
    );

    const turnstileData = await turnstileResponse.json();
    
    if (!turnstileData.success) {
      return NextResponse.json(
        { error: 'Invalid captcha verification' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const { data: existingSubscriber } = await supabase
      .from('newsletter_subscriptions')
      .select('*')
      .eq('email', email)
      .single();

    if (existingSubscriber) {
      if (existingSubscriber.status === 'verified') {
        return NextResponse.json(
          { error: 'This email is already subscribed' },
          { status: 400 }
        );
      }
      // If pending, resend verification email
    }

    // Insert or update subscription
    const { data: subscription, error: dbError } = await supabase
      .from('newsletter_subscriptions')
      .upsert({
        email,
        first_name: firstName,
        last_name: lastName,
        status: 'pending',
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json(
        { error: 'Failed to save subscription' },
        { status: 500 }
      );
    }

    // Generate verification URL
    const verificationUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/api/newsletter/verify?token=${subscription.verification_token}`;

    // Send verification email
    const { error: emailError } = await resend.emails.send({
      from: 'AI Power Rankings <newsletter@aipowerranking.com>',
      to: email,
      subject: 'Verify your subscription to AI Power Rankings',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { text-align: center; margin-bottom: 30px; }
              .button { 
                display: inline-block; 
                padding: 12px 24px; 
                background-color: #4F46E5; 
                color: white; 
                text-decoration: none; 
                border-radius: 6px; 
                margin: 20px 0;
              }
              .footer { margin-top: 30px; font-size: 14px; color: #666; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Welcome to AI Power Rankings!</h1>
              </div>
              
              <p>Hi ${firstName},</p>
              
              <p>Thank you for subscribing to our weekly newsletter! We're excited to keep you updated on the latest AI tool rankings, news, and insights.</p>
              
              <p>Please verify your email address by clicking the button below:</p>
              
              <div style="text-align: center;">
                <a href="${verificationUrl}" class="button">Verify Email Address</a>
              </div>
              
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #4F46E5;">${verificationUrl}</p>
              
              <div class="footer">
                <p>If you didn't subscribe to AI Power Rankings, you can safely ignore this email.</p>
                <p>© 2025 AI Power Rankings. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (emailError) {
      console.error('Email error:', emailError);
      return NextResponse.json(
        { error: 'Failed to send verification email' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Please check your email to verify your subscription',
    });
  } catch (error) {
    console.error('Subscribe error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}