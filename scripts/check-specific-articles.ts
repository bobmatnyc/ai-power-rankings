import { db } from '../lib/db/connection';
import { articles, toolMentions } from '../lib/db/schema';
import { eq } from 'drizzle-orm';

async function checkArticles() {
  const titles = [
    'Microsoft Announces IntelliCode at Build 2018',
    'Tabnine Rebrands from Codota, Expands AI Capabilities',
    'Cursor Reaches $100M ARR, Fastest SaaS Growth'
  ];

  for (const title of titles) {
    const article = await db.select().from(articles).where(eq(articles.title, title)).limit(1);
    if (article.length > 0) {
      const mentions = await db.select().from(toolMentions).where(eq(toolMentions.articleId, article[0].id));
      console.log('---');
      console.log('Title:', article[0].title);
      console.log('Article ID:', article[0].id);
      console.log('Tool Mentions Count:', mentions.length);
      console.log('Tool Mentions:', JSON.stringify(mentions.map(m => ({ tool: m.toolName, context: m.context })), null, 2));
    } else {
      console.log('Article not found:', title);
    }
  }

  process.exit(0);
}

checkArticles().catch(console.error);
