import { ToolsRepository } from '../lib/db/repositories/tools.repository';

async function verifyOpenSourceTools() {
  try {
    console.log('🔄 Verifying Open Source Tools...\n');

    const toolsRepo = new ToolsRepository();
    const openSourceTools = ['goose', 'aider', 'google-gemini-cli', 'qwen-code'];

    for (const slug of openSourceTools) {
      const tool = await toolsRepo.findBySlug(slug);

      if (!tool) {
        console.log(`⚠️  ${slug} not found`);
        continue;
      }

      const company = (tool.info as any)?.company?.name || 'N/A';
      const logoUrl = (tool as any).logo_url || 'N/A';

      console.log(`✅ ${tool.name} (${slug})`);
      console.log(`   Company: ${company}`);
      console.log(`   Logo URL: ${logoUrl}`);
      console.log();
    }

    console.log('✨ Verification complete');
  } catch (error) {
    console.error('❌ Error verifying tools:', error);
    process.exit(1);
  }
}

verifyOpenSourceTools();
