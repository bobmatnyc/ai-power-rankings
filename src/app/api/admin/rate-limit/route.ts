import { type NextRequest, NextResponse } from "next/server";
import {
  getRateLimitAnalytics,
  resetRateLimit,
  getRateLimitStatus,
  getClientIP,
} from "@/lib/rate-limit";
import { z } from "zod";

// Admin authentication check
function isAuthenticated(request: NextRequest): boolean {
  // In a real implementation, you'd check JWT tokens or session
  // For now, we'll use a simple API key approach
  const authHeader = request.headers.get("authorization");
  const apiKey = process.env["ADMIN_API_KEY"];

  if (!apiKey) {
    console.warn("ADMIN_API_KEY not configured");
    return false;
  }

  return authHeader === `Bearer ${apiKey}`;
}

// Schema for reset rate limit request
const resetRateLimitSchema = z.object({
  ip: z.string().min(1, "IP address is required"),
});

// Schema for check rate limit request (currently unused but kept for future use)
// const checkRateLimitSchema = z.object({
//   ip: z.string().optional(),
//   email: z.string().email().optional(),
// });

// GET /api/admin/rate-limit - Get rate limit analytics
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    if (!isAuthenticated(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get("action");

    if (action === "analytics") {
      // Get analytics
      const analytics = await getRateLimitAnalytics();
      return NextResponse.json({
        success: true,
        data: analytics,
      });
    } else if (action === "status") {
      // Get rate limit status for specific IP or current request
      const ip = searchParams.get("ip");
      const email = searchParams.get("email");

      let targetRequest = request;
      if (ip) {
        // Create a mock request with the specified IP
        targetRequest = {
          ...request,
          headers: new Headers({
            ...Object.fromEntries(request.headers.entries()),
            "x-forwarded-for": ip,
          }),
        } as NextRequest;
      }

      const status = await getRateLimitStatus(targetRequest, email || undefined);
      return NextResponse.json({
        success: true,
        data: {
          ip: ip || getClientIP(request),
          email: email || null,
          rateLimit: status,
        },
      });
    } else {
      return NextResponse.json(
        { error: "Invalid action. Use 'analytics' or 'status'" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Admin rate limit GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/admin/rate-limit - Reset rate limit for IP
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    if (!isAuthenticated(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get("action");

    if (action === "reset") {
      // Reset rate limit for specific IP
      const validationResult = resetRateLimitSchema.safeParse(body);
      if (!validationResult.success) {
        return NextResponse.json(
          {
            error: "Invalid request data",
            details: validationResult.error.flatten(),
          },
          { status: 400 }
        );
      }

      const { ip } = validationResult.data;
      await resetRateLimit(ip);

      return NextResponse.json({
        success: true,
        message: `Rate limit reset for IP: ${ip}`,
        data: { ip },
      });
    } else {
      return NextResponse.json({ error: "Invalid action. Use 'reset'" }, { status: 400 });
    }
  } catch (error) {
    console.error("Admin rate limit POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT /api/admin/rate-limit - Update rate limit configuration (future enhancement)
export async function PUT(request: NextRequest) {
  try {
    // Check authentication
    if (!isAuthenticated(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // This could be used to dynamically update rate limit configurations
    // For now, return not implemented
    return NextResponse.json(
      { error: "Dynamic rate limit configuration not implemented yet" },
      { status: 501 }
    );
  } catch (error) {
    console.error("Admin rate limit PUT error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
