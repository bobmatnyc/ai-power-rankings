import { NextResponse } from "next/server";
import { getToolsRepo } from "@/lib/json-db";

export async function GET() {
  try {
    const toolsRepo = getToolsRepo();

    // Check for specific tools
    const toolsToCheck = ["gemini", "chatgpt"];
    const results: any = {};

    for (const toolName of toolsToCheck) {
      // Check by slug
      const bySlug = await toolsRepo.getBySlug(toolName);

      // Check by name
      const allTools = await toolsRepo.getAll();
      const byName = allTools.find((tool) => tool.name.toLowerCase() === toolName.toLowerCase());

      results[toolName] = {
        foundBySlug: !!bySlug,
        foundByName: !!byName,
        tool: bySlug || byName || null,
      };
    }

    return NextResponse.json(results);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
