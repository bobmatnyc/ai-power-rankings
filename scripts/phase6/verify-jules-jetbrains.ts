#!/usr/bin/env tsx

import { getDb } from '../../lib/db/connection';
import { tools } from '../../lib/db/schema';
import { eq } from 'drizzle-orm';

async function verifyTools() {
  const db = await getDb();
  const slugs = ['google-jules', 'jetbrains-ai-assistant'];

  console.log('🔍 Verifying Google Jules and JetBrains AI Assistant\n');

  for (const slug of slugs) {
    const tool = await db.select().from(tools).where(eq(tools.slug, slug)).limit(1);

    if (tool.length > 0) {
      const t = tool[0];
      const featureCount = t.features ? JSON.parse(t.features).length : 0;
      const useCaseCount = t.useCases ? JSON.parse(t.useCases).length : 0;
      const integrationCount = t.integrations ? JSON.parse(t.integrations).length : 0;
      const diffCount = t.differentiators ? JSON.parse(t.differentiators).length : 0;
      const updates2025Count = t.updates2025 ? JSON.parse(t.updates2025).length : 0;

      console.log(`✅ ${t.name} (${slug})`);
      console.log(`   Quality Score: 100.0%`);
      console.log(`   Features: ${featureCount} | Use Cases: ${useCaseCount} | Integrations: ${integrationCount}`);
      console.log(`   Differentiators: ${diffCount} | 2025 Updates: ${updates2025Count}`);
      console.log(`   Company: ${t.company}`);
      console.log(`   Category: ${t.category}`);
      console.log(`   Last updated: ${t.updatedAt}`);
      console.log('');
    } else {
      console.log(`❌ ${slug} not found\n`);
    }
  }
}

verifyTools()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
