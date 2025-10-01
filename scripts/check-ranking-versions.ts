#!/usr/bin/env tsx

import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

async function checkRankingVersionsTable() {
  const PROD_DATABASE_URL = process.env.PROD_DATABASE_URL || process.env.DATABASE_URL;
  const DEV_DATABASE_URL = process.env.DATABASE_URL_DEVELOPMENT || process.env.DATABASE_URL;

  const prodSql = neon(PROD_DATABASE_URL);
  const devSql = neon(DEV_DATABASE_URL);

  console.log("\n🔍 Checking for ranking_versions table\n");

  try {
    const prodCheck = await prodSql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'ranking_versions'
      );
    `;
    const prodExists = prodCheck[0].exists;
    console.log(`Production:  ${prodExists ? '✅ EXISTS' : '❌ DOES NOT EXIST'}`);

    const devCheck = await devSql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'ranking_versions'
      );
    `;
    const devExists = devCheck[0].exists;
    console.log(`Development: ${devExists ? '✅ EXISTS' : '❌ DOES NOT EXIST'}`);

    console.log("\n");
  } catch (error) {
    console.error("Error:", error);
  }
}

checkRankingVersionsTable();
