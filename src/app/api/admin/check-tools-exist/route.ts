import { NextResponse } from "next/server";
import { getToolsRepo } from "@/lib/json-db";
import type { Tool } from "@/lib/json-db/schemas";

interface ToolCheckResult {
  foundBySlug: boolean;
  foundByName: boolean;
  tool: Tool | null;
}

export async function GET() {
  try {
    const toolsRepo = getToolsRepo();

    // Check for specific tools
    const toolsToCheck = ["gemini", "chatgpt"];
    const results: Record<string, ToolCheckResult> = {};

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
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
