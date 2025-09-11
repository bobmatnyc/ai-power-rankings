#!/usr/bin/env tsx

/**
 * Test Payload CMS Connection
 *
 * Quick test to verify we can connect to Payload and read data
 */

// Load environment variables from .env files FIRST
import * as dotenv from 'dotenv';

// Load .env.local first (higher priority), then .env
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

import path from "node:path";
import { getPayload } from "payload";
import config from "../../payload.config";

async function testConnection() {
  try {
    console.log("Testing Payload CMS connection...");
    console.log("Database URL:", process.env["SUPABASE_DATABASE_URL"] ? "Found" : "Missing");

    // Get Payload instance
    const payload = await getPayload({ config });
    console.log("✅ Payload CMS connected successfully");

    // Test reading companies
    const { docs: companies } = await payload.find({
      collection: "companies",
      limit: 5,
    });
    console.log(`✅ Found ${companies.length} companies`);

    // Test reading tools
    const { docs: tools } = await payload.find({
      collection: "tools",
      limit: 5,
    });
    console.log(`✅ Found ${tools.length} tools`);

    // Test reading rankings
    const { docs: rankings } = await payload.find({
      collection: "rankings",
      limit: 5,
    });
    console.log(`✅ Found ${rankings.length} rankings`);

    // Test reading news
    const { docs: news } = await payload.find({
      collection: "news",
      limit: 5,
    });
    console.log(`✅ Found ${news.length} news articles`);

    console.log("🎉 All collections accessible");
  } catch (error) {
    console.error("❌ Connection test failed:", error);
    process.exit(1);
  }
}

testConnection();
