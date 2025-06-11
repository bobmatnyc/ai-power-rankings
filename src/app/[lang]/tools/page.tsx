import { ToolsContent } from "./tools-content";
import { getDictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";

interface Tool {
  id: string;
  name: string;
  category: string;
  status: "active" | "beta" | "deprecated" | "discontinued" | "acquired";
  description?: string;
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
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const response = await fetch(`${baseUrl}/api/tools`, {
      next: { revalidate: 3600 }, // Cache for 1 hour
    });
    const data = await response.json();
    tools = data.tools;
  } catch (error) {
    console.error("Failed to fetch tools:", error);
    loading = true;
  }

  return <ToolsContent tools={tools} loading={loading} lang={lang} dict={dict} />;
}
