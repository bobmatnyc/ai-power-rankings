import crypto from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";

// Static admin password - CHANGE THIS IN PRODUCTION!
const ADMIN_PASSWORD_HASH =
  process.env["ADMIN_PASSWORD_HASH"] ||
  // Default hash for "AIPowerAdmin2025!" - MUST CHANGE IN PRODUCTION
  "8b4a6f1e9c2d5a3b7e8f9d1c4a6b8e3f5d7a9c2e4b6d8f1a3c5e7b9d2f4a6c8e";

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
        path: "/admin",
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
