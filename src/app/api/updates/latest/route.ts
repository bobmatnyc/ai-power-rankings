import { NextResponse } from "next/server";
import { UpdatesGenerator } from "@/lib/updates-generator";

export async function GET() {
  try {
    const generator = new UpdatesGenerator();
    const updates = await generator.generateUpdates();

    return NextResponse.json({
      success: true,
      data: updates,
    });
  } catch (error) {
    console.error("Error generating updates:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to generate updates",
      },
      { status: 500 }
    );
  }
}

// Enable CORS for this endpoint
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
