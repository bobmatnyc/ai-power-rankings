#!/usr/bin/env node
import { closeDb, getDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

async function checkTool(toolName: string) {
  const db = getDb();
  if (!db) throw new Error("DB not connected");
  
  const result = await db.select().from(tools).where(eq(tools.name, toolName)).limit(1);
  
  if (result.length === 0) {
    console.log(`${toolName} not found`);
    return;
  }
  
  const tool = result[0];
  console.log(`\n=== ${toolName} ===`);
  console.log("Baseline Score:", JSON.stringify(tool.baselineScore, null, 2));
  console.log("\nDelta Score:", JSON.stringify(tool.deltaScore, null, 2));
  console.log("\nCurrent Score:", JSON.stringify(tool.currentScore, null, 2));
  console.log("\nScore Updated At:", tool.scoreUpdatedAt?.toISOString());
  
  await closeDb();
}

const toolName = process.argv[2] || "Claude Code";
checkTool(toolName).catch(console.error);
