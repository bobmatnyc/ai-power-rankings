#!/usr/bin/env tsx

import { getDb, closeDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

async function testGetData() {
  const db = getDb();

  const copilot = await db.select().from(tools).where(eq(tools.slug, "github-copilot")).limit(1);

  if (!copilot[0]) {
    console.log("Copilot not found!");
    await closeDb();
    return;
  }

  const toolData = copilot[0].data as any;
  const metrics = {
    tool_id: copilot[0].id,
    name: copilot[0].name,
    slug: copilot[0].slug,
    category: copilot[0].category,
    status: copilot[0].status,
    info: toolData,  // This is the structure used by scripts
    metrics: toolData.metrics || {},
  };

  console.log("\n=== Testing getData() helper logic ===\n");
  console.log("metrics.info exists:", !!metrics.info);
  console.log("'info' in metrics.info:", 'info' in metrics.info);
  console.log("'metrics' in metrics.info:", 'metrics' in metrics.info);

  const hasDoubleNesting = metrics.info && 'info' in metrics.info;
  console.log("\nhasDoubleNesting:", hasDoubleNesting);

  if (hasDoubleNesting) {
    const info = (metrics.info as any).info;
    const metricsData = (metrics.info as any).metrics;

    console.log("\nExtracted info object:");
    console.log("  info.metrics.monthly_arr:", info?.metrics?.monthly_arr);

    console.log("\nExtracted metrics object:");
    console.log("  metricsData.vscode.installs:", metricsData?.vscode?.installs);
  }

  await closeDb();
}

testGetData();
