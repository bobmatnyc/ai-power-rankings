import { db } from '../lib/db';
import { tools } from '../lib/db/schema';
import { ilike } from 'drizzle-orm';

async function verifyTools() {
  console.log('Searching for the 7 tools...\n');

  const toolsToFind = [
    'OpenAI Codex',
    'Greptile',
    'Google Gemini CLI',
    'Graphite',
    'Qwen Code',
    'GitLab Duo',
    'Anything Max'
  ];

  // Search for each tool
  for (const toolName of toolsToFind) {
    const results = await db
      .select()
      .from(tools)
      .where(ilike(tools.name, `%${toolName}%`));

    if (results.length > 0) {
      console.log(`✓ Found: ${toolName}`);
      results.forEach(tool => {
        console.log(`  - ID: ${tool.id}, Name: ${tool.name}, Score: ${tool.score}, Category: ${tool.category}`);
      });
    } else {
      console.log(`✗ NOT FOUND: ${toolName}`);
    }
  }

  // Also search for partial matches
  console.log('\n\nSearching for partial matches...\n');

  const partialSearches = ['codex', 'greptile', 'gemini', 'graphite', 'qwen', 'gitlab', 'anything'];

  for (const term of partialSearches) {
    const results = await db
      .select()
      .from(tools)
      .where(ilike(tools.name, `%${term}%`));

    if (results.length > 0) {
      console.log(`\nTerm: "${term}"`);
      results.forEach(tool => {
        console.log(`  - ${tool.name} (ID: ${tool.id}, Score: ${tool.score}, Category: ${tool.category})`);
      });
    }
  }

  // List all tools in database
  console.log('\n\nAll tools in database:');
  const allTools = await db.select().from(tools);
  console.log(`Total: ${allTools.length} tools`);
  allTools.forEach(tool => {
    console.log(`  ${tool.id}. ${tool.name} - Score: ${tool.score}, Category: ${tool.category}`);
  });

  process.exit(0);
}

verifyTools().catch(console.error);
