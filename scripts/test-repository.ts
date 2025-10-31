import { ToolsRepository } from '../lib/db/repositories/tools.repository';

async function testRepository() {
  try {
    console.log('Testing ToolsRepository.findBySlug("goose")...\n');

    const toolsRepo = new ToolsRepository();
    const tool = await toolsRepo.findBySlug('goose');

    if (!tool) {
      console.log('❌ Tool not found!');
      return;
    }

    console.log('Tool data returned by repository:');
    console.log(JSON.stringify(tool, null, 2));

    console.log('\n--- Field Check ---');
    console.log('tool.logo_url:', tool.logo_url);
    console.log('tool.website_url:', tool.website_url);
    console.log('tool.github_repo:', tool.github_repo);
    console.log('tool.description:', tool.description);
    console.log('tool.tagline:', tool.tagline);
    console.log('tool.info:', typeof tool.info, tool.info);

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }

  process.exit(0);
}

testRepository();
