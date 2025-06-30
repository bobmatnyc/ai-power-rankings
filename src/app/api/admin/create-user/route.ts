import { NextResponse } from "next/server";

export async function POST() {
  try {
    // User management is no longer needed with JSON repositories
    // Authentication is handled by NextAuth.js directly

    return NextResponse.json({
      message: "User creation not needed - using NextAuth.js for authentication",
      note: "JSON repositories don't require CMS user management",
      authentication: "Handled by NextAuth.js configuration",
    });
  } catch (error) {
    console.error("Error in create-user endpoint:", error);
    return NextResponse.json({ error: "Endpoint not available" }, { status: 500 });
  }
}
