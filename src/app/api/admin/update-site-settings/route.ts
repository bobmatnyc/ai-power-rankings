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
  } catch (error: any) {
    console.error("Error updating site settings:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
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
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
