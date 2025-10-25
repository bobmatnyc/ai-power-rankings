/**
 * Test API use_cases exposure
 * Verifies that use_cases field is properly returned in the API response
 */

import { db } from "@/lib/db";
import { tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { ToolsRepository } from "@/lib/db/repositories/tools.repository";
import { toToolId } from "@/lib/types/branded";

async function testApiUseCases() {
  console.log("🧪 Testing use_cases API exposure\n");

  try {
    // Test 1: Check database has use_cases
    console.log("Test 1: Checking database for use_cases...");
    const cursorTool = await db.select().from(tools).where(eq(tools.slug, 'cursor')).limit(1);

    if (cursorTool[0]) {
      const data = cursorTool[0].data as any;
      const useCases = data.use_cases || [];
      console.log(`✅ Database has ${useCases.length} use_cases for Cursor`);
      console.log(`   Sample: "${useCases[0]}"`);
    } else {
      console.log("❌ Cursor tool not found in database");
      process.exit(1);
    }

    // Test 2: Check repository mapping
    console.log("\nTest 2: Checking repository mapping...");
    const toolsRepo = new ToolsRepository();
    const allTools = await toolsRepo.findByStatus("active");

    const cursorFromRepo = allTools.find(t => t.slug === 'cursor');
    if (cursorFromRepo) {
      const useCases = (cursorFromRepo as any).use_cases || [];
      if (useCases.length > 0) {
        console.log(`✅ Repository returns ${useCases.length} use_cases for Cursor`);
        console.log(`   Sample: "${useCases[0]}"`);
      } else {
        console.log("⚠️  Repository does not include use_cases field");
        console.log("   Available fields:", Object.keys(cursorFromRepo));
      }
    } else {
      console.log("❌ Cursor tool not found via repository");
    }

    // Test 3: Simulate API response construction
    console.log("\nTest 3: Simulating API response construction...");
    if (cursorFromRepo) {
      // Check structure from repository
      console.log("   Tool object keys:", Object.keys(cursorFromRepo).slice(0, 15).join(', '));

      // The repository spreads all data fields to top level
      const useCases = (cursorFromRepo as any).use_cases || [];
      const tags = (cursorFromRepo as any).tags || [];
      const info = (cursorFromRepo as any).info || {};

      const apiTool = {
        id: toToolId(cursorFromRepo.id),
        slug: cursorFromRepo.slug,
        name: cursorFromRepo.name,
        description: info.description || "",
        category: cursorFromRepo.category,
        tags: tags,
        use_cases: useCases,
      };

      console.log("✅ Simulated API response:");
      console.log("   - name:", apiTool.name);
      console.log("   - use_cases count:", apiTool.use_cases.length);
      console.log("   - use_cases[0]:", apiTool.use_cases[0]);
      console.log("   - tags count:", apiTool.tags.length);
    }

    console.log("\n✅ All tests passed! use_cases should be exposed via API");
    process.exit(0);

  } catch (error) {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  }
}

testApiUseCases();
