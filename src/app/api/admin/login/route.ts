import crypto from "node:crypto";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { sessionStore } from "@/lib/admin-session-store";

// Admin password hash from environment or fallback
// Current production hash: 082cd4aa5e67fc3734eb71336924b38eaa8bc8edab2fecb408396ba62ceda880
// This is for password: SuperSecure2025!@#
const ADMIN_PASSWORD_HASH =
  process.env["ADMIN_PASSWORD_HASH"] ||
  "082cd4aa5e67fc3734eb71336924b38eaa8bc8edab2fecb408396ba62ceda880";

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
      // Create session in the session store
      const sessionToken = sessionStore.createSession();

      // Get the cookies store and set the session cookie
      const cookieStore = await cookies();
      cookieStore.set("admin-session", sessionToken, {
        httpOnly: true,
        secure: process.env["NODE_ENV"] === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24, // 24 hours
        path: "/",
      });

      // Log successful authentication (without exposing sensitive data)
      console.log("[AUTH] Admin authentication successful");

      return NextResponse.json(
        {
          success: true,
          message: "Authentication successful",
        },
        { status: 200 }
      );
    } else {
      // Log failed authentication attempt (for security monitoring)
      console.warn("[AUTH] Failed authentication attempt");
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }
  } catch (error) {
    console.error("[AUTH] Login error:", error);
    // Don't expose internal error details in production
    const message = process.env["NODE_ENV"] === "development"
      ? `Authentication failed: ${error}`
      : "Authentication failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}