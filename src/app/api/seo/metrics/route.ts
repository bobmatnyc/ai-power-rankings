import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { GoogleSearchConsole } from "@/lib/google-search-console";

// Mock data for development - will be replaced with real API integrations
const getMockSEOMetrics = () => {
  return {
    organicTraffic: 45820,
    trafficChange: 12.5,
    avgPosition: 8.2,
    positionChange: -2.1, // Negative is good (better position)
    topKeywords: [
      {
        keyword: "ai coding tools",
        position: 3,
        clicks: 2150,
        impressions: 8500,
      },
      {
        keyword: "cursor vs github copilot",
        position: 5,
        clicks: 1820,
        impressions: 12400,
      },
      {
        keyword: "best ai code assistant",
        position: 7,
        clicks: 1456,
        impressions: 15200,
      },
      {
        keyword: "ai power rankings",
        position: 1,
        clicks: 3200,
        impressions: 3800,
      },
      {
        keyword: "code generation tools",
        position: 12,
        clicks: 890,
        impressions: 6700,
      },
    ],
    coreWebVitals: {
      lcp: 1.8, // seconds
      fid: 45, // milliseconds
      cls: 0.05, // score
    },
    crawlErrors: 2,
    seoScore: 85,
    lastUpdated: new Date().toISOString(),
  };
};

// Fetch real Google Search Console data
async function fetchGoogleSearchConsoleData(accessToken?: string) {
  // Check if we have the required environment variables
  const siteUrl = process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL;

  if (!siteUrl) {
    console.log("Google Search Console site URL not configured, using mock data");
    return getMockSEOMetrics();
  }

  try {
    // Initialize Google Search Console client
    const gsc = new GoogleSearchConsole({
      siteUrl,
      accessToken, // Pass the OAuth token from the authenticated user
    });

    // Fetch various metrics
    const [siteMetrics, topQueries] = await Promise.all([
      gsc.getSiteMetrics(),
      gsc.getTopQueries(5),
      gsc.getTopPages(10), // We're not using topPages yet, but keeping for future use
    ]);

    // Transform the data to our format
    const topKeywords = (topQueries.rows || []).map((row: any) => ({
      keyword: row.keys[0],
      position: Math.round(row.position),
      clicks: Math.round(row.clicks),
      impressions: Math.round(row.impressions),
    }));

    return {
      organicTraffic: siteMetrics.current.clicks,
      trafficChange: siteMetrics.changes.clicks,
      avgPosition: siteMetrics.current.position,
      positionChange: siteMetrics.changes.position,
      topKeywords,
      coreWebVitals: {
        lcp: 1.8, // Still mock - would come from PageSpeed Insights API
        fid: 45,
        cls: 0.05,
      },
      crawlErrors: 0, // Would need additional API calls
      seoScore: calculateSEOScore(siteMetrics.current),
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error fetching Google Search Console data:", error);
    // Fall back to mock data
    return getMockSEOMetrics();
  }
}

// TODO: Implement Core Web Vitals data from PageSpeed Insights API
async function fetchCoreWebVitalsData() {
  // This will integrate with PageSpeed Insights API
  // For now, returning mock data as part of main metrics
  return {};
}

// TODO: Implement SEO score calculation based on various factors
function calculateSEOScore(_metrics: any) {
  // Algorithm to calculate overall SEO score based on:
  // - Search rankings
  // - Core Web Vitals
  // - Crawl errors
  // - Technical SEO factors
  // - Content optimization
  return 85; // Mock score
}

export async function GET() {
  try {
    // Get the session with access token
    const session = await auth();

    // Check authentication
    if (!session || session.user?.email !== "bob@matsuoka.com") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [searchConsoleData] = await Promise.all([
      fetchGoogleSearchConsoleData(session.accessToken),
      fetchCoreWebVitalsData(),
    ]);

    const seoScore = calculateSEOScore(searchConsoleData);

    const metrics = {
      ...searchConsoleData,
      seoScore,
      lastUpdated: new Date().toISOString(),
    };

    return NextResponse.json(metrics);
  } catch (error) {
    console.error("Error fetching SEO metrics:", error);
    return NextResponse.json({ error: "Failed to fetch SEO metrics" }, { status: 500 });
  }
}

export async function POST() {
  try {
    // Get the session with access token
    const session = await auth();

    // Check authentication
    if (!session || session.user?.email !== "bob@matsuoka.com") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Force refresh of SEO data
    const refreshedMetrics = await fetchGoogleSearchConsoleData(session.accessToken);

    return NextResponse.json({
      message: "SEO metrics refreshed successfully",
      data: refreshedMetrics,
    });
  } catch (error) {
    console.error("Error refreshing SEO metrics:", error);
    return NextResponse.json({ error: "Failed to refresh SEO metrics" }, { status: 500 });
  }
}
