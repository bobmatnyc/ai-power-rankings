import { type NextRequest, NextResponse } from "next/server";

interface ArticleData {
  title: string;
  content: string;
  summary: string;
  author: string;
  published_date: string;
  source: string;
  source_url: string;
  tags: string[];
  tool_mentions: string[];
}

// List of known AI tools for automatic detection
const AI_TOOLS = [
  "claude",
  "chatgpt",
  "gpt-4",
  "gpt-3",
  "openai",
  "anthropic",
  "gemini",
  "bard",
  "google",
  "copilot",
  "github copilot",
  "codex",
  "dall-e",
  "midjourney",
  "stable diffusion",
  "llama",
  "meta",
  "mistral",
  "perplexity",
  "character.ai",
  "replika",
  "jasper",
  "writesonic",
  "copy.ai",
  "deepmind",
  "palm",
  "lamda",
  "chinchilla",
  "grok",
  "x.ai",
  "tesla",
  "neuralink",
  "cursor",
  "replit",
  "tabnine",
  "kite",
  "amazon codewhisperer",
  "codewhisperer",
  "hugging face",
  "cohere",
  "ai21",
  "aleph alpha",
  "inflection",
  "runway",
  "eleven labs",
  "elevenlabs",
  "synthesia",
  "d-id",
  "whisper",
  "assembly ai",
  "assemblyai",
  "deepgram",
  "glean",
  "you.com",
  "neeva",
  "bing chat",
  "bing",
  "microsoft copilot",
];

async function fetchArticleContent(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AIPowerRankingsBot/1.0)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    return html;
  } catch (error) {
    console.error("Error fetching URL:", error);
    throw new Error("Failed to fetch article content");
  }
}

function extractTextFromHTML(html: string): string {
  // Remove script and style elements
  let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");

  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, " ");

  // Decode HTML entities
  text = text.replace(/&nbsp;/g, " ");
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#039;/g, "'");

  // Clean up whitespace
  text = text.replace(/\s+/g, " ").trim();

  return text;
}

function extractMetaContent(html: string, property: string): string {
  // Try property attribute
  let match = html.match(
    new RegExp(`<meta\\s+property=["']${property}["']\\s+content=["']([^"']+)["']`, "i")
  );
  if (match?.[1]) {
    return match[1];
  }

  // Try name attribute
  match = html.match(
    new RegExp(`<meta\\s+name=["']${property}["']\\s+content=["']([^"']+)["']`, "i")
  );
  if (match?.[1]) {
    return match[1];
  }

  // Try content first
  match = html.match(
    new RegExp(`<meta\\s+content=["']([^"']+)["']\\s+(?:property|name)=["']${property}["']`, "i")
  );
  if (match?.[1]) {
    return match[1];
  }

  return "";
}

function parseArticleFromHTML(html: string, url: string): ArticleData {
  // Extract title
  let title =
    extractMetaContent(html, "og:title") || extractMetaContent(html, "twitter:title") || "";

  if (!title) {
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    title = titleMatch?.[1] ? titleMatch[1].trim() : "Untitled Article";
  }

  // Extract description/summary
  const summary =
    extractMetaContent(html, "og:description") ||
    extractMetaContent(html, "twitter:description") ||
    extractMetaContent(html, "description") ||
    "";

  // Extract author
  const author =
    extractMetaContent(html, "author") ||
    extractMetaContent(html, "article:author") ||
    extractMetaContent(html, "twitter:creator") ||
    "";

  // Extract published date
  let publishedDate =
    extractMetaContent(html, "article:published_time") ||
    extractMetaContent(html, "og:article:published_time") ||
    "";

  if (!publishedDate) {
    const dateMatch = html.match(/<time[^>]+datetime=["']([^"']+)["']/i);
    publishedDate = dateMatch?.[1] ? dateMatch[1] : new Date().toISOString();
  }

  // Extract source from URL
  const urlObj = new URL(url);
  const source = extractMetaContent(html, "og:site_name") || urlObj.hostname.replace("www.", "");

  // Extract main content
  let content = "";

  // Try to find article content in common containers
  const contentPatterns = [
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<main[^>]*>([\s\S]*?)<\/main>/i,
    /<div[^>]+class=["'][^"']*article-content[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]+class=["'][^"']*post-content[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]+class=["'][^"']*entry-content[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
  ];

  for (const pattern of contentPatterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      content = extractTextFromHTML(match[1]);
      break;
    }
  }

  // If no content found, extract all paragraph text
  if (!content) {
    const paragraphs = html.match(/<p[^>]*>([^<]+)<\/p>/gi) || [];
    content = paragraphs
      .map((p) => extractTextFromHTML(p))
      .filter((text) => text.length > 50) // Filter out short paragraphs
      .join("\n\n");
  }

  // Limit content length
  if (content.length > 10000) {
    content = `${content.substring(0, 10000)}...`;
  }

  // Auto-detect tool mentions
  const toolMentions = detectToolMentions(`${content} ${title} ${summary}`);

  // Generate tags based on content
  const tags = generateTags(title, content, summary);

  return {
    title: title.substring(0, 500),
    content: content || summary,
    summary: summary.substring(0, 1000),
    author: author.substring(0, 200),
    published_date: publishedDate,
    source,
    source_url: url,
    tags,
    tool_mentions: toolMentions,
  };
}

function detectToolMentions(text: string): string[] {
  const lowerText = text.toLowerCase();
  const mentions = new Set<string>();

  for (const tool of AI_TOOLS) {
    // Check for tool name with word boundaries
    const regex = new RegExp(`\\b${tool.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (regex.test(lowerText)) {
      // Normalize tool name to ID format
      const toolId = tool.toLowerCase().replace(/\s+/g, "-").replace(/\./g, "");
      mentions.add(toolId);
    }
  }

  return Array.from(mentions);
}

function generateTags(title: string, content: string, summary: string): string[] {
  const text = `${title} ${summary} ${content}`.toLowerCase();
  const tags = new Set<string>();

  // Add AI-related tags
  if (/artificial intelligence|machine learning|deep learning|neural network/i.test(text)) {
    tags.add("ai");
  }

  if (/chatbot|conversational ai|dialogue system/i.test(text)) {
    tags.add("chatbot");
  }

  if (/llm|large language model|gpt|transformer/i.test(text)) {
    tags.add("llm");
  }

  if (/computer vision|image generation|dall-e|midjourney|stable diffusion/i.test(text)) {
    tags.add("computer-vision");
  }

  if (/code generation|copilot|codex|programming assistant/i.test(text)) {
    tags.add("code-generation");
  }

  if (/research|paper|study|breakthrough/i.test(text)) {
    tags.add("research");
  }

  if (/startup|funding|investment|acquisition/i.test(text)) {
    tags.add("business");
  }

  if (/open source|github|repository/i.test(text)) {
    tags.add("open-source");
  }

  if (/api|developer|sdk|integration/i.test(text)) {
    tags.add("developer-tools");
  }

  if (/ethics|bias|safety|alignment/i.test(text)) {
    tags.add("ai-ethics");
  }

  return Array.from(tags);
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "Invalid URL provided" }, { status: 400 });
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
    }

    // Fetch article content
    const html = await fetchArticleContent(url);

    // Parse article data
    const articleData = parseArticleFromHTML(html, url);

    // Ensure we have at least a title and some content
    if (!articleData.title || !articleData.content) {
      return NextResponse.json({ error: "Could not extract article content" }, { status: 400 });
    }

    return NextResponse.json(articleData);
  } catch (error) {
    console.error("Error in fetch-article:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch article" },
      { status: 500 }
    );
  }
}
