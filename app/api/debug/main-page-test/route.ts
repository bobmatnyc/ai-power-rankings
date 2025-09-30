import { NextResponse } from "next/server";
import { getDictionary } from "@/i18n/get-dictionary";
import { getUrl } from "@/lib/get-url";

export async function GET() {
  const results: any[] = [];

  try {
    results.push({ step: "1. Environment", data: {
      NODE_ENV: process.env["NODE_ENV"],
      VERCEL_ENV: process.env["VERCEL_ENV"],
      HAS_BASE_URL: !!process.env["NEXT_PUBLIC_BASE_URL"],
      BASE_URL: process.env["NEXT_PUBLIC_BASE_URL"],
    }});

    // Test getUrl
    try {
      const url = getUrl();
      results.push({ step: "2. getUrl", success: true, url });
    } catch (error) {
      results.push({ step: "2. getUrl", success: false, error: String(error) });
    }

    // Test dictionary
    try {
      const dict = await getDictionary("en");
      results.push({ step: "3. Dictionary", success: true, keys: Object.keys(dict) });
    } catch (error) {
      results.push({ step: "3. Dictionary", success: false, error: String(error) });
    }

    // Test fetching tools
    try {
      const baseUrl = getUrl();
      if (baseUrl) {
        const response = await fetch(`${baseUrl}/api/tools`, {
          signal: AbortSignal.timeout(3000),
        });
        const data = await response.json();
        results.push({ step: "4. Tools API", success: true, count: data.tools?.length || 0 });
      } else {
        results.push({ step: "4. Tools API", success: false, error: "No base URL" });
      }
    } catch (error) {
      results.push({ step: "4. Tools API", success: false, error: String(error) });
    }

    // Test rankings API
    try {
      const response = await fetch(`${getUrl()}/api/rankings`, {
        signal: AbortSignal.timeout(3000),
      });
      const data = await response.json();
      results.push({ step: "5. Rankings API", success: true, source: data._source });
    } catch (error) {
      results.push({ step: "5. Rankings API", success: false, error: String(error) });
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      results,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: String(error),
      stack: error instanceof Error ? error.stack : undefined,
      results,
    }, { status: 500 });
  }
}