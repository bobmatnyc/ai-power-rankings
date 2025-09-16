import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { sessionStore } from "@/lib/admin-session-store";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("admin-session");

    // Remove from session store if exists
    if (sessionToken?.value) {
      sessionStore.deleteSession(sessionToken.value);
    }

    // Delete the cookie
    cookieStore.delete("admin-session");

    console.log("[AUTH] Admin logout successful");

    return NextResponse.json(
      {
        success: true,
        message: "Logged out successfully",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[AUTH] Logout error:", error);
    // Still try to clear the cookie even if there's an error
    try {
      const cookieStore = await cookies();
      cookieStore.delete("admin-session");
    } catch {
      // Ignore cookie deletion errors
    }

    return NextResponse.json(
      {
        success: true,
        message: "Logged out",
      },
      { status: 200 }
    );
  }
}

// Also support GET for convenience
export async function GET() {
  return POST();
}