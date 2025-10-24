import type { Metadata } from "next";
import type { Tool } from "@/types/database";
import { ToolsRepository } from "@/lib/db/repositories/tools.repository";
import { generateToolMetadata as generateMetadataFromTool } from "@/lib/seo/utils";

export async function generateToolMetadata(slug: string): Promise<Metadata> {
  try {
    const toolsRepo = new ToolsRepository();
    const toolData = await toolsRepo.findBySlug(slug);

    if (!toolData) {
      return {
        title: "Tool Not Found",
        description: "The requested tool could not be found.",
      };
    }

    // Map ToolData to Tool type
    const tool: Tool = {
      id: toolData.id,
      slug: toolData.slug,
      name: toolData.name,
      description: (toolData.info as any)?.product?.description as string | undefined,
      category: toolData.category,
      status: toolData.status as "active" | "inactive" | "deprecated" | "discontinued",
      created_at: toolData.created_at || new Date().toISOString(),
      updated_at: toolData.updated_at || new Date().toISOString(),
      tags: toolData.tags,
      info: toolData.info as any,
    };

    return generateMetadataFromTool(tool);
  } catch (error) {
    console.error("Error generating tool metadata:", error);
    return {
      title: "AI Power Rankings",
      description: "Compare and discover the best AI coding tools",
    };
  }
}