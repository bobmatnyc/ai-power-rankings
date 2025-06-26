import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { loggers } from "@/lib/logger";
import { CacheManager } from "@/lib/cache/cache-manager";


export async function GET() {
  try {
    // Check authentication
    const session = await auth();
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const isAdmin = session.user.email === "bob@matsuoka.com";
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    // Get cache info from cache manager
    const cacheManager = new CacheManager();
    const cacheInfo = await cacheManager.getAllInfo();

    // Get current environment info
    const environment = {
      nodeEnv: process.env["NODE_ENV"],
      isVercel: !!process.env["VERCEL"],
      vercelEnv: process.env["VERCEL_ENV"],
      cacheEnabled: process.env["USE_CACHE_FALLBACK"] === "true",
    };

    return NextResponse.json({
      cacheFiles: Object.entries(cacheInfo).map(([type, info]) => ({
        type,
        source: info.source,
        exists: info.exists,
        size: info.size,
        lastModified: info.lastModified,
        blobMetadata: info.blobMetadata,
      })),
      environment,
      storage: {
        blobAvailable: CacheManager.isBlobAvailable(),
        blobToken: !!process.env["BLOB_READ_WRITE_TOKEN"],
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    loggers.api.error("Cache status error", { error });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get cache status" },
      { status: 500 }
    );
  }
}