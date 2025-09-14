import crypto from "node:crypto";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

// Force Node.js runtime instead of Edge Runtime
export const runtime = "nodejs";

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
    // Parse JSON body
    const body = await request.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json({ error: "Password is required" }, { status: 400 });
    }

    // Hash the provided password and compare
    const hashedInput = hashPassword(password);
    const isValidPassword = hashedInput === ADMIN_PASSWORD_HASH;

    if (isValidPassword) {
      // Generate a secure session token
      const sessionToken = crypto.randomBytes(32).toString("hex");

      // Get the cookies store and set the session cookie
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
    } else {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }
  } catch (error) {
    console.error("[AUTH] Error processing request:", error);
    console.error("[AUTH] Error details:", {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json({
      error: "Authentication failed",
      details: process.env["NODE_ENV"] === "development" ? String(error) : undefined
    }, { status: 500 });
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