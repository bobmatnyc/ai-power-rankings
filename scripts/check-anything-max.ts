#!/usr/bin/env node

import { closeDb, getDb } from "@/lib/db/connection";
import { tools } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

async function checkAnythingMax() {
  try {
    const db = getDb();
    const result = await db.select().from(tools).where(eq(tools.slug, 'anything-max'));

    if (result.length > 0) {
      const tool = result[0];
      console.log('Tool:', tool.name);
      console.log('Slug:', tool.slug);
      console.log('Category:', tool.category);
      console.log('Data:', JSON.stringify(tool.data, null, 2));
    } else {
      console.log('Tool not found');
    }
  } finally {
    await closeDb();
  }
}

checkAnythingMax();
