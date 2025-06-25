import { ToolsContent } from "./tools-content";
import { getDictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";
import { loggers } from "@/lib/logger";

interface Tool {
  id: string;
  name: string;
  category: string;
  status: "active" | "beta" | "deprecated" | "discontinued" | "acquired";
  description?: string | any[]; // Can be string or RichText array
  website?: string;
  website_url?: string;
  github_url?: string;
  info?: {
    links?: {
      website?: string;
    };
  };
}

interface PageProps {
  params: Promise<{ lang: Locale }>;
}

// Use dynamic rendering with optimized queries
export const dynamic = "force-dynamic";
// Consider ISR in the future: export const revalidate = 300;

export default async function ToolsPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { lang } = await params;
  const dict = await getDictionary(lang);
  // Fetch tools on the server
  let tools: Tool[] = [];
  let loading = false;

  try {
    // Fetch from the API endpoint which handles caching
    const baseUrl =
      process.env["NEXT_PUBLIC_PAYLOAD_URL"] ||
      (process.env["NODE_ENV"] === "production"
        ? "https://ai-power-rankings.vercel.app"
        : "http://localhost:3000");

    const response = await fetch(`${baseUrl}/api/tools`, {
      next: { revalidate: 300 }, // Cache for 5 minutes
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch tools: ${response.status}`);
    }

    const data = await response.json();
    tools = data.tools || [];

    loggers.tools.info(`Fetched ${tools.length} tools from API`, {
      cached: data._cached,
      cacheReason: data._cacheReason,
    });
  } catch (error) {
    loggers.tools.error("Failed to fetch tools from API", { error, lang });
    // The API should have returned cached data, but if it failed completely,
    // we'll show a loading state
    loading = true;
  }

  return <ToolsContent tools={tools} loading={loading} lang={lang} dict={dict} />;
}
