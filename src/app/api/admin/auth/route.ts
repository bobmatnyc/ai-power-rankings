import crypto from "node:crypto";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { sessionStore } from "@/lib/admin-session-store";

// Force Node.js runtime instead of Edge Runtime
export const runtime = "nodejs";

// Admin password hash from environment variable
// CRITICAL: Set ADMIN_PASSWORD_HASH in production!
// Generate with: echo -n "your-secure-password" | sha256sum
const ADMIN_PASSWORD_HASH = process.env["ADMIN_PASSWORD_HASH"];

// Only allow a default in development for easier testing
// This default will NOT work in production
const DEFAULT_DEV_HASH =
  process.env["NODE_ENV"] === "development"
    ? "81eaffa435589268fd13207632546cb3cf57a2e4a72667637de89d247aad6545" // "AIPowerRankings2025!"
    : null;

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export async function POST(request: NextRequest) {
  try {
    // Check if password hash is configured
    const passwordHash = ADMIN_PASSWORD_HASH || DEFAULT_DEV_HASH;

    if (!passwordHash) {
      console.error("[AUTH] ADMIN_PASSWORD_HASH not configured in production!");
      return NextResponse.json(
        {
          error: "Admin authentication not configured",
          details: "Please set ADMIN_PASSWORD_HASH environment variable"
        },
        { status: 503 }
      );
    }

    // Warn if using default in development
    if (passwordHash === DEFAULT_DEV_HASH && process.env["NODE_ENV"] === "development") {
      console.warn("[AUTH] Using default development password. Set ADMIN_PASSWORD_HASH for production.");
    }

    // Parse JSON body
    const body = await request.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json({ error: "Password is required" }, { status: 400 });
    }

    // Hash the provided password and compare
    const hashedInput = hashPassword(password);
    const isValidPassword = hashedInput === passwordHash;

    if (isValidPassword) {
      // Create a new session in the store
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

      // Return success response
      return NextResponse.json(
        {
          success: true,
          message: "Authentication successful",
        },
        { status: 200 }
      );
    } else {
      // Log failed attempts in production for security monitoring
      if (process.env["NODE_ENV"] === "production") {
        console.warn("[AUTH] Failed login attempt");
      }
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
    // Get the cookies store
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("admin-session");

    // Remove session from store if exists
    if (sessionToken?.value) {
      sessionStore.deleteSession(sessionToken.value);
    }

    // Delete the session cookie
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