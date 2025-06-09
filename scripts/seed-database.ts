#!/usr/bin/env node

import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables!');
  console.error('Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
  process.exit(1);
}

// Create Supabase client with service role key for admin access
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkDatabaseState() {
  // Check if tools table exists and has data
  const { data, error } = await supabase
    .from('tools')
    .select('id')
    .limit(1);
  
  if (error) {
    if (error.message.includes('relation "public.tools" does not exist')) {
      return { exists: false, hasData: false };
    }
    throw error;
  }
  
  return { exists: true, hasData: (data?.length ?? 0) > 0 };
}

async function executeSqlFile(filePath: string) {
  const sql = readFileSync(filePath, 'utf-8');
  
  // Split by semicolons but preserve those within strings
  const statements = sql
    .split(/;(?=(?:[^']*'[^']*')*[^']*$)/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--') && !s.match(/^\/\*/));
  
  console.log(`📊 Found ${statements.length} SQL statements to execute\n`);
  
  let successful = 0;
  let failed = 0;
  const errors: string[] = [];
  
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    const preview = statement.substring(0, 60).replace(/\n/g, ' ') + '...';
    
    process.stdout.write(`[${i + 1}/${statements.length}] ${preview} `);
    
    try {
      // Use the SQL endpoint for raw SQL execution
      const { error } = await supabase.rpc('sql', {
        query: statement
      }).single();
      
      if (error) {
        // Try direct execution as fallback
        const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({ query: statement })
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }
        
        console.log('✅');
        successful++;
      } else {
        console.log('✅');
        successful++;
      }
    } catch (error) {
      console.log('❌');
      const errorMsg = `Statement ${i + 1}: ${(error as Error).message || error}`;
      console.error(`   Error: ${errorMsg}`);
      errors.push(errorMsg);
      failed++;
      
      // Continue on error for INSERT statements
      if (!statement.toUpperCase().startsWith('CREATE') && 
          !statement.toUpperCase().startsWith('ALTER')) {
        continue;
      }
    }
  }
  
  return { successful, failed, total: statements.length, errors };
}

async function seedDatabase() {
  console.log('🚀 AI Power Rankings - Database Seeding\n');
  
  try {
    // Check current database state
    console.log('Checking database status...');
    const dbState = await checkDatabaseState();
    
    if (!dbState.exists) {
      console.log('📭 Database schema not found!\n');
      console.log('Setting up database schema first...\n');
      
      // Execute schema file
      const schemaPath = join(process.cwd(), 'database/schema-complete.sql');
      console.log(`📄 Reading schema file: ${schemaPath}`);
      
      const schemaResult = await executeSqlFile(schemaPath);
      console.log('\n📈 Schema Setup Summary:');
      console.log(`   ✅ Successful: ${schemaResult.successful}`);
      console.log(`   ❌ Failed: ${schemaResult.failed}`);
      console.log(`   📊 Total: ${schemaResult.total}\n`);
      
      if (schemaResult.failed > 0) {
        console.error('⚠️  Some schema statements failed. Continuing with seed data...\n');
      }
    } else if (dbState.hasData) {
      console.log('⚠️  Database already contains data. Adding seed data...\n');
    } else {
      console.log('📬 Database schema exists but is empty. Perfect for seeding!\n');
    }
    
    // Execute seed data
    const seedPath = join(process.cwd(), 'docs/data/POPULATE.sql');
    console.log(`📄 Reading seed file: ${seedPath}`);
    
    const seedResult = await executeSqlFile(seedPath);
    
    console.log('\n📈 Seeding Summary:');
    console.log(`   ✅ Successful: ${seedResult.successful}`);
    console.log(`   ❌ Failed: ${seedResult.failed}`);
    console.log(`   📊 Total: ${seedResult.total}\n`);
    
    if (seedResult.errors.length > 0) {
      console.log('❌ Errors encountered:');
      seedResult.errors.slice(0, 5).forEach(err => console.log(`   - ${err}`));
      if (seedResult.errors.length > 5) {
        console.log(`   ... and ${seedResult.errors.length - 5} more errors`);
      }
      console.log('');
    }
    
    // Verify the results
    if (seedResult.successful > 0) {
      console.log('✅ Verifying seed data...\n');
      
      const { data: toolCount } = await supabase
        .from('tools')
        .select('id', { count: 'exact', head: true });
      
      const { data: rankingCount } = await supabase
        .from('ranking_cache')
        .select('id', { count: 'exact', head: true });
      
      const { data: topRankings } = await supabase
        .from('latest_rankings')
        .select('*')
        .order('position')
        .limit(5);
      
      console.log('📊 Database Contents:');
      console.log(`   Tools: ${toolCount || 0}`);
      console.log(`   Rankings: ${rankingCount || 0}`);
      console.log('');
      
      if (topRankings && topRankings.length > 0) {
        console.log('🏆 Current Top 5 Rankings:');
        topRankings.forEach((r) => {
          console.log(`   ${r.position}. ${r.tool_name} (${r.score.toFixed(2)})`);
        });
      }
      
      console.log('\n✨ Database seeding completed successfully!');
      console.log('\nYou can verify in Supabase Dashboard:');
      console.log(`   ${SUPABASE_URL.replace('.supabase.co', '.supabase.com')}/project/fukdwnsvjdgyakdvtdin/editor`);
    } else {
      console.log('❌ No statements were executed successfully.');
      console.log('   Please check your database connection and permissions.');
    }
    
  } catch (error) {
    console.error('\n❌ Fatal error:', (error as Error).message);
    process.exit(1);
  }
}

// Run the seeding
seedDatabase().catch(console.error);