#!/usr/bin/env npx ts-node
/**
 * Query monthly summaries from database
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { desc } from "drizzle-orm";
import { getDb } from "../lib/db/connection";
import { monthlySummaries, stateOfAiSummaries } from "../lib/db/schema";

async function check() {
  console.log("=== Checking Monthly Summaries ===\n");

  const db = getDb();
  if (!db) {
    console.error("Failed to get database connection");
    process.exit(1);
  }

  try {
    console.log("1. Monthly Summaries (monthly_summaries table):\n");
    const whatsNewSummaries = await db
      .select({
        id: monthlySummaries.id,
        period: monthlySummaries.period,
        generatedAt: monthlySummaries.generatedAt,
        dataHash: monthlySummaries.dataHash,
      })
      .from(monthlySummaries)
      .orderBy(desc(monthlySummaries.period))
      .limit(5);

    if (whatsNewSummaries.length === 0) {
      console.log("   No monthly summaries found.\n");
    } else {
      console.log(JSON.stringify(whatsNewSummaries, null, 2));
    }

    console.log("\n2. State of AI Summaries (state_of_ai_summaries table):\n");
    const stateOfAi = await db
      .select({
        id: stateOfAiSummaries.id,
        month: stateOfAiSummaries.month,
        year: stateOfAiSummaries.year,
        generatedAt: stateOfAiSummaries.generatedAt,
        generatedBy: stateOfAiSummaries.generatedBy,
      })
      .from(stateOfAiSummaries)
      .orderBy(desc(stateOfAiSummaries.year), desc(stateOfAiSummaries.month))
      .limit(5);

    if (stateOfAi.length === 0) {
      console.log("   No State of AI summaries found.\n");
    } else {
      console.log(JSON.stringify(stateOfAi, null, 2));
    }
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }

  process.exit(0);
}

check();

// Also get content preview
async function checkContent() {
  const db = getDb();
  if (!db) return;

  const summary = await db
    .select({
      period: monthlySummaries.period,
      content: monthlySummaries.content,
      metadata: monthlySummaries.metadata,
    })
    .from(monthlySummaries)
    .orderBy(desc(monthlySummaries.period))
    .limit(1);

  if (summary.length > 0) {
    console.log("\n3. Latest Monthly Summary Content Preview:\n");
    console.log("   Period:", summary[0].period);
    console.log("   Metadata:", JSON.stringify(summary[0].metadata, null, 2));
    console.log("   Content preview (first 500 chars):");
    console.log("   ", summary[0].content?.substring(0, 500));
  }
}
