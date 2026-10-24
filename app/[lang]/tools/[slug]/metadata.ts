import type { Metadata } from "next";
import type { Tool } from "@/types/database";
import { findToolBySlug } from "@/lib/tools/tool-page-request";
import { generateToolMetadata as generateMetadataFromTool } from "@/lib/seo/utils";

interface ToolInfo {
  product?: {
    description?: string;
  };
  [key: string]: unknown;
}

export async function generateToolMetadata(slug: string, lang: string): Promise<Metadata> {
  try {
    const toolData = await findToolBySlug(slug);

    if (!toolData) {
      // #193: the page answers 404 for this slug; keep it out of the index.
      return {
        title: "Tool Not Found",
        description: "The requested tool could not be found.",
        robots: { index: false, follow: true },
      };
    }

    // Map ToolData to Tool type
    const tool: Tool = {
      id: toolData.id,
      slug: toolData.slug,
      name: toolData.name,
      description: (toolData.info as ToolInfo)?.product?.description,
      category: toolData.category,
      status: toolData.status as "active" | "inactive" | "deprecated" | "discontinued",
      created_at: toolData.created_at || new Date().toISOString(),
      updated_at: toolData.updated_at || new Date().toISOString(),
      tags: toolData.tags,
      info: toolData.info as ToolInfo,
    };

    // #156: the locale builds the page's own canonical, og:url and hreflang.
    return generateMetadataFromTool(tool, lang);
  } catch (error) {
    console.error("Error generating tool metadata:", error);
    return {
      title: "AI Power Rankings",
      description: "Compare and discover the best AI coding tools",
    };
  }
}
