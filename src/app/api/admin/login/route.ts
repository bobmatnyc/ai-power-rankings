import { NextResponse } from "next/server";

// Clerk authentication is now used - redirect to sign-in page
export async function POST() {
  return NextResponse.json(
    {
      error: "Legacy login endpoint deprecated. Please use Clerk authentication.",
      redirect: "/sign-in"
    },
    { status: 410 } // Gone
  );
}