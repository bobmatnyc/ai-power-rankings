import { getDb } from '../lib/db/connection';
import { tools } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

async function checkData() {
  const db = getDb();
  console.log('🔍 Checking extracted data in database...\n');

  const testTools = ['cursor', 'github-copilot', 'devin', 'claude-code'];

  for (const slug of testTools) {
    const result = await db.select({
      name: tools.name,
      tagline: tools.tagline,
      features: tools.features,
      supported_languages: tools.supported_languages,
      ide_support: tools.ide_support
    }).from(tools).where(eq(tools.slug, slug)).limit(1);

    if (result.length > 0) {
      const tool = result[0];
      console.log(`📦 ${tool.name} (${slug})`);
      console.log(`   Tagline: ${tool.tagline ? '✅ ' + tool.tagline.substring(0, 60) + '...' : '❌ NULL'}`);
      console.log(`   Features: ${tool.features ? `✅ ${tool.features.length} items` : '❌ NULL'}`);
      console.log(`   Languages: ${tool.supported_languages ? `✅ ${tool.supported_languages.length} items` : '❌ NULL'}`);
      console.log(`   IDE Support: ${tool.ide_support ? `✅ ${tool.ide_support.length} items` : '❌ NULL'}`);
      console.log();
    }
  }

  process.exit(0);
}

checkData();
