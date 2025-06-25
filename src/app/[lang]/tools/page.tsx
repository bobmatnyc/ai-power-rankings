import { ToolsContent } from "./tools-content";
import { getDictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";
import { loggers } from "@/lib/logger";
import { payloadDirect } from "@/lib/payload-direct";

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

// Use static generation with revalidation
export const revalidate = 3600; // Revalidate every hour

export default async function ToolsPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { lang } = await params;
  const dict = await getDictionary(lang);
  // Fetch tools on the server
  let tools: Tool[] = [];
  let loading = false;

  try {
    // Skip database calls during build phase
    if (process.env["NEXT_PHASE"] === "phase-production-build") {
      loggers.api.info("Skipping tools fetch during build phase");
      loading = true;
    } else {
      // Use direct database access
      const response = await payloadDirect.getTools({
        sort: "name",
        limit: 1000,
      });

      // Transform tools to match expected format
      tools = response.docs.map((tool: any) => {
        // Handle company - it might be populated or just an ID
        const companyName =
          typeof tool["company"] === "object" && tool["company"] ? tool["company"]["name"] : "";

        // Extract description text from rich text if needed
        let description = "";
        if (tool["description"] && Array.isArray(tool["description"])) {
          description = tool["description"]
            .map((block: any) => block.children?.map((child: any) => child.text).join(""))
            .join("\n");
        } else if (typeof tool["description"] === "string") {
          description = tool["description"];
        }

        return {
          ...tool,
          info: {
            company: { name: companyName },
            product: {
              description: description,
              tagline: tool["tagline"],
              pricing_model: tool["pricing_model"],
              license_type: tool["license_type"],
            },
            links: {
              website: tool["website_url"],
              github: tool["github_repo"],
            },
            metadata: {
              logo_url: tool["logo_url"],
            },
          },
        };
      });
    }
  } catch (error) {
    loggers.tools.error("Failed to fetch tools", { error, lang });
    loading = true;
  }

  return <ToolsContent tools={tools} loading={loading} lang={lang} dict={dict} />;
}
