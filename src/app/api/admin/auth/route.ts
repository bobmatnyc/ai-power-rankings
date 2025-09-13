import crypto from "node:crypto";
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
    const { password } = await request.json();

    if (!password) {
      return NextResponse.json({ error: "Password is required" }, { status: 400 });
    }

    // Hash the provided password and compare
    const hashedInput = hashPassword(password);

    if (hashedInput === ADMIN_PASSWORD_HASH) {
      // Set a secure session token
      const sessionToken = crypto.randomBytes(32).toString("hex");

      const response = NextResponse.json(
        { success: true, message: "Authentication successful" },
        { status: 200 }
      );

      // Set a secure HTTP-only cookie for the session
      response.cookies.set("admin-session", sessionToken, {
        httpOnly: true,
        secure: process.env["NODE_ENV"] === "production",
        sameSite: "strict",
        maxAge: 60 * 60 * 24, // 24 hours
        path: "/", // Allow cookie for all paths including /api/admin
      });

      return response;
    } else {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }
  } catch (error) {
    console.error("Auth error:", error);
    return NextResponse.json({ error: "Authentication failed" }, { status: 500 });
  }
}

export async function DELETE() {
  // Logout endpoint
  const response = NextResponse.json({ success: true, message: "Logged out" }, { status: 200 });

  // Clear the session cookie
  response.cookies.delete("admin-session");

  return response;
}
