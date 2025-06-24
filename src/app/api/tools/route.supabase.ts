import { NextResponse } from "next/server";
import { supabase } from "@/lib/database";
import { loggers } from "@/lib/logger";

export async function GET(): Promise<NextResponse> {
  try {
    const { data: tools, error } = await supabase.from("tools").select("*").order("name");

    if (error) {
      loggers.api.error("Error fetching tools", { error });
      return NextResponse.json({ error: "Failed to fetch tools" }, { status: 500 });
    }

    // Ensure all tools have proper info structure
    const toolsWithInfo = (tools || []).map((tool) => {
      if (!tool.info || typeof tool.info !== "object") {
        tool.info = {
          company: { name: tool.company_name || "" },
          product: {
            description: tool.description,
            tagline: tool.tagline,
            pricing_model: tool.pricing_model,
            license_type: tool.license_type,
          },
          links: {
            website: tool.website_url,
            github: tool.github_repo,
          },
          metadata: {
            logo_url: tool.logo_url,
          },
        };
      }
      return tool;
    });

    return NextResponse.json({ tools: toolsWithInfo });
  } catch (error) {
    loggers.api.error("Error in tools API", { error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
