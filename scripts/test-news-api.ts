import { NewsRepository } from '../lib/db/repositories/news';

async function testNewsRepo() {
  const repo = new NewsRepository();
  console.log('Testing NewsRepository.getBySlug()...\n');

  const article = await repo.getBySlug('ai-coding-tools-market-intelligence-report-september-2025');

  if (article) {
    console.log('✅ Article found!');
    console.log('ID:', article.id);
    console.log('Slug:', article.slug);
    console.log('Title:', article.title);
    console.log('Summary:', article.summary?.substring(0, 100) + '...');
    console.log('Source:', article.source);
    console.log('Published:', article.publishedAt);
    console.log('Tool Mentions:', article.toolMentions);
    console.log('\nFull article object:');
    console.log(JSON.stringify(article, null, 2));
  } else {
    console.log('❌ Article not found');
  }
}

testNewsRepo().catch(console.error);
