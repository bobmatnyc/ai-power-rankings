import { NextResponse } from "next/server";

// Clerk authentication is now used - redirect to sign-in page
export async function POST() {
  return NextResponse.json(
    {
      error: "Legacy authentication endpoint deprecated. Please use Clerk authentication.",
      redirect: "/sign-in",
    },
    { status: 410 } // Gone
  );
}

export async function DELETE() {
  // Clerk handles logout
  return NextResponse.json(
    {
      success: true,
      message: "Please use Clerk sign-out",
    },
    { status: 200 }
  );
}
