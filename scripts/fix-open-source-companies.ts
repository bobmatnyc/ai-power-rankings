import { getDb } from '../lib/db/connection';
import { tools } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

async function fixOpenSourceCompanies() {
  try {
    console.log('🔄 Finding open source tools with missing company info...');

    const db = getDb();
    if (!db) throw new Error('Database not connected');

    // Get all tools
    const allTools = await db.select().from(tools);

    let updatedCount = 0;

    for (const tool of allTools) {
      const toolData = tool.data as Record<string, unknown>;
      const license = (toolData?.license as string)?.toLowerCase() || '';
      const info = (toolData?.info as Record<string, unknown>) || {};
      const currentCompany = (info?.company as any)?.name;

      // Check if it's open source license
      const isOpenSource =
        license.includes('open source') ||
        license.includes('apache') ||
        license.includes('mit') ||
        license.includes('gpl') ||
        license.includes('bsd');

      // Only update if it's open source and has no company or shows N/A
      if (isOpenSource && (!currentCompany || currentCompany === 'N/A' || currentCompany === '')) {
        const updatedInfo = {
          ...info,
          company: {
            name: 'Open Source',
            url: (toolData?.website as string) || (toolData?.github as string) || ''
          }
        };

        const updatedData = {
          ...toolData,
          info: updatedInfo,
        };

        await db
          .update(tools)
          .set({
            data: updatedData,
            updatedAt: new Date(),
          })
          .where(eq(tools.id, tool.id));

        console.log(`✅ Updated ${tool.name} (${tool.slug}) developer to "Open Source"`);
        updatedCount++;
      }
    }

    console.log(`\n✨ Summary: Updated ${updatedCount} open source tools`);
  } catch (error) {
    console.error('❌ Error fixing open source companies:', error);
    process.exit(1);
  }
}

fixOpenSourceCompanies();
