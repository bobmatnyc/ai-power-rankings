#!/usr/bin/env node

/**
 * Migration Runner Script
 *
 * Executes the monthly_summaries migration directly using postgres client.
 * This script loads .env.local and runs the SQL migration file.
 */

const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const migrationPath = path.join(__dirname, '..', 'lib', 'db', 'migrations', '0002_monthly_summaries.sql');

async function runMigration() {
  const sql = neon(process.env.DATABASE_URL);

  try {
    console.log('📖 Reading migration file...');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Split into individual statements (Neon doesn't support multiple commands)
    // Remove comments first, then split by semicolon
    const cleanedSQL = migrationSQL
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');

    const statements = cleanedSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    console.log(`🚀 Executing ${statements.length} migration statements...`);
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement) {
        console.log(`   [${i + 1}/${statements.length}] ${statement.substring(0, 50)}...`);
        await sql(statement);
      }
    }

    console.log('✅ Migration completed successfully!');
    console.log('   Table "monthly_summaries" created with indexes');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  }
}

runMigration()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
