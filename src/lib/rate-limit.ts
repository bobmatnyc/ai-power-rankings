import { Ratelimit } from "@upstash/ratelimit";
import { kv } from "@vercel/kv";
import { NextRequest } from "next/server";

// Rate limit configurations
export const RATE_LIMITS = {
  CONTACT_FORM: {
    // 5 submissions per hour per IP
    requests: 5,
    window: "1 h",
  },
  CONTACT_FORM_STRICT: {
    // 2 submissions per 10 minutes per IP (for repeat offenders)
    requests: 2,
    window: "10 m",
  },
} as const;

// Admin bypass emails (can bypass rate limits)
const ADMIN_EMAILS = ["bob@matsuoka.com"];

// Create rate limiter instances
export const contactFormRateLimit = new Ratelimit({
  redis: kv,
  limiter: Ratelimit.slidingWindow(RATE_LIMITS.CONTACT_FORM.requests, RATE_LIMITS.CONTACT_FORM.window),
  analytics: true,
  prefix: "contact_form",
});

export const contactFormStrictRateLimit = new Ratelimit({
  redis: kv,
  limiter: Ratelimit.slidingWindow(RATE_LIMITS.CONTACT_FORM_STRICT.requests, RATE_LIMITS.CONTACT_FORM_STRICT.window),
  analytics: true,
  prefix: "contact_form_strict",
});

// Get client IP address from request
export function getClientIP(request: NextRequest): string {
  // Try various headers that might contain the real IP
  const forwarded = request.headers.get("x-forwarded-for");
  const realIP = request.headers.get("x-real-ip");
  const cfConnectingIP = request.headers.get("cf-connecting-ip");
  
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  
  if (realIP) {
    return realIP;
  }
  
  if (cfConnectingIP) {
    return cfConnectingIP;
  }
  
  // Fallback to connection remote address (if available)
  return "unknown";
}

// Check if user is admin and can bypass rate limits
export function isAdminUser(email?: string): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

// Rate limit result interface
export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: Date;
  retryAfter?: number;
}

// Check rate limit for contact form
export async function checkContactFormRateLimit(
  request: NextRequest,
  userEmail?: string
): Promise<RateLimitResult> {
  // Admin bypass
  if (isAdminUser(userEmail)) {
    return {
      success: true,
      limit: 999,
      remaining: 999,
      reset: new Date(Date.now() + 3600000), // 1 hour from now
    };
  }

  const clientIP = getClientIP(request);
  const identifier = `${clientIP}`;

  try {
    // Check if this IP has been flagged for strict rate limiting
    const strictModeKey = `strict_mode:${clientIP}`;
    const isStrictMode = await kv.get(strictModeKey);

    let result;
    if (isStrictMode) {
      // Use strict rate limiting for repeat offenders
      result = await contactFormStrictRateLimit.limit(identifier);
    } else {
      // Use normal rate limiting
      result = await contactFormRateLimit.limit(identifier);
    }

    // If rate limit exceeded, flag for strict mode
    if (!result.success) {
      await kv.set(strictModeKey, true, { ex: 3600 }); // Flag for 1 hour
    }

    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: new Date(result.reset),
      retryAfter: result.success ? undefined : Math.ceil((new Date(result.reset).getTime() - Date.now()) / 1000),
    };
  } catch (error) {
    console.error("Rate limit check failed:", error);
    // On error, allow the request but log the issue
    return {
      success: true,
      limit: RATE_LIMITS.CONTACT_FORM.requests,
      remaining: RATE_LIMITS.CONTACT_FORM.requests - 1,
      reset: new Date(Date.now() + 3600000),
    };
  }
}

// Get rate limit status without consuming a request
export async function getRateLimitStatus(
  request: NextRequest,
  userEmail?: string
): Promise<RateLimitResult> {
  // Admin bypass
  if (isAdminUser(userEmail)) {
    return {
      success: true,
      limit: 999,
      remaining: 999,
      reset: new Date(Date.now() + 3600000),
    };
  }

  const clientIP = getClientIP(request);
  const identifier = `${clientIP}`;

  try {
    // Check current rate limit status without consuming
    const strictModeKey = `strict_mode:${clientIP}`;
    const isStrictMode = await kv.get(strictModeKey);
    
    // Get current status (this doesn't consume a request)
    const prefix = isStrictMode ? "contact_form_strict" : "contact_form";
    const key = `${prefix}:${identifier}`;
    const currentCount = await kv.get(key) || 0;
    const limit = isStrictMode ? RATE_LIMITS.CONTACT_FORM_STRICT.requests : RATE_LIMITS.CONTACT_FORM.requests;

    return {
      success: Number(currentCount) < limit,
      limit,
      remaining: Math.max(0, limit - Number(currentCount)),
      reset: new Date(Date.now() + 3600000), // Approximate reset time
    };
  } catch (error) {
    console.error("Rate limit status check failed:", error);
    return {
      success: true,
      limit: RATE_LIMITS.CONTACT_FORM.requests,
      remaining: RATE_LIMITS.CONTACT_FORM.requests,
      reset: new Date(Date.now() + 3600000),
    };
  }
}

// Reset rate limit for a specific IP (admin function)
export async function resetRateLimit(clientIP: string): Promise<void> {
  try {
    const keys = [
      `contact_form:${clientIP}`,
      `contact_form_strict:${clientIP}`,
      `strict_mode:${clientIP}`,
    ];

    await Promise.all(keys.map(key => kv.del(key)));
  } catch (error) {
    console.error("Failed to reset rate limit:", error);
    throw error;
  }
}

// Get rate limit analytics
export async function getRateLimitAnalytics(): Promise<{
  totalRequests: number;
  blockedRequests: number;
  uniqueIPs: number;
}> {
  try {
    // This is a simplified analytics implementation
    // In a production environment, you might want more sophisticated analytics
    const analytics = await kv.get("rate_limit_analytics") || {
      totalRequests: 0,
      blockedRequests: 0,
      uniqueIPs: 0,
    };
    
    return analytics as any;
  } catch (error) {
    console.error("Failed to get rate limit analytics:", error);
    return {
      totalRequests: 0,
      blockedRequests: 0,
      uniqueIPs: 0,
    };
  }
}
