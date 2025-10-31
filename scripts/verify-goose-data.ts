import { ToolsRepository } from '../lib/db/repositories/tools.repository';

async function verifyGooseData() {
  try {
    console.log('🔄 Verifying Goose data...\n');

    const toolsRepo = new ToolsRepository();
    const goose = await toolsRepo.findBySlug('goose');

    if (!goose) {
      console.log('⚠️  Goose tool not found');
      return;
    }

    console.log('📋 Goose Tool Data:');
    console.log('  Name:', goose.name);
    console.log('  Slug:', goose.slug);
    console.log('  Logo URL:', (goose as any).logo_url);
    console.log('  Info:', JSON.stringify(goose.info, null, 2));
    console.log('  Company:', (goose.info as any)?.company);
    console.log('\n✅ Verification complete');
  } catch (error) {
    console.error('❌ Error verifying Goose data:', error);
    process.exit(1);
  }
}

verifyGooseData();
