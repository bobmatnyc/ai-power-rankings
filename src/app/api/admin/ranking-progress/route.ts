import { type NextRequest, NextResponse } from "next/server";

// In-memory progress storage (for development)
// In production, you might want to use Redis or a database
let currentProgress = {
  message: "",
  tool: "",
  step: "",
  timestamp: Date.now(),
};

export async function GET() {
  return NextResponse.json({
    message: currentProgress.message,
    tool: currentProgress.tool,
    step: currentProgress.step,
    timestamp: currentProgress.timestamp,
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, tool, step } = body;

    currentProgress = {
      message: message || "",
      tool: tool || "",
      step: step || "",
      timestamp: Date.now(),
    };

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Progress update error:", error);
    return NextResponse.json({ error: "Failed to update progress" }, { status: 500 });
  }
}
