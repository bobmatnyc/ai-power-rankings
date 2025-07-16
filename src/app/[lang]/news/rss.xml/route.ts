import { NextResponse } from "next/server";
import type { Locale } from "@/i18n/config";
import { RSSGenerator } from "@/lib/rss-generator";

export async function GET(_request: Request, { params }: { params: Promise<{ lang: Locale }> }) {
  try {
    const { lang } = await params;
    const generator = new RSSGenerator();
    const rssXml = await generator.generateNewsFeed(lang);

    return new NextResponse(rssXml, {
      status: 200,
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=1800",
      },
    });
  } catch (error) {
    console.error("Failed to generate RSS feed:", error);
    return NextResponse.json({ error: "Failed to generate RSS feed" }, { status: 500 });
  }
}
