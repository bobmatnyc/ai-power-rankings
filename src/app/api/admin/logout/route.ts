import { NextResponse } from "next/server";

// Clerk authentication is now used - no longer need custom logout
export async function POST() {
  return NextResponse.json(
    {
      success: true,
      message: "Please use Clerk sign-out functionality",
      redirect: "/sign-in"
    },
    { status: 200 }
  );
}

export async function GET() {
  return POST();
}