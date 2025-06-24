import { NextResponse } from "next/server";
import { payloadDirect } from "@/lib/payload-direct";
import { loggers } from "@/lib/logger";

export async function GET(): Promise<NextResponse> {
  try {
    const response = await payloadDirect.getTools({
      sort: "name",
      limit: 1000, // Get all tools
    });
    const tools = response.docs;

    if (!tools) {
      loggers.api.error("No tools found");
      return NextResponse.json({ error: "Failed to fetch tools" }, { status: 500 });
    }

    // Transform tools to match expected format with info structure
    const toolsWithInfo = tools.map((tool: any) => {
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

    const apiResponse = NextResponse.json({ tools: toolsWithInfo });

    // Set cache headers for production
    apiResponse.headers.set(
      "Cache-Control",
      process.env.NODE_ENV === "production"
        ? "public, s-maxage=3600, stale-while-revalidate=1800"
        : "no-cache"
    );

    return apiResponse;
  } catch (error) {
    loggers.api.error("Error in tools API", { error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
