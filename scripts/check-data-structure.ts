#!/usr/bin/env tsx

import { getDb, closeDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

async function checkStructure() {
  const db = getDb();

  const copilot = await db.select().from(tools).where(eq(tools.slug, "github-copilot")).limit(1);

  if (!copilot[0]) {
    console.log("Copilot not found!");
    await closeDb();
    return;
  }

  console.log("\n=== Database Structure ===\n");
  console.log("tool.data is:", typeof copilot[0].data);
  console.log("Keys in tool.data:", Object.keys(copilot[0].data as any).slice(0, 10));

  const data = copilot[0].data as any;
  console.log("\nHas 'info' key:", 'info' in data);
  console.log("Has 'metrics' key:", 'metrics' in data);
  console.log("Has 'monthly_arr' at root:", 'monthly_arr' in data);

  if ('info' in data) {
    console.log("\ndata.info has 'metrics' key:", 'metrics' in data.info);
    if ('metrics' in data.info) {
      console.log("data.info.metrics has 'monthly_arr' key:", 'monthly_arr' in data.info.metrics);
      console.log("data.info.metrics.monthly_arr value:", data.info.metrics.monthly_arr);
    }
  }

  if ('metrics' in data && typeof data.metrics === 'object') {
    console.log("\ndata.metrics has 'monthly_arr' key:", 'monthly_arr' in data.metrics);
    console.log("data.metrics has 'vscode' key:", 'vscode' in data.metrics);
  }

  console.log("\n=== How generate-v73-rankings.ts structures it ===");
  const toolData = copilot[0].data as any;
  const metrics = {
    tool_id: copilot[0].id,
    name: copilot[0].name,
    slug: copilot[0].slug,
    category: copilot[0].category,
    status: copilot[0].status,
    info: toolData,  // This is what generate-v73-rankings.ts does
  };

  console.log("\nmetrics.info.metrics.monthly_arr:", metrics.info.metrics?.monthly_arr);
  console.log("This should be: 400000000");

  await closeDb();
}

checkStructure();
