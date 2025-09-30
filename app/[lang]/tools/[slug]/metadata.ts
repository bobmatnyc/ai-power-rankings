import type { Metadata } from "next";
import { ToolsRepository } from "@/lib/db/repositories/tools.repository";
import { generateToolMetadata as generateMetadataFromTool } from "@/lib/seo/utils";

export async function generateToolMetadata(slug: string): Promise<Metadata> {
  try {
    const toolsRepo = new ToolsRepository();
    const tool = await toolsRepo.findBySlug(slug);

    if (!tool) {
      return {
        title: "Tool Not Found",
        description: "The requested tool could not be found.",
      };
    }

    return generateMetadataFromTool(tool);
  } catch (error) {
    console.error("Error generating tool metadata:", error);
    return {
      title: "AI Power Rankings",
      description: "Compare and discover the best AI coding tools",
    };
  }
}