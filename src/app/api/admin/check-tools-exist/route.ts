import { NextResponse } from "next/server";
import { getPayloadClient } from "@/lib/payload-direct";

export async function GET() {
  try {
    const payload = await getPayloadClient();

    // Check for specific tools
    const toolsToCheck = ["gemini", "chatgpt"];
    const results: any = {};

    for (const toolName of toolsToCheck) {
      // Check by slug
      const { docs: bySlug } = await payload.find({
        collection: "tools",
        where: {
          slug: { equals: toolName },
        },
        limit: 1,
      });

      // Check by name
      const { docs: byName } = await payload.find({
        collection: "tools",
        where: {
          name: { equals: toolName },
        },
        limit: 1,
      });

      results[toolName] = {
        foundBySlug: bySlug.length > 0,
        foundByName: byName.length > 0,
        tool: bySlug[0] || byName[0] || null,
      };
    }

    return NextResponse.json(results);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
