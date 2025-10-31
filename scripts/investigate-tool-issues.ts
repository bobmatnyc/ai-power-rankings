/**
 * Investigation Script: Tool Entry Issues
 * Queries database to investigate reported tool problems
 */

import { getDb } from "../lib/db/connection";
import { tools } from "../lib/db/schema";
import { eq } from "drizzle-orm";

async function investigateToolIssues() {
  const db = getDb();
  if (!db) {
    console.error("❌ Database connection not available");
    return;
  }

  console.log("🔍 AI Power Rankings - Tool Entry Investigation\n");
  console.log("=" .repeat(80));

  // Issue 1: docker-compose-agents
  console.log("\n📋 ISSUE 1: docker-compose-agents");
  console.log("-".repeat(80));

  try {
    const dockerComposeTool = await db
      .select()
      .from(tools)
      .where(eq(tools.slug, "docker-compose-agents"))
      .limit(1);

    if (dockerComposeTool.length > 0) {
      const tool = dockerComposeTool[0];
      console.log("✓ Tool found in database");
      console.log("\nDatabase Entry:");
      console.log("  ID:", tool.id);
      console.log("  Slug:", tool.slug);
      console.log("  Name:", tool.name);
      console.log("  Category:", tool.category);
      console.log("  Status:", tool.status);
      console.log("  Company ID:", tool.companyId || "N/A");
      console.log("  Created:", tool.createdAt.toISOString());
      console.log("  Updated:", tool.updatedAt.toISOString());

      console.log("\nData JSONB:");
      console.log(JSON.stringify(tool.data, null, 2));

      // Analysis
      console.log("\n📊 Analysis:");
      const data = tool.data as any;
      if (data.info) {
        console.log("  - Has info object:", !!data.info);
        console.log("  - Description:", data.info.description?.substring(0, 100) || "N/A");
        console.log("  - Website:", data.info.website || "N/A");
        console.log("  - Logo URL:", data.info.logo_url || "N/A");
      }

      // Determine if it's a real tool
      console.log("\n💡 Recommendation:");
      if (tool.name.toLowerCase().includes("test") || tool.name.toLowerCase().includes("placeholder")) {
        console.log("  ⚠️  Appears to be test/placeholder data - RECOMMEND REMOVAL");
      } else if (!data.info?.website) {
        console.log("  ⚠️  Missing website information - needs verification");
      } else {
        console.log("  ✓ Appears to be legitimate tool");
      }
    } else {
      console.log("❌ Tool not found in database");
    }
  } catch (error) {
    console.error("Error querying docker-compose-agents:", error);
  }

  // Issue 2: Microsoft Agentic DevOps
  console.log("\n\n📋 ISSUE 2: Microsoft Agentic DevOps");
  console.log("-".repeat(80));

  try {
    const msAgenticTool = await db
      .select()
      .from(tools)
      .where(eq(tools.slug, "microsoft-agentic-devops"))
      .limit(1);

    if (msAgenticTool.length > 0) {
      const tool = msAgenticTool[0];
      console.log("✓ Tool found in database");
      console.log("\nDatabase Entry:");
      console.log("  ID:", tool.id);
      console.log("  Slug:", tool.slug);
      console.log("  Name:", tool.name);
      console.log("  Category:", tool.category);
      console.log("  Status:", tool.status);
      console.log("  Company ID:", tool.companyId || "N/A");
      console.log("  Created:", tool.createdAt.toISOString());
      console.log("  Updated:", tool.updatedAt.toISOString());

      console.log("\nData JSONB:");
      console.log(JSON.stringify(tool.data, null, 2));

      // Analysis - missing information
      console.log("\n📊 Missing Information Analysis:");
      const data = tool.data as any;
      const missing: string[] = [];

      if (!data.info?.logo_url) missing.push("Logo URL");
      if (!data.info?.website) missing.push("Website");
      if (!data.info?.description) missing.push("Description");
      if (!data.info?.launch_date) missing.push("Launch Date");
      if (!data.info?.pricing) missing.push("Pricing");
      if (!data.info?.features) missing.push("Features");

      if (missing.length > 0) {
        console.log("  Missing fields:", missing.join(", "));
      } else {
        console.log("  ✓ All fields present");
      }

      console.log("\n💡 Research Needed:");
      console.log("  - Verify official product name");
      console.log("  - Find logo from Microsoft");
      console.log("  - Determine relationship to GitHub Copilot");
      console.log("  - Gather launch date and status");
    } else {
      console.log("❌ Tool not found in database");
    }
  } catch (error) {
    console.error("Error querying microsoft-agentic-devops:", error);
  }

  // Issue 3: Goose
  console.log("\n\n📋 ISSUE 3: Goose Logo");
  console.log("-".repeat(80));

  try {
    const gooseTool = await db
      .select()
      .from(tools)
      .where(eq(tools.slug, "goose"))
      .limit(1);

    if (gooseTool.length > 0) {
      const tool = gooseTool[0];
      console.log("✓ Tool found in database");
      console.log("\nDatabase Entry:");
      console.log("  Name:", tool.name);
      console.log("  Category:", tool.category);

      const data = tool.data as any;
      console.log("  Current Logo:", data.info?.logo_url || "N/A");
      console.log("  Website:", data.info?.website || "N/A");

      console.log("\n💡 Logo Research:");
      console.log("  - Check: https://block.github.io/goose/");
      console.log("  - Check: https://github.com/block/goose");
      console.log("  - Expected format: PNG or SVG");
      console.log("  - Recommended size: 200x200px");
    } else {
      console.log("❌ Goose tool not found in database");
    }
  } catch (error) {
    console.error("Error querying goose:", error);
  }

  console.log("\n" + "=".repeat(80));
  console.log("\n✅ Investigation complete\n");
}

// Run the investigation
investigateToolIssues()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
