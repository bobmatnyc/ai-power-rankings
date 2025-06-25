import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPayload } from "payload";
import config from "@payload-config";
import { cookies } from "next/headers";

export async function GET() {
  try {
    // Get NextAuth session
    const session = await auth();

    if (!session?.user?.email || session.user.email !== "bob@matsuoka.com") {
      return NextResponse.redirect(
        new URL("/admin/auth/signin", process.env['NEXTAUTH_URL'] || "http://localhost:3000")
      );
    }

    // Get Payload instance
    const payload = await getPayload({ config });

    // Find or create user
    const { docs: existingUsers } = await payload.find({
      collection: "users",
      where: {
        email: { equals: session.user.email },
      },
      limit: 1,
    });

    let user = existingUsers[0];

    if (!user) {
      // Create user
      user = await payload.create({
        collection: "users",
        data: {
          email: session.user.email,
          name: session.user.name || session.user.email,
          password: `oauth-${Date.now()}`, // Random password
          role: "admin",
        },
      });
    }

    // Create Payload session token
    const token = await payload.login({
      collection: "users",
      data: {
        email: user['email'],
        password: user['password'],
      },
    });

    // Set Payload cookies
    const cookieStore = await cookies();
    if (token.token) {
      cookieStore.set("payload-token", token.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      });
    }

    // Redirect to admin
    return NextResponse.redirect(
      new URL("/admin", process.env['NEXTAUTH_URL'] || "http://localhost:3000")
    );
  } catch (error) {
    console.error("OAuth callback error:", error);
    return NextResponse.redirect(
      new URL("/admin/auth/signin", process.env['NEXTAUTH_URL'] || "http://localhost:3000")
    );
  }
}
