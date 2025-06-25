import { ToolsContent } from "./tools-content";
import { getDictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";
import { loggers } from "@/lib/logger";
import { getUrl } from "@/lib/get-url";

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

export default async function ToolsPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { lang } = await params;
  const dict = await getDictionary(lang);
  // Fetch tools on the server
  let tools: Tool[] = [];
  let loading = false;

  try {
    const isDev = process.env["NODE_ENV"] === "development";
    const baseUrl = getUrl();
    const response = await fetch(`${baseUrl}/api/tools`, {
      next: { revalidate: isDev ? 300 : 3600 }, // 5 min in dev, 1 hour in prod
      cache: isDev ? "no-store" : "default",
    });
    const data = await response.json();
    tools = data.tools;
  } catch (error) {
    loggers.tools.error("Failed to fetch tools", { error, lang });
    loading = true;
  }

  return <ToolsContent tools={tools} loading={loading} lang={lang} dict={dict} />;
}
