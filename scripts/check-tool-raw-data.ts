#!/usr/bin/env tsx
/**
 * Check raw tool data for Cursor and GitHub Copilot to see what metrics are available
 */

import { getDb, closeDb } from '../lib/db/connection';
import { tools } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

async function checkToolData() {
  const db = getDb();
  if (!db) {
    console.log('❌ No database connection');
    process.exit(1);
  }

  try {
    // Check Cursor
    const cursor = await db.select().from(tools).where(eq(tools.slug, 'cursor')).limit(1);
    if (cursor.length > 0) {
      console.log('\n📊 CURSOR - Raw Tool Data:\n');
      console.log('Tool ID:', cursor[0].id);
      console.log('Name:', cursor[0].name);
      console.log('Category:', cursor[0].category);
      console.log('Status:', cursor[0].status);
      console.log('\nData Field:');
      console.log(JSON.stringify(cursor[0].data, null, 2));
      console.log('\n' + '='.repeat(80) + '\n');
    }

    // Check GitHub Copilot
    const copilot = await db.select().from(tools).where(eq(tools.slug, 'github-copilot')).limit(1);
    if (copilot.length > 0) {
      console.log('📊 GITHUB COPILOT - Raw Tool Data:\n');
      console.log('Tool ID:', copilot[0].id);
      console.log('Name:', copilot[0].name);
      console.log('Category:', copilot[0].category);
      console.log('Status:', copilot[0].status);
      console.log('\nData Field:');
      console.log(JSON.stringify(copilot[0].data, null, 2));
      console.log('\n' + '='.repeat(80) + '\n');
    }

    // Check Goose
    const goose = await db.select().from(tools).where(eq(tools.slug, 'goose')).limit(1);
    if (goose.length > 0) {
      console.log('🦆 GOOSE - Raw Tool Data:\n');
      console.log('Tool ID:', goose[0].id);
      console.log('Name:', goose[0].name);
      console.log('Category:', goose[0].category);
      console.log('Status:', goose[0].status);
      console.log('\nData Field:');
      console.log(JSON.stringify(goose[0].data, null, 2));
      console.log('\n' + '='.repeat(80) + '\n');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await closeDb();
  }
}

checkToolData();
