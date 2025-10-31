import { closeDb, getDb } from '@/lib/db/connection';
import { tools } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const websiteUpdates = [
  { slug: 'openai-codex-cli', website: 'https://developers.openai.com/codex/cli' },
  { slug: 'kiro', website: 'https://kiro.dev/' },
  { slug: 'gitlab-duo-agent-platform', website: 'https://about.gitlab.com/gitlab-duo/agent-platform/' },
  { slug: 'epam-ai-run', website: 'https://www.epam.com/services/artificial-intelligence/epam-ai-run-tm' },
  { slug: 'openai-codex', website: 'https://openai.com/codex/' },
  { slug: 'openhands', website: 'https://www.all-hands.dev/' },
  { slug: 'trae-ai', website: 'https://www.trae.ai/' },
  { slug: 'kilocode', website: 'https://kilocode.ai/' },
  { slug: 'roocode', website: 'https://roocode.com/' },
  { slug: 'qoder', website: 'https://qoder.com/' },
  { slug: 'flint', website: 'https://www.tryflint.com/' },
];

async function addWebsiteUrls() {
  const db = getDb();
  let updated = 0;
  let notFound = 0;

  console.log('\n📝 Adding website URLs to tools...\n');

  for (const update of websiteUpdates) {
    console.log(`Processing ${update.slug}...`);

    const toolResults = await db.select().from(tools).where(eq(tools.slug, update.slug)).limit(1);
    if (toolResults.length === 0) {
      console.log(`  ⚠️  Tool not found: ${update.slug}`);
      notFound++;
      continue;
    }

    const tool = toolResults[0];
    const currentData = tool.data as any;

    // Check if website already exists
    if (currentData.website) {
      console.log(`  ℹ️  Already has website: ${currentData.website}`);
      continue;
    }

    // Update with new website
    await db.update(tools)
      .set({
        data: { ...currentData, website: update.website }
      })
      .where(eq(tools.id, tool.id));

    console.log(`  ✅ Added website: ${update.website}`);
    updated++;
  }

  console.log('\n📊 Summary:');
  console.log(`  ✅ Updated: ${updated}`);
  console.log(`  ⚠️  Not found: ${notFound}`);
  console.log(`  ℹ️  Already had website: ${websiteUpdates.length - updated - notFound}`);
  console.log('\n✨ Done!\n');
}

addWebsiteUrls()
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  })
  .finally(() => {
    closeDb();
  });
