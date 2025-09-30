import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { loggers } from "@/lib/logger";

// In-memory settings store (in production, this could be stored in a database table or environment variables)
// These settings are application-level configurations, not typically stored with user data
let siteSettings = {
  algorithm_version: "v6.0",
  features: {
    news_ingestion: true,
    ai_analysis: true,
    auto_rankings: false,
  },
  updated_at: new Date().toISOString(),
};

export async function POST(request: NextRequest) {
  // Check admin authentication
  const authResult = await requireAdmin();
  if (authResult.error) {
    return authResult.error;
  }

  try {
    const body = await request.json();

    // Update settings with provided values
    siteSettings = {
      ...siteSettings,
      ...body,
      updated_at: new Date().toISOString(),
    };

    loggers.api.info("Site settings updated", { settings: siteSettings });

    return NextResponse.json({
      success: true,
      message: "Site settings updated successfully",
      settings: siteSettings,
    });
  } catch (error) {
    loggers.api.error("Error updating site settings:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update settings",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Check admin authentication
  const authResult = await requireAdmin();
  if (authResult.error) {
    return authResult.error;
  }

  try {
    return NextResponse.json({
      settings: siteSettings,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get settings" },
      { status: 500 }
    );
  }
}
