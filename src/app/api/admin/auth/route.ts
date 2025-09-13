import crypto from "node:crypto";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

// Static admin password - CHANGE THIS IN PRODUCTION!
const ADMIN_PASSWORD_HASH =
  process.env["ADMIN_PASSWORD_HASH"] ||
  // Default hash for "AIPowerRankings2025!" - MUST CHANGE IN PRODUCTION
  "81eaffa435589268fd13207632546cb3cf57a2e4a72667637de89d247aad6545";

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    let body: { password?: string };
    try {
      body = await request.json();
    } catch (parseError) {
      console.error("[AUTH] Failed to parse request body:", parseError);
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { password } = body;

    if (!password) {
      return NextResponse.json({ error: "Password is required" }, { status: 400 });
    }

    // Hash the provided password and compare
    const hashedInput = hashPassword(password);
    const isValidPassword = hashedInput === ADMIN_PASSWORD_HASH;

    if (isValidPassword) {
      try {
        // Generate a secure session token
        const sessionToken = crypto.randomBytes(32).toString("hex");

        // Get the cookies store and set the session cookie
        // In Next.js 15, cookies can only be set in Server Actions or Route Handlers
        const cookieStore = await cookies();
        cookieStore.set("admin-session", sessionToken, {
          httpOnly: true,
          secure: process.env["NODE_ENV"] === "production",
          sameSite: "lax",
          maxAge: 60 * 60 * 24, // 24 hours
          path: "/",
        });

        // Return success response
        return NextResponse.json(
          {
            success: true,
            message: "Authentication successful",
          },
          { status: 200 }
        );
      } catch (cookieError) {
        console.error("[AUTH] Error setting cookie:", cookieError);
        // Return generic error to avoid exposing internal details
        return NextResponse.json({ error: "Session creation failed" }, { status: 500 });
      }
    } else {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }
  } catch (error) {
    console.error("[AUTH] Unexpected auth error:", error);
    return NextResponse.json({ error: "Authentication failed" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    // Get the cookies store and delete the session cookie
    const cookieStore = await cookies();
    cookieStore.delete("admin-session");

    return NextResponse.json(
      {
        success: true,
        message: "Logged out successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[AUTH] Logout error:", error);
    return NextResponse.json({ error: "Logout failed" }, { status: 500 });
  }
}
