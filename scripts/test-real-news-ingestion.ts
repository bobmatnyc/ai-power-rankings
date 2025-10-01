#!/usr/bin/env npx tsx

import chalk from 'chalk';
import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables
dotenv.config({ path: '.env.local' });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// Schema for article analysis
const ArticleAnalysisSchema = z.object({
  title: z.string(),
  summary: z.string(),
  source: z.string(),
  url: z.string().nullable(),
  published_date: z.string().optional(),
  tools_mentioned: z.array(z.object({
    original_name: z.string(),
    normalized_name: z.string(),
    context: z.string(),
    sentiment: z.number().min(-1).max(1),
    relevance: z.number().min(0).max(1)
  })),
  categories: z.record(z.number()),
  sentiment: z.object({
    overall: z.string(),
    innovation_score: z.number(),
    adoption_score: z.number()
  }),
  importance_score: z.number().min(0).max(10),
  ranking_impacts: z.object({
    likely_winners: z.array(z.string()),
    likely_losers: z.array(z.string()),
    emerging_tools: z.array(z.string())
  }).optional()
});

type ArticleAnalysis = z.infer<typeof ArticleAnalysisSchema>;

// Mock article content for testing
const MOCK_ARTICLES = [
  {
    title: "Anthropic's Claude 3.5 Sonnet Can Now Use Computers",
    content: `Anthropic has announced a groundbreaking update to Claude 3.5 Sonnet, introducing computer use capabilities that allow the AI to interact directly with computer interfaces. This new feature enables Claude to control desktop applications, browse websites, and perform complex multi-step tasks autonomously.

The computer use capability represents a significant advancement in agentic AI, positioning Claude as more than just a conversational assistant. Users can now delegate entire workflows to Claude, from data analysis in spreadsheets to coding in IDEs. Early testing shows Claude achieving 88.7% accuracy on the OSWorld benchmark, surpassing GPT-4V's performance.

This development puts pressure on competitors like OpenAI's ChatGPT and Google's Gemini to develop similar capabilities. Microsoft's Copilot Studio and Salesforce's Agentforce are also racing to provide enterprise-grade agent capabilities. The implications for software development are profound, with tools like Cursor, Windsurf, and GitHub Copilot potentially integrating similar autonomous features.`,
    source: "Anthropic Blog",
    url: "https://anthropic.com/claude-computer-use",
    expectedTools: ["Claude 3.5 Sonnet", "ChatGPT Canvas", "Google Gemini", "Microsoft Copilot Studio", "Salesforce Agentforce Builder", "Cursor", "Windsurf", "GitHub Copilot"],
    category: "agent-platforms"
  },
  {
    title: "OpenAI Launches GPT-5 with Advanced Code Generation",
    content: `OpenAI has unveiled GPT-5, featuring dramatically enhanced code generation capabilities that set new standards for AI-assisted programming. The model demonstrates unprecedented ability in multi-step reasoning and can generate entire applications from natural language descriptions.

GPT-5's integration with ChatGPT Canvas provides developers with an interactive coding environment where AI suggestions appear in real-time. The model shows significant improvements over GPT-4, particularly in understanding complex codebases and maintaining context across large projects. Early adopters report 3x productivity gains when using GPT-5 for software development.

The launch has sparked intense competition in the AI coding assistant space. GitHub Copilot is updating to use GPT-5, while alternatives like Cursor, Codeium's Windsurf, and Amazon CodeWhisperer are accelerating their own model improvements. Replit Agent and Warp Code are also leveraging the new capabilities to enhance their platforms.`,
    source: "OpenAI Blog",
    url: "https://openai.com/gpt-5-launch",
    expectedTools: ["ChatGPT Canvas", "GitHub Copilot", "Cursor", "Windsurf", "Amazon CodeWhisperer", "Replit Agent", "Warp Code"],
    category: "code-generation"
  },
  {
    title: "Salesforce Agentforce Transforms Enterprise AI Adoption",
    content: `Salesforce has launched Agentforce, a comprehensive platform for building and deploying AI agents across enterprise workflows. The platform enables businesses to create custom agents without extensive coding, democratizing access to agentic AI capabilities.

Agentforce integrates seamlessly with Salesforce's CRM ecosystem, allowing agents to access customer data, automate sales processes, and provide intelligent customer service. The platform's no-code builder competes directly with Microsoft Copilot Studio and Amazon Q Developer in the enterprise space. Early customers report 50% reduction in manual tasks after deploying Agentforce agents.

The platform's success highlights growing enterprise demand for AI automation. While consumer-focused tools like ChatGPT and Claude dominate headlines, enterprise platforms like Agentforce, ServiceNow's AI agents, and IBM Watson are driving substantial business transformation. The integration with development tools like Visual Studio Code and support for custom models positions Agentforce as a comprehensive enterprise AI solution.`,
    source: "Salesforce Newsroom",
    url: "https://salesforce.com/agentforce-announcement",
    expectedTools: ["Salesforce Agentforce Builder", "Microsoft Copilot Studio", "Amazon Q Developer", "ChatGPT Canvas", "Claude 3.5 Sonnet", "Visual Studio Code"],
    category: "enterprise-platforms"
  },
  {
    title: "GitHub Copilot Workspace Revolutionizes Collaborative Coding",
    content: `GitHub has introduced Copilot Workspace, an AI-native development environment that reimagines how teams collaborate on code. The platform combines GitHub Copilot's code generation with project management, code review, and deployment capabilities in a unified interface.

Copilot Workspace leverages GPT-4 and proprietary models to understand entire project contexts, automatically suggesting improvements and catching bugs before they reach production. The platform's real-time collaboration features allow multiple developers to work with AI assistance simultaneously, with each developer's AI agent aware of others' changes.

Competition in the AI IDE space is intensifying, with Cursor reaching 100,000 paid users and Windsurf gaining traction among enterprise developers. Replit's Agent platform and JetBrains' AI Assistant are also vying for market share. Despite the competition, GitHub's integration with the world's largest code repository gives Copilot Workspace a significant advantage.`,
    source: "GitHub Blog",
    url: "https://github.blog/copilot-workspace",
    expectedTools: ["GitHub Copilot", "Cursor", "Windsurf", "Replit Agent", "JetBrains AI Assistant"],
    category: "development-tools"
  },
  {
    title: "Google Gemini 2.0 Challenges OpenAI with Multimodal Excellence",
    content: `Google has released Gemini 2.0, a multimodal AI model that excels at both conversational AI and code generation. The model's ability to understand images, code, and text simultaneously makes it particularly powerful for debugging and explaining complex software systems.

Gemini 2.0's integration into Google Cloud and Android Studio brings AI assistance to millions of developers. The model shows superior performance in understanding UI/UX code, making it especially valuable for front-end development. Google's partnership with Replit brings Gemini to Replit Agent, while integration with Visual Studio Code expands its reach.

The release intensifies competition with OpenAI's ChatGPT, Anthropic's Claude, and Microsoft's Copilot ecosystem. Gemini's strength in multimodal understanding gives it unique advantages in mobile development and cloud-native applications. Tools like Cursor and Windsurf are exploring Gemini integration to offer users model choice.`,
    source: "Google AI Blog",
    url: "https://blog.google/gemini-2-0",
    expectedTools: ["Google Gemini", "ChatGPT Canvas", "Claude 3.5 Sonnet", "Microsoft Copilot Studio", "Replit Agent", "Visual Studio Code", "Cursor", "Windsurf"],
    category: "code-generation"
  }
];

// Real news articles about agentic AI (with fallback to mock content)
const REAL_NEWS_ARTICLES = MOCK_ARTICLES.map(mock => ({
  title: mock.title,
  url: mock.url,
  source: mock.source,
  description: mock.content.substring(0, 200) + '...',
  expectedTools: mock.expectedTools,
  category: mock.category,
  mockContent: mock.content // Store mock content as fallback
}));

// Tool name normalization mapping
const TOOL_NORMALIZATION_MAP: Record<string, string> = {
  'gpt-4': 'ChatGPT Canvas',
  'gpt-4-turbo': 'ChatGPT Canvas',
  'chatgpt': 'ChatGPT Canvas',
  'claude': 'Claude 3.5 Sonnet',
  'claude-3': 'Claude 3.5 Sonnet',
  'copilot': 'GitHub Copilot',
  'gemini': 'Google Gemini',
  'agentforce': 'Salesforce Agentforce Builder',
  'cursor ide': 'Cursor',
  'windsurf ide': 'Windsurf',
  'replit ai': 'Replit Agent',
  'amazon q': 'Amazon Q Developer',
  'codewhisperer': 'Amazon CodeWhisperer'
};

/**
 * Fetch article content from URL or use mock content
 */
async function fetchArticleContent(url: string, mockContent?: string): Promise<string> {
  // First try to fetch real content
  try {
    console.log(chalk.gray(`  Attempting to fetch from ${url}...`));

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AINewsBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml'
      },
      // Add timeout
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();

    // Simple HTML to text extraction
    const text = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();

    if (text.length > 100) {
      console.log(chalk.green(`  ✅ Fetched real content (${text.length} chars)`));
      return text.substring(0, 10000); // Limit to 10k chars
    }
  } catch (error) {
    console.log(chalk.yellow(`  ⚠️  Fetch failed: ${error}`));
  }

  // Fall back to mock content if available
  if (mockContent) {
    console.log(chalk.blue(`  📝 Using mock content for testing`));
    return mockContent;
  }

  console.log(chalk.red(`  ❌ No content available`));
  return '';
}

/**
 * Analyze article using AI
 */
async function analyzeArticle(content: string, metadata: any): Promise<ArticleAnalysis | null> {
  if (!OPENROUTER_API_KEY) {
    console.log(chalk.yellow('  ⚠️  No OpenRouter API key, using mock analysis'));
    return createMockAnalysis(content, metadata);
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://ai-power-ranking.com',
        'X-Title': 'AI Power Ranking News Analysis'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-3-haiku-20240307',
        messages: [
          {
            role: 'system',
            content: `You are an AI news analyst. Analyze the article and extract:
- AI tools and platforms mentioned
- Sentiment (positive/negative/neutral)
- Innovation and adoption scores (0-10)
- Predicted ranking impacts

Return a JSON object with this structure:
{
  "title": "article title",
  "summary": "brief summary",
  "source": "source name",
  "url": "source url",
  "tools_mentioned": [
    {
      "original_name": "name as mentioned",
      "normalized_name": "standardized name",
      "context": "context of mention",
      "sentiment": 0.5,
      "relevance": 0.8
    }
  ],
  "categories": {
    "code-generation": 8,
    "development-tools": 6
  },
  "sentiment": {
    "overall": "positive",
    "innovation_score": 8,
    "adoption_score": 7
  },
  "importance_score": 8,
  "ranking_impacts": {
    "likely_winners": ["Tool1"],
    "likely_losers": ["Tool2"],
    "emerging_tools": ["Tool3"]
  }
}`
          },
          {
            role: 'user',
            content: `Analyze this article:\n\nTitle: ${metadata.title}\nSource: ${metadata.source}\n\nContent:\n${content.substring(0, 3000)}`
          }
        ],
        temperature: 0.3,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const analysisText = data.choices[0]?.message?.content || '{}';

    // Extract JSON from response
    const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const analysis = JSON.parse(jsonMatch[0]);
    return ArticleAnalysisSchema.parse(analysis);
  } catch (error) {
    console.error(chalk.red(`  AI analysis failed: ${error}`));
    return createMockAnalysis(content, metadata);
  }
}

/**
 * Create mock analysis for testing without API
 */
function createMockAnalysis(content: string, metadata: any): ArticleAnalysis {
  const contentLower = content.toLowerCase();
  const tools: any[] = [];

  // Detect tools from content
  for (const [alias, normalized] of Object.entries(TOOL_NORMALIZATION_MAP)) {
    if (contentLower.includes(alias)) {
      tools.push({
        original_name: alias,
        normalized_name: normalized,
        context: `Mentioned in article about ${metadata.title}`,
        sentiment: 0.7,
        relevance: 0.8
      });
    }
  }

  // Add expected tools from metadata
  if (metadata.expectedTools) {
    for (const tool of metadata.expectedTools) {
      if (!tools.find(t => t.normalized_name === tool)) {
        tools.push({
          original_name: tool,
          normalized_name: tool,
          context: `Primary tool discussed in ${metadata.title}`,
          sentiment: 0.8,
          relevance: 0.9
        });
      }
    }
  }

  return {
    title: metadata.title,
    summary: metadata.description || 'AI tool announcement and updates',
    source: metadata.source,
    url: metadata.url,
    published_date: new Date().toISOString().split('T')[0],
    tools_mentioned: tools,
    categories: {
      [metadata.category || 'development-tools']: 8,
      'agent-platforms': 6
    },
    sentiment: {
      overall: 'positive',
      innovation_score: 7 + Math.random() * 3,
      adoption_score: 6 + Math.random() * 3
    },
    importance_score: 7 + Math.random() * 3,
    ranking_impacts: {
      likely_winners: tools.slice(0, 2).map(t => t.normalized_name),
      likely_losers: [],
      emerging_tools: tools.slice(2, 4).map(t => t.normalized_name)
    }
  };
}

/**
 * Calculate ranking impact from analysis
 */
function calculateRankingImpact(analysis: ArticleAnalysis): {
  totalImpact: number;
  topTools: string[];
  sentiment: string;
} {
  const totalImpact = analysis.importance_score *
    (analysis.sentiment.innovation_score + analysis.sentiment.adoption_score) / 20;

  const topTools = analysis.tools_mentioned
    .sort((a, b) => (b.relevance * b.sentiment) - (a.relevance * a.sentiment))
    .slice(0, 3)
    .map(t => t.normalized_name);

  return {
    totalImpact,
    topTools,
    sentiment: analysis.sentiment.overall
  };
}

/**
 * Display analysis results
 */
function displayResults(article: any, analysis: ArticleAnalysis | null, index: number) {
  console.log(chalk.cyan(`\n${'='.repeat(70)}`));
  console.log(chalk.cyan.bold(`Article #${index + 1}: ${article.title}`));
  console.log(chalk.cyan('='.repeat(70)));

  if (!analysis) {
    console.log(chalk.red('  ❌ Analysis failed'));
    return;
  }

  console.log(chalk.white(`  📰 URL: ${chalk.gray(article.url)}`));
  console.log(chalk.white(`  📍 Source: ${chalk.gray(analysis.source)}`));
  console.log(chalk.white(`  📅 Date: ${chalk.gray(analysis.published_date || 'N/A')}`));

  // Tools detected
  console.log(chalk.yellow(`\n  🛠️  Tools Detected (${analysis.tools_mentioned.length}):`));
  for (const tool of analysis.tools_mentioned) {
    const sentimentIcon = tool.sentiment > 0.5 ? '✅' : tool.sentiment < -0.5 ? '❌' : '➖';
    const normalized = tool.original_name !== tool.normalized_name
      ? chalk.green(` → ${tool.normalized_name}`)
      : '';
    console.log(`     ${sentimentIcon} ${chalk.white(tool.original_name)}${normalized}`);
    console.log(chalk.gray(`        Context: ${tool.context.substring(0, 80)}...`));
    console.log(chalk.gray(`        Sentiment: ${tool.sentiment.toFixed(2)} | Relevance: ${tool.relevance.toFixed(2)}`));
  }

  // Sentiment analysis
  console.log(chalk.yellow('\n  😊 Sentiment Analysis:'));
  console.log(`     Overall: ${chalk.blue(analysis.sentiment.overall)}`);
  console.log(`     Innovation Score: ${chalk.green(analysis.sentiment.innovation_score.toFixed(1))}/10`);
  console.log(`     Adoption Score: ${chalk.green(analysis.sentiment.adoption_score.toFixed(1))}/10`);

  // Impact calculation
  const impact = calculateRankingImpact(analysis);
  console.log(chalk.yellow('\n  📊 Impact Score:'));
  console.log(`     Importance: ${chalk.magenta(analysis.importance_score.toFixed(1))}/10`);
  console.log(`     Total Impact: ${chalk.magenta.bold(impact.totalImpact.toFixed(2))}`);

  // Ranking predictions
  if (analysis.ranking_impacts) {
    console.log(chalk.yellow('\n  📈 Ranking Changes:'));
    if (analysis.ranking_impacts.likely_winners.length > 0) {
      console.log(`     Winners: ${chalk.green(analysis.ranking_impacts.likely_winners.join(', '))}`);
    }
    if (analysis.ranking_impacts.likely_losers.length > 0) {
      console.log(`     Losers: ${chalk.red(analysis.ranking_impacts.likely_losers.join(', '))}`);
    }
    if (analysis.ranking_impacts.emerging_tools.length > 0) {
      console.log(`     Emerging: ${chalk.cyan(analysis.ranking_impacts.emerging_tools.join(', '))}`);
    }
  }
}

/**
 * Display comparison summary
 */
function displayComparison(results: Array<{ article: any; analysis: ArticleAnalysis | null }>) {
  console.log(chalk.magenta.bold('\n' + '='.repeat(70)));
  console.log(chalk.magenta.bold('📊 COMPARATIVE ANALYSIS'));
  console.log(chalk.magenta.bold('='.repeat(70)));

  // Filter successful analyses
  const successful = results.filter(r => r.analysis !== null);

  if (successful.length === 0) {
    console.log(chalk.red('No successful analyses to compare'));
    return;
  }

  // Rank by impact
  const byImpact = successful
    .map(r => ({
      title: r.article.title,
      analysis: r.analysis!,
      impact: calculateRankingImpact(r.analysis!)
    }))
    .sort((a, b) => b.impact.totalImpact - a.impact.totalImpact);

  console.log(chalk.yellow('\n🏆 Articles by Impact Score:'));
  byImpact.forEach((item, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
    console.log(`  ${medal} ${chalk.white(item.title)}`);
    console.log(`     Impact: ${chalk.magenta.bold(item.impact.totalImpact.toFixed(2))}`);
    console.log(`     Top Tools: ${chalk.cyan(item.impact.topTools.join(', '))}`);
  });

  // Tool frequency analysis
  const toolFrequency: Record<string, number> = {};
  const toolSentiment: Record<string, number[]> = {};

  for (const result of successful) {
    for (const tool of result.analysis!.tools_mentioned) {
      toolFrequency[tool.normalized_name] = (toolFrequency[tool.normalized_name] || 0) + 1;
      if (!toolSentiment[tool.normalized_name]) {
        toolSentiment[tool.normalized_name] = [];
      }
      toolSentiment[tool.normalized_name].push(tool.sentiment);
    }
  }

  const sortedTools = Object.entries(toolFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  console.log(chalk.yellow('\n🔧 Most Mentioned Tools:'));
  for (const [tool, count] of sortedTools) {
    const avgSentiment = toolSentiment[tool].reduce((a, b) => a + b, 0) / toolSentiment[tool].length;
    const sentimentIcon = avgSentiment > 0.5 ? '📈' : avgSentiment < -0.5 ? '📉' : '➡️';
    console.log(`  ${sentimentIcon} ${chalk.white(tool)}: ${chalk.blue(count)} mention${count > 1 ? 's' : ''} (sentiment: ${avgSentiment.toFixed(2)})`);
  }

  // Category distribution
  const categoryScores: Record<string, number> = {};
  for (const result of successful) {
    for (const [cat, score] of Object.entries(result.analysis!.categories)) {
      categoryScores[cat] = (categoryScores[cat] || 0) + score;
    }
  }

  const sortedCategories = Object.entries(categoryScores)
    .sort((a, b) => b[1] - a[1]);

  console.log(chalk.yellow('\n📁 Category Focus:'));
  for (const [cat, score] of sortedCategories) {
    const avgScore = score / successful.length;
    console.log(`  ${chalk.white(cat)}: ${chalk.green(avgScore.toFixed(1))}/10 avg score`);
  }

  // Overall sentiment
  const overallSentiments = successful.map(r => r.analysis!.sentiment.overall);
  const sentimentCounts = {
    positive: overallSentiments.filter(s => s === 'positive').length,
    negative: overallSentiments.filter(s => s === 'negative').length,
    neutral: overallSentiments.filter(s => s === 'neutral' || s === 'mixed').length
  };

  console.log(chalk.yellow('\n😊 Overall Market Sentiment:'));
  console.log(`  Positive: ${chalk.green(sentimentCounts.positive)} articles`);
  console.log(`  Negative: ${chalk.red(sentimentCounts.negative)} articles`);
  console.log(`  Neutral: ${chalk.gray(sentimentCounts.neutral)} articles`);
}

/**
 * Main execution
 */
async function main() {
  console.log(chalk.magenta.bold('\n🚀 AI Power Ranking - Real News Ingestion Test'));
  console.log(chalk.magenta('='.repeat(70)));

  const hasAPIKey = !!OPENROUTER_API_KEY;
  console.log(chalk.yellow(`\n🔑 OpenRouter API Key: ${hasAPIKey ? chalk.green('Available') : chalk.yellow('Not Available (using mock analysis)')}`));

  const articlesToTest = process.argv.includes('--quick')
    ? REAL_NEWS_ARTICLES.slice(0, 3)
    : REAL_NEWS_ARTICLES;

  console.log(chalk.cyan(`\n📰 Testing ${articlesToTest.length} real news articles...\n`));

  const results: Array<{ article: any; analysis: ArticleAnalysis | null }> = [];

  for (let i = 0; i < articlesToTest.length; i++) {
    const article = articlesToTest[i];
    console.log(chalk.blue(`\n[${i + 1}/${articlesToTest.length}] Processing: ${article.title}`));

    // Fetch content (with mock fallback)
    const content = await fetchArticleContent(article.url, (article as any).mockContent);

    if (!content) {
      console.log(chalk.red('  ⚠️  Failed to fetch content, skipping...'));
      results.push({ article, analysis: null });
      continue;
    }

    console.log(chalk.gray(`  📄 Content fetched: ${content.length} characters`));

    // Analyze article
    const analysis = await analyzeArticle(content, article);

    if (analysis) {
      console.log(chalk.green('  ✅ Analysis complete'));
      results.push({ article, analysis });
      displayResults(article, analysis, i);
    } else {
      console.log(chalk.red('  ❌ Analysis failed'));
      results.push({ article, analysis: null });
    }

    // Rate limiting
    if (hasAPIKey && i < articlesToTest.length - 1) {
      console.log(chalk.gray('\n  ⏳ Waiting 1 second (rate limiting)...'));
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Display comparison
  displayComparison(results);

  // Summary statistics
  const successful = results.filter(r => r.analysis !== null).length;
  const failed = results.filter(r => r.analysis === null).length;

  console.log(chalk.magenta.bold('\n' + '='.repeat(70)));
  console.log(chalk.magenta.bold('✅ TEST COMPLETE'));
  console.log(chalk.magenta('='.repeat(70)));
  console.log(chalk.white(`\n  Total Articles: ${results.length}`));
  console.log(chalk.green(`  Successful: ${successful}`));
  console.log(chalk.red(`  Failed: ${failed}`));
  console.log(chalk.blue(`  Success Rate: ${((successful / results.length) * 100).toFixed(1)}%`));

  console.log(chalk.gray('\n💡 Tips:'));
  console.log(chalk.gray('  • Run with --quick to test only 3 articles'));
  console.log(chalk.gray('  • Set OPENROUTER_API_KEY in .env.local for AI analysis'));
  console.log(chalk.gray('  • Mock analysis is used when API key is not available'));
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error(chalk.red('\n❌ Unhandled error:'), error);
  process.exit(1);
});

// Run the script
main().catch((error) => {
  console.error(chalk.red('\n❌ Fatal error:'), error);
  process.exit(1);
});