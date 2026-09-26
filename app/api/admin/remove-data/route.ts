import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";

export async function GET() {
  // Check admin authentication
  const authResult = await requireAdmin();
  if (authResult.error) {
    return authResult.error;
  }

  return NextResponse.json({
    message: "Endpoint not available with JSON repositories",
    note: "This endpoint requires additional repositories (metrics, rankings periods) to be implemented",
    status: "stubbed",
  });
}

export async function POST(_request: NextRequest) {
  // Check admin authentication
  const authResult = await requireAdmin();
  if (authResult.error) {
    return authResult.error;
  }

  return NextResponse.json({
    success: false,
    message: "Endpoint not available with JSON repositories",
    note: "This endpoint requires additional repositories (metrics, rankings periods) to be implemented",
    status: "stubbed",
  });
}
