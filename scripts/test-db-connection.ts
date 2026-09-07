#!/usr/bin/env node
// Load environment variables from .env files FIRST
import * as dotenv from "dotenv";

// Load .env.local first (higher priority), then .env
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import { Client } from "pg";

async function testConnection() {
  const connectionString = process.env.SUPABASE_DATABASE_URL;

  if (!connectionString) {
    console.error("❌ SUPABASE_DATABASE_URL is not set");
    process.exit(1);
  }

  // Parse the connection string to check details
  try {
    const url = new URL(connectionString);
    console.log("🔍 Database connection details:");
    console.log(`   Host: ${url.hostname}`);
    console.log(`   Port: ${url.port}`);
    console.log(`   Database: ${url.pathname.slice(1)}`);
    console.log(`   User: ${url.username}`);
    console.log(`   SSL: ${url.searchParams.get("sslmode") || "default"}`);

    // Check if it's using the pooler (port 6543) or direct connection (port 5432)
    if (url.port === "5432") {
      console.log("⚠️  Using direct connection (port 5432) - this might fail on serverless");
      console.log("   Consider using the pooler connection (port 6543) for Vercel");
    } else if (url.port === "6543") {
      console.log("✅ Using pooler connection (port 6543) - good for serverless");
    }
  } catch {
    console.error("❌ Invalid connection string format");
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log("\n🔄 Testing connection...");
    await client.connect();
    console.log("✅ Connected successfully!");

    // Test query
    const result = await client.query("SELECT current_database(), current_user, version()");
    console.log("\n📊 Database info:");
    console.log(`   Database: ${result.rows[0].current_database}`);
    console.log(`   User: ${result.rows[0].current_user}`);
    console.log(`   Version: ${result.rows[0].version.split(",")[0]}`);
  } catch (error) {
    const err = error as { message?: string; code?: string; severity?: string };
    console.error("\n❌ Connection failed:");
    console.error(`   Error: ${err.message}`);
    console.error(`   Code: ${err.code}`);
    console.error(`   Severity: ${err.severity}`);

    if (err.message?.includes("Tenant or user not found")) {
      console.error("\n💡 This error usually means:");
      console.error("   1. The database URL is incorrect");
      console.error("   2. You're using the wrong connection type (pooler vs direct)");
      console.error("   3. The database project doesn't exist");
      console.error('\n   For Vercel deployment, use the "Connection Pooler" URL from Supabase');
    }
  } finally {
    await client.end();
  }
}

testConnection().catch(console.error);
