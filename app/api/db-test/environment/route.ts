import { NextResponse } from "next/server";

export async function GET() {
  try {
    const nodeEnv = process.env["NODE_ENV"];
    const useDatabase = process.env["USE_DATABASE"];
    const databaseUrl = process.env["DATABASE_URL"];
    const databaseUrlDev = process.env["DATABASE_URL_DEVELOPMENT"];

    // Check which URL would be used based on environment
    let activeUrl: string | undefined;
    let activeSource = "";

    if (nodeEnv === "development") {
      if (databaseUrlDev && !databaseUrlDev.includes("YOUR_PASSWORD")) {
        activeUrl = databaseUrlDev;
        activeSource = "DATABASE_URL_DEVELOPMENT";
      } else if (databaseUrl && !databaseUrl.includes("YOUR_PASSWORD")) {
        activeUrl = databaseUrl;
        activeSource = "DATABASE_URL (fallback)";
      }
    } else {
      if (databaseUrl && !databaseUrl.includes("YOUR_PASSWORD")) {
        activeUrl = databaseUrl;
        activeSource = "DATABASE_URL";
      }
    }

    const hasValidUrl = !!activeUrl;
    const endpoint = activeUrl ? activeUrl.split("@")[1]?.split("-pooler")[0] : "none";

    return NextResponse.json({
      NODE_ENV: nodeEnv,
      USE_DATABASE: useDatabase,
      DATABASE_URL_EXISTS: !!databaseUrl,
      DATABASE_URL_DEV_EXISTS: !!databaseUrlDev,
      ACTIVE_SOURCE: activeSource,
      ACTIVE_ENDPOINT: endpoint,
      HAS_VALID_URL: hasValidUrl,
      SHOULD_CONNECT: useDatabase === "true" && hasValidUrl,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
