import { type NextRequest, NextResponse } from "next/server";
import { getSiteSettingsRepo } from "@/lib/json-db";

export async function POST(_request: NextRequest) {
  try {
    const siteSettingsRepo = getSiteSettingsRepo();

    // Update algorithm version to v6.0
    const updatedSettings = await siteSettingsRepo.updateSettings({
      algorithm_version: "v6.0",
    });

    return NextResponse.json({
      success: true,
      message: "Site settings updated successfully",
      algorithm_version: updatedSettings.algorithm_version,
    });
  } catch (error) {
    console.error("Error updating site settings:", error);
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
  try {
    const siteSettingsRepo = getSiteSettingsRepo();

    const settings = await siteSettingsRepo.getSettings();

    return NextResponse.json({
      algorithm_version: settings.algorithm_version,
      settings: settings,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get settings" },
      { status: 500 }
    );
  }
}
