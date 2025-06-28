import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    message: "Endpoint not available with JSON repositories",
    note: "This endpoint requires additional repositories (metrics, rankings periods) to be implemented",
    status: "stubbed"
  });
}

export async function POST(_request: NextRequest) {
  return NextResponse.json({
    success: false,
    message: "Endpoint not available with JSON repositories", 
    note: "This endpoint requires additional repositories (metrics, rankings periods) to be implemented",
    status: "stubbed"
  });
}
