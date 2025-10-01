/**
 * Article Ingestion Service
 * Handles content extraction, analysis, and storage of articles
 */

import { z } from "zod";
import type { Article, DryRunResult } from "@/lib/db/article-schema";
import type { Ranking } from "@/lib/db/schema";
import { getOpenRouterApiKey } from "@/lib/startup-validation";

// Validation schemas
export const ArticleIngestionSchema = z
  .object({
    input: z.string().min(1).optional(),
    type: z.enum(["url", "text", "file", "preprocessed"]),
    preprocessedData: z.any().optional(), // For reusing preview data
    fileName: z.string().optional(),
    mimeType: z.string().optional(),
    dryRun: z.boolean().default(false),
    metadata: z
      .object({
        author: z.string().optional(),
        publishedDate: z.string().optional(),
        category: z.string().optional(),
        tags: z.array(z.string()).optional(),
      })
      .optional(),
  })
  .refine(
    (data) => {
      // If type is preprocessed, we need preprocessedData
      if (data.type === "preprocessed") {
        return !!data.preprocessedData;
      }
      // Otherwise, we need input
      return !!data.input;
    },
    {
      message: "Either input or preprocessedData is required based on type",
    }
  );

export type ArticleIngestionInput = z.infer<typeof ArticleIngestionSchema>;

// AI Analysis Response Schema
const AIAnalysisSchema = z.object({
  title: z.string(),
  summary: z.string(),
  rewritten_excerpt: z.string().optional(),
  source: z.string().optional(),
  url: z.string().optional().nullable(),
  published_date: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()),
  tool_mentions: z.array(
    z.object({
      tool: z.string(),
      context: z.string(),
      sentiment: z.number().min(-1).max(1),
      relevance: z.number().min(0).max(1),
    })
  ),
  company_mentions: z.array(
    z.object({
      company: z.string(),
      context: z.string(),
      tools: z.array(z.string()).optional(),
    })
  ),
  overall_sentiment: z.number().min(-1).max(1),
  importance_score: z.number().min(0).max(10),
  key_insights: z.array(z.string()),
  ranking_impacts: z
    .object({
      likely_winners: z.array(z.string()),
      likely_losers: z.array(z.string()),
      emerging_tools: z.array(z.string()),
    })
    .optional(),
});

type AIAnalysisResult = z.infer<typeof AIAnalysisSchema>;

/**
 * Tool name mapping and normalization utilities
 */
export class ToolMapper {
  // Map of common variations to canonical database tool names
  private static readonly TOOL_ALIASES: Record<string, string> = {
    // OpenAI variations
    "gpt-4": "ChatGPT Canvas",
    "gpt-4o": "ChatGPT Canvas",
    "gpt-4-turbo": "ChatGPT Canvas",
    chatgpt: "ChatGPT Canvas",
    "openai codex": "OpenAI Codex CLI",
    codex: "OpenAI Codex CLI",
    "gpt-5": "ChatGPT Canvas", // Future model
    "gpt-5-codex": "OpenAI Codex CLI", // Future model

    // Anthropic variations
    claude: "Claude Code",
    "claude 3": "Claude Code",
    "claude 3.5": "Claude Code",
    "claude 3.5 sonnet": "Claude Code",
    "claude sonnet": "Claude Code",
    "claude opus": "Claude Code",
    "claude haiku": "Claude Code",
    "claude artifacts": "Claude Artifacts",
    "claude canvas": "Claude Code", // Claude's Canvas is part of Claude Code

    // Google variations
    gemini: "Google Gemini Code Assist",
    "gemini pro": "Google Gemini Code Assist",
    "gemini ultra": "Google Gemini Code Assist",
    "gemini code": "Google Gemini Code Assist",
    jules: "Google Jules",
    "google jules": "Google Jules",

    // GitHub/Microsoft variations
    copilot: "GitHub Copilot",
    "github copilot": "GitHub Copilot",
    "copilot x": "GitHub Copilot",
    "copilot chat": "GitHub Copilot",
    "copilot workspace": "GitHub Copilot",

    // Amazon variations
    codewhisperer: "Amazon Q Developer",
    "amazon q": "Amazon Q Developer",
    "q developer": "Amazon Q Developer",

    // Other tools
    replit: "Replit Agent",
    "replit agent": "Replit Agent",
    cognition: "Devin",
    "cognition ai": "Devin",
    devin: "Devin",
    cursor: "Cursor",
    "cursor ai": "Cursor",
    windsurf: "Windsurf",
    codeium: "Windsurf", // Codeium is the company behind Windsurf
    v0: "v0",
    "v0.dev": "v0",
    "vercel v0": "v0",
    aider: "Aider",
    tabnine: "Tabnine",
    cody: "Sourcegraph Cody",
    "sourcegraph cody": "Sourcegraph Cody",
    continue: "Continue",
    "continue dev": "Continue",
    cline: "Cline",
    openhands: "OpenHands",
    "open hands": "OpenHands",
    "jetbrains ai": "JetBrains AI Assistant",
    "intellij ai": "JetBrains AI Assistant",
    qodo: "Qodo Gen",
    codiumai: "Qodo Gen",
    coderabbit: "CodeRabbit",
    bolt: "Bolt.new",
    "bolt.new": "Bolt.new",
    augment: "Augment Code",
    "augment code": "Augment Code",
    lovable: "Lovable",
    zed: "Zed",
    "zed ai": "Zed",
    kiro: "Kiro",
    snyk: "Snyk Code",
    "snyk code": "Snyk Code",
    intellicode: "Microsoft IntelliCode",
    "microsoft intellicode": "Microsoft IntelliCode",
    sourcery: "Sourcery",
    diffblue: "Diffblue Cover",
    "diffblue cover": "Diffblue Cover",
  };

  // Known tool names in our database for fuzzy matching
  private static readonly KNOWN_TOOLS = [
    "Claude Code",
    "GitHub Copilot",
    "Cursor",
    "ChatGPT Canvas",
    "v0",
    "Kiro",
    "Windsurf",
    "Google Jules",
    "Amazon Q Developer",
    "Lovable",
    "Aider",
    "Tabnine",
    "Bolt.new",
    "Augment Code",
    "Google Gemini Code Assist",
    "Replit Agent",
    "Zed",
    "OpenAI Codex CLI",
    "Devin",
    "Continue",
    "Claude Artifacts",
    "Sourcegraph Cody",
    "Cline",
    "OpenHands",
    "JetBrains AI Assistant",
    "Qodo Gen",
    "CodeRabbit",
    "Snyk Code",
    "Microsoft IntelliCode",
    "Sourcery",
    "Diffblue Cover",
  ];

  /**
   * Normalize a tool name to match database entries
   */
  static normalizeTool(toolName: string): string {
    if (!toolName) return toolName;

    // First check if it's already a known tool name
    if (ToolMapper.KNOWN_TOOLS.includes(toolName)) {
      return toolName;
    }

    // Check aliases (case-insensitive)
    const lowerName = toolName.toLowerCase().trim();
    const aliasMatch = ToolMapper.TOOL_ALIASES[lowerName];
    if (aliasMatch) {
      return aliasMatch;
    }

    // Try fuzzy matching for partial matches
    const fuzzyMatch = ToolMapper.fuzzyMatch(toolName);
    if (fuzzyMatch) {
      return fuzzyMatch;
    }

    // Return original if no match found (might be a new tool)
    return toolName;
  }

  /**
   * Fuzzy match a tool name against known tools
   */
  private static fuzzyMatch(toolName: string): string | null {
    const lowerName = toolName.toLowerCase();

    // Check if any known tool name contains the input or vice versa
    for (const knownTool of ToolMapper.KNOWN_TOOLS) {
      const lowerKnown = knownTool.toLowerCase();

      // Check if the known tool contains the input or vice versa
      if (lowerKnown.includes(lowerName) || lowerName.includes(lowerKnown)) {
        return knownTool;
      }

      // Check if they share significant words (for multi-word tools)
      const inputWords = lowerName.split(/\s+/);
      const knownWords = lowerKnown.split(/\s+/);
      const significantWords = inputWords.filter((w) => w.length > 3);
      const matchingWords = significantWords.filter((w) =>
        knownWords.some((kw) => kw.includes(w) || w.includes(kw))
      );

      // If more than half of significant words match, consider it a match
      if (significantWords.length > 0 && matchingWords.length >= significantWords.length / 2) {
        return knownTool;
      }
    }

    return null;
  }

  /**
   * Process tool mentions from AI analysis and normalize names
   */
  static processToolMentions(
    mentions: AIAnalysisResult["tool_mentions"]
  ): AIAnalysisResult["tool_mentions"] {
    return mentions.map((mention) => ({
      ...mention,
      tool: ToolMapper.normalizeTool(mention.tool),
    }));
  }
}

/**
 * Content Extraction Service
 */
export class ContentExtractor {
  /**
   * Extract content from URL
   */
  async extractFromUrl(url: string): Promise<string> {
    console.log(`[ContentExtractor] Fetching content from URL: ${url}`);

    try {
      // Use a more sophisticated extraction approach
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; AINewsBot/1.0; +https://ai-power-ranking.com)",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
      }

      const html = await response.text();

      // Enhanced HTML content extraction
      const content = this.extractTextFromHtml(html);

      // Limit content length for processing
      return content.substring(0, 15000);
    } catch (error) {
      console.error(`[ContentExtractor] Error fetching URL: ${error}`);
      throw new Error(
        `Failed to extract content from URL: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Extract content from file
   */
  async extractFromFile(
    base64Content: string,
    mimeType: string,
    fileName: string
  ): Promise<string> {
    console.log(`[ContentExtractor] Processing file: ${fileName} (${mimeType})`);

    const buffer = Buffer.from(base64Content, "base64");

    if (mimeType === "application/pdf") {
      return this.extractFromPdf(buffer);
    } else if (
      mimeType.startsWith("text/") ||
      mimeType === "application/json" ||
      fileName.endsWith(".md")
    ) {
      return buffer.toString("utf-8");
    } else if (
      mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      return this.extractFromDocx(buffer);
    } else {
      throw new Error(`Unsupported file type: ${mimeType}`);
    }
  }

  /**
   * Extract text from HTML content
   */
  private extractTextFromHtml(html: string): string {
    // Remove script and style tags
    let text = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");

    // Extract article content if possible (common article selectors)
    const articlePatterns = [
      /<article[^>]*>([\s\S]*?)<\/article>/gi,
      /<main[^>]*>([\s\S]*?)<\/main>/gi,
      /<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
      /<div[^>]*class="[^"]*article[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
    ];

    for (const pattern of articlePatterns) {
      const match = pattern.exec(text);
      if (match?.[1]) {
        text = match[1];
        break;
      }
    }

    // Remove remaining HTML tags
    text = text.replace(/<[^>]+>/g, " ");

    // Clean up whitespace
    text = text
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/\s+/g, " ")
      .trim();

    return text;
  }

  /**
   * Extract text from PDF
   */
  private async extractFromPdf(buffer: Buffer): Promise<string> {
    try {
      // Note: In production, you'd use a proper PDF library like pdf-parse
      // For now, return a placeholder or basic extraction
      console.log("[ContentExtractor] PDF extraction not fully implemented");

      // Basic text extraction attempt
      const text = buffer.toString("utf-8", 0, Math.min(buffer.length, 10000));
      const readable = text
        .replace(/[^\x20-\x7E\n\r\t]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      if (readable.length < 100) {
        throw new Error("Could not extract sufficient text from PDF");
      }

      return readable;
    } catch (error) {
      throw new Error(
        `PDF extraction failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Extract text from DOCX
   */
  private async extractFromDocx(buffer: Buffer): Promise<string> {
    try {
      // Note: In production, you'd use a library like mammoth
      // For now, return a basic extraction
      console.log("[ContentExtractor] DOCX extraction not fully implemented");

      // Very basic extraction (DOCX files contain XML)
      const text = buffer.toString("utf-8");
      const matches = text.match(/<w:t[^>]*>([^<]+)<\/w:t>/g);

      if (matches) {
        const extracted = matches.map((match) => match.replace(/<[^>]+>/g, "")).join(" ");
        return extracted.substring(0, 15000);
      }

      throw new Error("Could not extract text from DOCX");
    } catch (error) {
      throw new Error(
        `DOCX extraction failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
}

/**
 * AI Analysis Service
 */
export class AIAnalyzer {
  private apiKey: string;

  constructor() {
    this.apiKey = getOpenRouterApiKey();
  }

  /**
   * Analyze content with AI
   */
  async analyzeContent(
    content: string,
    metadata?: {
      url?: string;
      fileName?: string;
      author?: string;
    }
  ): Promise<AIAnalysisResult & { model: string }> {
    console.log("[AIAnalyzer] Starting content analysis");

    const systemPrompt = `You are an expert AI industry analyst specializing in AI tools, technologies, and market trends.
Your task is to analyze articles and extract structured information about AI tools, companies, and their potential impact on rankings.

Focus on:
1. Identifying ALL AI tools, models, and services mentioned - USE SPECIFIC PRODUCT NAMES when possible:
   - For OpenAI: "ChatGPT Canvas" for their code editor, "GPT-4" for the model, "OpenAI Codex CLI" for Codex
   - For Anthropic: "Claude Code" for their coding tool, "Claude 3.5" for the model, "Claude Artifacts" for UI generation
   - For Google: "Google Gemini Code Assist" for code assistance, "Google Jules" for their agent, "Gemini" for the model
   - For GitHub/Microsoft: "GitHub Copilot" (not just "Copilot"), "Microsoft IntelliCode"
   - For Amazon: "Amazon Q Developer" (evolved from CodeWhisperer)
   - For specific products: "Replit Agent", "Devin", "Cursor", "Windsurf", "v0", "Aider", etc.
   - When unsure, use the most specific name mentioned in the article
2. Understanding the context and sentiment around each tool
3. Identifying companies behind the tools
4. Predicting potential ranking impacts based on the news
5. Extracting key insights and trends

Be thorough and precise. Extract the exact tool names as mentioned, we'll handle normalization.

IMPORTANT: You MUST return ONLY a valid JSON object. Do not include any explanatory text before or after the JSON.`;

    const userPrompt = `Analyze this article and extract comprehensive information:

${content.substring(0, 10000)}

${metadata?.url ? `Source URL: ${metadata.url}` : ""}
${metadata?.fileName ? `File: ${metadata.fileName}` : ""}

Return a detailed JSON analysis with this structure:
{
  "title": "Article title",
  "summary": "2-3 sentence summary",
  "source": "Publication or domain",
  "url": "Source URL if available",
  "published_date": "YYYY-MM-DD format",
  "category": "AI category (e.g., 'LLM', 'Code Assistant', 'Image Generation')",
  "tags": ["relevant", "tags", "for", "article"],
  "tool_mentions": [
    {
      "tool": "Tool name as mentioned (e.g., 'ChatGPT Canvas', 'Claude Code', 'GitHub Copilot', 'Devin')",
      "context": "How the tool is mentioned",
      "sentiment": 0.8, // -1 to 1
      "relevance": 0.9  // 0 to 1, how central to the article
    }
  ],
  "company_mentions": [
    {
      "company": "Company name",
      "context": "How the company is mentioned",
      "tools": ["tools owned by this company"]
    }
  ],
  "overall_sentiment": 0.7, // -1 to 1
  "importance_score": 8, // 0 to 10
  "key_insights": [
    "Major insight or trend from the article",
    "Another key finding"
  ],
  "ranking_impacts": {
    "likely_winners": ["Tools likely to gain in rankings"],
    "likely_losers": ["Tools likely to drop"],
    "emerging_tools": ["New or emerging tools mentioned"]
  }
}

Return ONLY the JSON object above with actual data. No additional text or explanation.`;

    // Using Claude 4 Sonnet model for enhanced analysis capabilities
    // Claude 4 Sonnet provides superior analysis quality with improved understanding
    // of context, nuance, and technical details in AI articles
    const modelName = "anthropic/claude-sonnet-4";

    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          Referer: process.env["NEXT_PUBLIC_BASE_URL"] || "http://localhost:3000",
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.2, // Lower temperature for more consistent, focused analysis with Claude 4
          max_tokens: 8000, // Increased for Claude 4 Sonnet's enhanced capabilities and detailed analysis
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[AIAnalyzer] OpenRouter API error:", response.status, errorText);

        // Check for common error patterns
        if (response.status === 401) {
          throw new Error("OpenRouter authentication failed. Please check your API key.");
        } else if (response.status === 429) {
          throw new Error("OpenRouter rate limit exceeded. Please try again later.");
        } else if (response.status === 402) {
          throw new Error("OpenRouter insufficient credits. Please add credits to your account.");
        }

        throw new Error(
          `OpenRouter API error (${response.status}): ${errorText.substring(0, 200)}`
        );
      }

      const responseText = await response.text();
      let data: any;

      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error(
          "[AIAnalyzer] Failed to parse OpenRouter response:",
          responseText.substring(0, 500)
        );
        throw new Error("Invalid JSON response from OpenRouter API");
      }

      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        console.error("[AIAnalyzer] No content in OpenRouter response:", data);
        throw new Error("No response content from AI");
      }

      // Parse and validate the response
      const jsonStr = content.replace(/```json\n?|\n?```/g, "").trim();

      let parsed: any;
      try {
        parsed = JSON.parse(jsonStr);
      } catch (parseError) {
        console.error(
          "[AIAnalyzer] Failed to parse AI response as JSON:",
          jsonStr.substring(0, 500)
        );
        throw new Error("AI response was not valid JSON");
      }

      // Handle null fields - convert to undefined for Zod validation
      if (parsed && typeof parsed === "object") {
        if ("url" in parsed && parsed.url === null) {
          parsed.url = undefined;
        }
        if ("published_date" in parsed && parsed.published_date === null) {
          parsed.published_date = undefined;
        }
        if ("source" in parsed && parsed.source === null) {
          parsed.source = undefined;
        }
        if ("category" in parsed && parsed.category === null) {
          parsed.category = undefined;
        }
      }

      let result = AIAnalysisSchema.parse(parsed);

      // Normalize tool names using our mapping system
      result = {
        ...result,
        tool_mentions: ToolMapper.processToolMentions(result.tool_mentions),
      };

      return {
        ...result,
        model: "Claude 4 Sonnet", // Display friendly model name using Claude 4
      };
    } catch (error) {
      console.error("[AIAnalyzer] Analysis failed:", error);

      // Provide clear error messages for missing API key
      if (error instanceof Error) {
        if (error.message.includes("OPENROUTER_API_KEY is not configured")) {
          throw new Error(
            "AI analysis unavailable. Please configure OPENROUTER_API_KEY in environment variables."
          );
        }
      }

      throw new Error(
        `AI analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
}

/**
 * Rankings Calculator Service
 */
export class RankingsCalculator {
  /**
   * Calculate predicted ranking changes based on article analysis
   */
  calculateRankingChanges(
    analysis: AIAnalysisResult,
    currentRankings: any[] // Current rankings from DB or static file
  ): DryRunResult["predictedChanges"] {
    const changes: DryRunResult["predictedChanges"] = [];

    console.log(`[RankingsCalculator] Processing ${analysis.tool_mentions.length} tool mentions`);
    console.log(`[RankingsCalculator] Current rankings count: ${currentRankings.length}`);

    // Process each tool mention
    for (const mention of analysis.tool_mentions) {
      // Handle both database format (with data field) and direct array format
      let rankingData: any[];

      // Check if this is database format with a data field or direct array
      if (currentRankings.length > 0 && currentRankings[0].data) {
        // Database format - extract from data field
        rankingData = currentRankings[0].data as any[];
        console.log(
          `[RankingsCalculator] Using database format, found ${rankingData?.length || 0} tools`
        );
      } else {
        // Direct array format (from our fallback)
        rankingData = currentRankings;
        console.log(
          `[RankingsCalculator] Using direct format, found ${rankingData?.length || 0} tools`
        );
      }

      if (!rankingData || rankingData.length === 0) {
        console.log("[RankingsCalculator] No ranking data available");
        continue;
      }

      // Normalize the tool name before searching
      const normalizedToolName = ToolMapper.normalizeTool(mention.tool);
      console.log(
        `[RankingsCalculator] Looking for tool: "${mention.tool}" -> normalized: "${normalizedToolName}"`
      );

      const currentTool = rankingData.find((r: any) => {
        // Debug log to see what we're comparing
        if (mention.tool === "Claude Code" || mention.tool === "GitHub Copilot") {
          console.log(
            `[RankingsCalculator] Comparing: tool_name="${r.tool_name}" vs normalized="${normalizedToolName}" vs original="${mention.tool}"`
          );
        }
        const matches =
          r.tool_name === normalizedToolName ||
          r.tool_name === mention.tool ||
          r.name === normalizedToolName;
        if (matches) {
          console.log(`[RankingsCalculator] Found match: ${r.tool_name || r.name}`);
        }
        return matches;
      });

      if (currentTool) {
        console.log(
          `[RankingsCalculator] Processing tool: ${normalizedToolName} with rank ${currentTool.rank}`
        );
        console.log(
          `[RankingsCalculator] Mention sentiment: ${mention.sentiment}, relevance: ${mention.relevance}`
        );

        // Calculate impact based on sentiment and relevance
        // Sentiment: -1 (very negative) to 1 (very positive)
        // Relevance: 0 (barely mentioned) to 1 (central to article)
        // Importance score: 0-10 (how significant the news is)

        // Start with base score change calculation
        // Higher relevance = more impact on score
        const basePoints = mention.relevance * 3; // 0-3 points based on relevance

        // Apply sentiment (positive increases, negative decreases)
        let scoreChangePoints = basePoints * mention.sentiment;

        // Scale by article importance (0-10 scale)
        // More important articles have bigger impact
        const importanceMultiplier = 0.5 + analysis.importance_score / 20; // 0.5-1.0 multiplier
        scoreChangePoints *= importanceMultiplier;

        // Additional factors based on context
        const contextLower = mention.context.toLowerCase();

        // Major positive events get significant boosts
        if (mention.sentiment > 0) {
          if (contextLower.includes("funding")) {
            // Check for funding amounts
            const fundingMatch = contextLower.match(/\$(\d+)([mb])/i);
            if (fundingMatch) {
              const amount = parseInt(fundingMatch[1] ?? "0", 10);
              const unit = fundingMatch[2]?.toLowerCase() ?? "m";
              const amountInMillions = unit === "b" ? amount * 1000 : amount;

              // Scale based on funding size
              if (amountInMillions >= 400) {
                scoreChangePoints += 4; // Major funding (400M+)
              } else if (amountInMillions >= 200) {
                scoreChangePoints += 3; // Large funding (200-400M)
              } else if (amountInMillions >= 100) {
                scoreChangePoints += 2; // Significant funding (100-200M)
              } else if (amountInMillions >= 50) {
                scoreChangePoints += 1.5; // Moderate funding (50-100M)
              } else {
                scoreChangePoints += 0.5; // Small funding
              }
            }
          }
          if (
            contextLower.includes("launch") ||
            contextLower.includes("release") ||
            contextLower.includes("announces")
          ) {
            // Product launch or major announcement
            scoreChangePoints += 2;
          }
          if (contextLower.includes("partnership") || contextLower.includes("acquisition")) {
            // Strategic partnership or acquisition
            scoreChangePoints += 1.5;
          }
          if (contextLower.includes("breakthrough") || contextLower.includes("revolutionary")) {
            // Major technological advancement
            scoreChangePoints += 2.5;
          }
        }

        // Major negative events get significant penalties
        if (mention.sentiment < 0) {
          if (
            contextLower.includes("breach") ||
            contextLower.includes("hack") ||
            contextLower.includes("vulnerability")
          ) {
            scoreChangePoints -= 3;
          }
          if (
            contextLower.includes("lawsuit") ||
            contextLower.includes("sued") ||
            contextLower.includes("litigation")
          ) {
            scoreChangePoints -= 2;
          }
          if (
            contextLower.includes("shutdown") ||
            contextLower.includes("discontinued") ||
            contextLower.includes("cancelled")
          ) {
            scoreChangePoints -= 5;
          }
          if (contextLower.includes("layoff") || contextLower.includes("downsizing")) {
            scoreChangePoints -= 1.5;
          }
        }

        // Ensure the score change is meaningful but not excessive
        // Cap at ±10 points for a single article mention
        scoreChangePoints = Math.max(-10, Math.min(10, scoreChangePoints));

        // Convert points to percentage change (our scores are 0-100)
        const scoreChange = scoreChangePoints / 100;

        // Current score is in decimal format (0-1) based on our data
        const currentScore = currentTool.score > 1 ? currentTool.score / 100 : currentTool.score;
        const newScore = Math.max(0, Math.min(1, currentScore + scoreChange));

        // Calculate the actual points change for display (on a 100-point scale)
        const displayScoreChange = scoreChangePoints;

        // Estimate rank change based on score change
        // Positive score change = better rank (lower number, so negative rank change)
        // Negative score change = worse rank (higher number, so positive rank change)
        let rankChange = 0;
        if (Math.abs(scoreChangePoints) >= 0.5) {
          // Estimate rank change based on score points
          // Roughly 1 rank position per 2 score points
          if (scoreChangePoints > 0) {
            // Positive score change improves rank (negative rank change)
            rankChange = -Math.max(1, Math.round(Math.abs(scoreChangePoints) / 2));
          } else {
            // Negative score change worsens rank (positive rank change)
            rankChange = Math.max(1, Math.round(Math.abs(scoreChangePoints) / 2));
          }
        }

        console.log(
          `[RankingsCalculator] Calculated impact: scoreChangePoints=${scoreChangePoints.toFixed(2)}, scoreChange=${scoreChange.toFixed(4)}, rankChange=${rankChange}`
        );

        // Use rank or position field (rank is the newer field)
        const currentRank = currentTool.rank ?? currentTool.position ?? 0;

        // Extract tool ID - handle both flat and nested structures
        let toolId = currentTool.tool_id || currentTool.id;
        if (!toolId && currentTool.tool) {
          // Handle nested tool object structure
          toolId = currentTool.tool.id;
        }

        changes.push({
          toolId: toolId || `tool-${normalizedToolName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
          toolName: normalizedToolName, // Use normalized name for consistency
          currentRank: currentRank,
          predictedRank: Math.max(1, currentRank + rankChange), // Add rank change (negative improves, positive worsens)
          rankChange: rankChange,
          currentScore: currentScore * 100, // Convert to percentage for display
          predictedScore: newScore * 100, // Convert to percentage for display
          scoreChange: displayScoreChange, // Use the points change for display
          metrics: {
            sentiment: { old: 0, new: mention.sentiment, change: mention.sentiment },
            relevance: { old: 0, new: mention.relevance, change: mention.relevance },
          },
        });
      } else {
        console.log(`[RankingsCalculator] Tool not found in rankings: ${normalizedToolName}`);
      }
    }

    return changes;
  }

  /**
   * Identify new tools and companies from analysis
   */
  identifyNewEntities(
    analysis: AIAnalysisResult,
    existingTools: string[],
    existingCompanies: string[]
  ): {
    newTools: DryRunResult["newTools"];
    newCompanies: DryRunResult["newCompanies"];
  } {
    const newTools: DryRunResult["newTools"] = [];
    const newCompanies: DryRunResult["newCompanies"] = [];

    // Check for new tools
    for (const mention of analysis.tool_mentions) {
      // Normalize tool name before checking
      const normalizedToolName = ToolMapper.normalizeTool(mention.tool);
      if (!existingTools.includes(normalizedToolName) && !existingTools.includes(mention.tool)) {
        // Determine category based on tool name or context
        const category = this.inferToolCategory(mention.tool, mention.context);

        newTools.push({
          name: mention.tool,
          category,
          // Try to match with company mentions
          companyId: undefined, // Would need to resolve this
        });
      }
    }

    // Check for new companies
    for (const mention of analysis.company_mentions) {
      if (!existingCompanies.includes(mention.company)) {
        newCompanies.push({
          name: mention.company,
          website: undefined, // Would need to extract or lookup
        });
      }
    }

    return { newTools, newCompanies };
  }

  /**
   * Infer tool category from name and context
   */
  private inferToolCategory(toolName: string, context: string): string {
    const categories = {
      "code-assistant": ["copilot", "codewhisperer", "tabnine", "kite"],
      llm: ["gpt", "claude", "gemini", "llama", "mistral"],
      "image-generation": ["dall-e", "midjourney", "stable diffusion", "imagen"],
      chat: ["chatgpt", "bard", "perplexity", "character.ai"],
      "autonomous-agent": ["devin", "cursor", "aider", "sweep"],
    };

    const lowerName = toolName.toLowerCase();
    const lowerContext = context.toLowerCase();

    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some((kw) => lowerName.includes(kw) || lowerContext.includes(kw))) {
        return category;
      }
    }

    return "other";
  }
}

/**
 * Main Article Ingestion Service
 */
export class ArticleIngestionService {
  private contentExtractor: ContentExtractor;
  private aiAnalyzer: AIAnalyzer;
  private rankingsCalculator: RankingsCalculator;

  constructor() {
    this.contentExtractor = new ContentExtractor();
    this.aiAnalyzer = new AIAnalyzer();
    this.rankingsCalculator = new RankingsCalculator();
  }

  /**
   * Get current system state (rankings, tools, companies) for analysis
   */
  private async getCurrentState(_isDryRun: boolean): Promise<{
    currentRankings: Ranking[];
    existingTools: string[];
    existingCompanies: string[];
  }> {
    try {
      // For dry runs or when database is unavailable, use static data
      console.log("[ArticleIngestionService] Loading static rankings data for analysis");

      // Static rankings file no longer exists, return empty data
      return {
        currentRankings: [],
        existingTools: [],
        existingCompanies: [],
      };
    } catch (error) {
      console.error("[ArticleIngestionService] Failed to load static rankings:", error);
      return {
        currentRankings: [],
        existingTools: [],
        existingCompanies: [],
      };
    }
  }

  /**
   * Process article ingestion (dry run or complete)
   */
  async ingestArticle(input: ArticleIngestionInput): Promise<DryRunResult | Article> {
    console.log(`[ArticleIngestion] Starting ${input.dryRun ? "dry run" : "full ingestion"}`);

    try {
      // Step 1: Extract content
      let content: string = "";
      let sourceUrl: string | undefined;

      switch (input.type) {
        case "url":
          if (!input.input) {
            throw new Error("URL input is required for URL type");
          }
          sourceUrl = input.input;
          content = await this.contentExtractor.extractFromUrl(input.input);
          break;
        case "file":
          if (!input.mimeType || !input.fileName || !input.input) {
            throw new Error("File ingestion requires input, mimeType and fileName");
          }
          content = await this.contentExtractor.extractFromFile(
            input.input,
            input.mimeType,
            input.fileName
          );
          break;
        case "text":
          if (!input.input) {
            throw new Error("Text input is required for text type");
          }
          content = input.input;
          break;
      }

      // Step 2: Analyze content with AI
      const analysis = await this.aiAnalyzer.analyzeContent(content, {
        url: sourceUrl,
        fileName: input.fileName,
        author: input.metadata?.author,
      });

      // Step 3: Get current state for comparison
      const { currentRankings, existingTools, existingCompanies } = await this.getCurrentState(
        input.dryRun
      );

      // Step 4: Calculate predicted changes
      const predictedChanges = this.rankingsCalculator.calculateRankingChanges(
        analysis,
        currentRankings
      );

      const { newTools, newCompanies } = this.rankingsCalculator.identifyNewEntities(
        analysis,
        existingTools,
        existingCompanies
      );

      // Step 5: Prepare result
      if (input.dryRun) {
        // Return dry run result
        const dryRunResult: DryRunResult = {
          article: {
            title: analysis.title,
            summary: analysis.summary,
            content: `${content.substring(0, 1000)}...`,
            ingestionType: input.type,
            sourceUrl,
            sourceName: analysis.source,
            fileName: input.fileName,
            fileType: input.mimeType,
            tags: analysis.tags,
            category: analysis.category,
            importanceScore: analysis.importance_score,
            sentimentScore: analysis.overall_sentiment?.toString() || "0",
            toolMentions: analysis.tool_mentions,
            companyMentions: analysis.company_mentions,
            author: input.metadata?.author,
            publishedDate: analysis.published_date ? new Date(analysis.published_date) : undefined,
          },
          predictedChanges,
          newTools,
          newCompanies,
          summary: {
            totalToolsAffected: predictedChanges.length,
            totalNewTools: newTools.length,
            totalNewCompanies: newCompanies.length,
            averageRankChange:
              predictedChanges.reduce((sum, c) => sum + (c.rankChange || 0), 0) /
              (predictedChanges.length || 1),
            averageScoreChange:
              predictedChanges.reduce((sum, c) => sum + (c.scoreChange || 0), 0) /
              (predictedChanges.length || 1),
          },
        };

        return dryRunResult;
      } else {
        // TODO: Implement full ingestion with database saves
        // This would:
        // 1. Save article to database
        // 2. Create new tools/companies if needed
        // 3. Apply ranking changes
        // 4. Log the processing
        // 5. Return the saved article

        throw new Error("Full ingestion not yet implemented");
      }
    } catch (error) {
      console.error("[ArticleIngestion] Error:", error);
      throw error;
    }
  }

  /**
   * Update existing article (text only, no recalculation)
   */
  async updateArticle(
    _articleId: string,
    _updates: Partial<Pick<Article, "title" | "summary" | "content" | "tags" | "category">>
  ): Promise<Article> {
    // TODO: Implement article update
    throw new Error("Article update not yet implemented");
  }

  /**
   * Recalculate rankings for an article
   */
  async recalculateArticleRankings(_articleId: string): Promise<void> {
    // TODO: Implement recalculation
    // This would re-analyze the article and update rankings
    throw new Error("Recalculation not yet implemented");
  }

  /**
   * Delete article and rollback its ranking changes
   */
  async deleteArticle(_articleId: string): Promise<void> {
    // TODO: Implement deletion with rollback
    // This would:
    // 1. Load the rankings snapshot
    // 2. Rollback all changes made by this article
    // 3. Mark the article as deleted
    // 4. Keep any tools/companies that were created
    throw new Error("Article deletion not yet implemented");
  }
}
