import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { GoogleSearchConsole } from "@/lib/google-search-console";

export async function POST() {
  try {
    // Check authentication using Clerk
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const siteUrl = process.env["GOOGLE_SEARCH_CONSOLE_SITE_URL"];
    const baseUrl = process.env["NEXT_PUBLIC_BASE_URL"] || "https://aipowerranking.com";

    if (!siteUrl) {
      return NextResponse.json(
        { error: "Google Search Console site URL not configured" },
        { status: 500 }
      );
    }

    // Initialize Google Search Console - will use service account authentication instead of OAuth
    const gsc = new GoogleSearchConsole({
      siteUrl,
    });

    // Submit sitemap
    await gsc.submitSitemap(`${baseUrl}/sitemap.xml`);

    // Get current sitemaps
    const sitemaps = await gsc.getSitemaps();

    return NextResponse.json({
      success: true,
      message: "Sitemap submitted successfully",
      sitemaps,
    });
  } catch (error) {
    console.error("Error submitting sitemap:", error);
    return NextResponse.json(
      {
        error: "Failed to submit sitemap",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
