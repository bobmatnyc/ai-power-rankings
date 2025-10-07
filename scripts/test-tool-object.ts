import { ToolsRepository } from '../lib/db/repositories/tools.repository';

async function testToolObject() {
  const toolsRepo = new ToolsRepository();
  const tool = await toolsRepo.findBySlug('cursor');

  if (tool) {
    console.log('\n📦 Tool object keys:', Object.keys(tool).sort());
    console.log('\n📝 Tagline field:', JSON.stringify((tool as any).tagline));
    console.log('📝 Features count:', (tool as any).features?.length || 'NULL');
    console.log('📝 Supported languages count:', (tool as any).supported_languages?.length || 'NULL');
    console.log('📝 IDE Support:', (tool as any).ide_support || 'NULL');
    console.log('📝 Description:', ((tool as any).description || 'NULL').substring(0, 60));

    // Check if tagline is in info
    const info = (tool as any).info;
    if (info) {
      console.log('\n📋 Info object keys:', Object.keys(info));
      console.log('📋 Info.tagline:', info.tagline);
      console.log('📋 Info.product?.tagline:', info.product?.tagline);
      console.log('📋 Info.summary:', info.summary?.substring(0, 60));
    }
  } else {
    console.log('❌ Tool not found');
  }

  process.exit(0);
}

testToolObject();
