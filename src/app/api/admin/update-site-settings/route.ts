import { NextRequest, NextResponse } from "next/server";
import { getPayloadHMR } from "@payloadcms/next/utilities";
import configPromise from "@payload-config";

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayloadHMR({ config: configPromise });

    // Get current site settings
    const currentSettings = await payload.findGlobal({
      slug: "site-settings",
    });

    // Update algorithm version to v6.0
    const updatedSettings = await payload.updateGlobal({
      slug: "site-settings",
      data: {
        ...currentSettings,
        algorithm_version: "v6.0",
        contact_email: currentSettings.contact_email || "contact@aipowerrankings.com",
      },
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
    const payload = await getPayloadHMR({ config: configPromise });

    const settings = await payload.findGlobal({
      slug: "site-settings",
    });

    return NextResponse.json({
      algorithm_version: settings.algorithm_version,
      settings: settings,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
