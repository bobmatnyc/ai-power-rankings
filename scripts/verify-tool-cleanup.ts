import { getDb } from '../lib/db/connection';
import { tools } from '../lib/db/schema';
import { count, eq } from 'drizzle-orm';

async function verifyToolCleanup() {
  console.log('🔍 Tool Cleanup Verification\n');
  console.log('=' .repeat(80));

  const db = getDb();
  if (!db) {
    throw new Error('Database connection failed');
  }

  // Count total tools
  const totalResult = await db.select({ count: count() }).from(tools);
  const totalTools = totalResult[0].count;

  console.log(`\n📊 Total tools in database: ${totalTools}`);
  console.log(`✅ Expected: 46 (56 - 10 deleted)`);
  console.log(`${totalTools === 46 ? '✅ PASS' : '❌ FAIL'}: Tool count matches expected\n`);

  // List all tools
  const allTools = await db.select({ slug: tools.slug, name: tools.name }).from(tools);
  console.log('📋 All tools in database:');
  allTools.forEach((tool, i) => {
    console.log(`   ${i + 1}. ${tool.slug} - ${tool.name}`);
  });

  // Check if deleted tools are gone
  const deletedTools = [
    'gpt-models',
    'gitlab',
    'jira',
    'docker',
    'slack',
    'github',
    'vscode',
    'replit',
    'notion',
    'figma'
  ];

  console.log('\n🗑️  Checking deleted tools are gone:');
  let deletedToolsGone = true;
  for (const slug of deletedTools) {
    const result = await db.select().from(tools).where(eq(tools.slug, slug));
    const exists = result.length > 0;
    console.log(`   ${exists ? '❌ FAIL' : '✅ PASS'}: ${slug} ${exists ? 'still exists' : 'deleted'}`);
    if (exists) deletedToolsGone = false;
  }

  // Check if valid tools remain
  const validTools = [
    'gitlab-duo',
    'graphite',
    'greptile',
    'cursor'
  ];

  console.log('\n✅ Checking valid tools remain:');
  let validToolsRemain = true;
  for (const slug of validTools) {
    const result = await db.select().from(tools).where(eq(tools.slug, slug));
    const exists = result.length > 0;
    console.log(`   ${exists ? '✅ PASS' : '❌ FAIL'}: ${slug} ${exists ? 'exists' : 'missing'}`);
    if (!exists) validToolsRemain = false;
  }

  console.log('\n' + '='.repeat(80));
  console.log('📋 Summary:');
  console.log(`   Tool Count: ${totalTools === 46 ? '✅ PASS' : '❌ FAIL'} (${totalTools}/46)`);
  console.log(`   Deleted Tools Gone: ${deletedToolsGone ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   Valid Tools Remain: ${validToolsRemain ? '✅ PASS' : '❌ FAIL'}`);
  console.log('=' .repeat(80));

  process.exit(0);
}

verifyToolCleanup();
