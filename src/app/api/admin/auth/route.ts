import crypto from "node:crypto";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { sessionStore } from "@/lib/admin-session-store";

// Use Node.js runtime for better compatibility with crypto and sessions
export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // Disable caching for auth routes

// Admin password hash from environment variable
// Production password: SuperSecure2025!@#
// Production hash: 082cd4aa5e67fc3734eb71336924b38eaa8bc8edab2fecb408396ba62ceda880
const ADMIN_PASSWORD_HASH =
  process.env["ADMIN_PASSWORD_HASH"] ||
  "082cd4aa5e67fc3734eb71336924b38eaa8bc8edab2fecb408396ba62ceda880";

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export async function POST(request: NextRequest) {
  try {
    // Use configured password hash
    const passwordHash = ADMIN_PASSWORD_HASH;

    if (!passwordHash) {
      console.error("[AUTH] ADMIN_PASSWORD_HASH not configured!");
      return NextResponse.json(
        {
          error: "Admin authentication not configured",
          details: "Please set ADMIN_PASSWORD_HASH environment variable"
        },
        { status: 503 }
      );
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