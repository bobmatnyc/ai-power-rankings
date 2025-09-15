/**
 * Article Ingestion Service
 * Handles content extraction, analysis, and storage of articles
 */

import { z } from "zod";
import { getOpenRouterApiKey } from "@/lib/startup-validation";
import type { Article, DryRunResult } from "@/lib/db/article-schema";
import type { Ranking } from "@/lib/db/schema";
import type { RankingEntry } from "@/lib/json-db/schemas";

// Validation schemas
export const ArticleIngestionSchema = z.object({
  input: z.string().min(1),
  type: z.enum(["url", "text", "file"]),
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
});

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
      throw new Error(`Failed to extract content from URL: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Extract content from file
   */
  async extractFromFile(base64Content: string, mimeType: string, fileName: string): Promise<string> {
    console.log(`[ContentExtractor] Processing file: ${fileName} (${mimeType})`);

    const buffer = Buffer.from(base64Content, "base64");

    if (mimeType === "application/pdf") {
      return this.extractFromPdf(buffer);
    } else if (mimeType.startsWith("text/") || mimeType === "application/json" || fileName.endsWith(".md")) {
      return buffer.toString("utf-8");
    } else if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
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
      throw new Error(`PDF extraction failed: ${error instanceof Error ? error.message : "Unknown error"}`);
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
        const extracted = matches
          .map((match) => match.replace(/<[^>]+>/g, ""))
          .join(" ");
        return extracted.substring(0, 15000);
      }

      throw new Error("Could not extract text from DOCX");
    } catch (error) {
      throw new Error(`DOCX extraction failed: ${error instanceof Error ? error.message : "Unknown error"}`);
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
  async analyzeContent(content: string, metadata?: {
    url?: string;
    fileName?: string;
    author?: string;
  }): Promise<AIAnalysisResult & { model: string }> {
    console.log("[AIAnalyzer] Starting content analysis");

    const systemPrompt = `You are an expert AI industry analyst specializing in AI tools, technologies, and market trends.
Your task is to analyze articles and extract structured information about AI tools, companies, and their potential impact on rankings.

Focus on:
1. Identifying ALL AI tools, models, and services mentioned (GPT, Claude, Gemini, Copilot, etc.)
2. Understanding the context and sentiment around each tool
3. Identifying companies behind the tools
4. Predicting potential ranking impacts based on the news
5. Extracting key insights and trends

Be thorough and precise in your analysis.

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
      "tool": "Exact tool name (e.g., 'GPT-4', 'Claude 3.5')",
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

        throw new Error(`OpenRouter API error (${response.status}): ${errorText.substring(0, 200)}`);
      }

      const responseText = await response.text();
      let data: any;

      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error("[AIAnalyzer] Failed to parse OpenRouter response:", responseText.substring(0, 500));
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
        console.error("[AIAnalyzer] Failed to parse AI response as JSON:", jsonStr.substring(0, 500));
        throw new Error("AI response was not valid JSON");
      }

      // Handle null fields - convert to undefined for Zod validation
      if (parsed && typeof parsed === 'object') {
        if ('url' in parsed && parsed.url === null) {
          parsed.url = undefined;
        }
        if ('published_date' in parsed && parsed.published_date === null) {
          parsed.published_date = undefined;
        }
        if ('source' in parsed && parsed.source === null) {
          parsed.source = undefined;
        }
        if ('category' in parsed && parsed.category === null) {
          parsed.category = undefined;
        }
      }

      const result = AIAnalysisSchema.parse(parsed);
      return {
        ...result,
        model: "Claude 4 Sonnet", // Display friendly model name using Claude 4
      };
    } catch (error) {
      console.error("[AIAnalyzer] Analysis failed:", error);
      throw new Error(`AI analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`);
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
    currentRankings: Ranking[] // Current rankings from DB
  ): DryRunResult["predictedChanges"] {
    const changes: DryRunResult["predictedChanges"] = [];

    // Process each tool mention
    for (const mention of analysis.tool_mentions) {
      // Extract ranking entries from the JSONB data field
      const rankingData = currentRankings[0]?.data as RankingEntry[] | undefined;

      if (!rankingData) {
        continue;
      }

      const currentTool = rankingData.find((r) => r.tool_name === mention.tool);

      if (currentTool) {
        // Calculate impact based on sentiment and relevance
        const impactFactor = mention.sentiment * mention.relevance * (analysis.importance_score / 10);

        // Estimate score change (simplified calculation)
        const scoreChange = impactFactor * 0.05; // Max 5% change per article
        const newScore = Math.max(0, Math.min(1, currentTool.score + scoreChange));

        // Estimate rank change (would need full recalculation in practice)
        const rankChange = Math.round(scoreChange * 10); // Simplified

        // Use rank or position field (rank is the newer field)
        const currentRank = currentTool.rank ?? currentTool.position ?? 0;

        changes.push({
          toolId: currentTool.tool_id,
          toolName: mention.tool,
          currentRank: currentRank,
          predictedRank: Math.max(1, currentRank - rankChange),
          rankChange: rankChange,
          currentScore: currentTool.score,
          predictedScore: newScore,
          scoreChange: scoreChange,
          metrics: {
            sentiment: { old: 0.5, new: mention.sentiment, change: mention.sentiment - 0.5 },
            relevance: { old: 0.5, new: mention.relevance, change: mention.relevance - 0.5 },
          },
        });
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
      if (!existingTools.includes(mention.tool)) {
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
      "llm": ["gpt", "claude", "gemini", "llama", "mistral"],
      "image-generation": ["dall-e", "midjourney", "stable diffusion", "imagen"],
      "chat": ["chatgpt", "bard", "perplexity", "character.ai"],
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
   * Process article ingestion (dry run or complete)
   */
  async ingestArticle(input: ArticleIngestionInput): Promise<DryRunResult | Article> {
    console.log(`[ArticleIngestion] Starting ${input.dryRun ? "dry run" : "full ingestion"}`);

    try {
      // Step 1: Extract content
      let content: string;
      let sourceUrl: string | undefined;

      switch (input.type) {
        case "url":
          sourceUrl = input.input;
          content = await this.contentExtractor.extractFromUrl(input.input);
          break;
        case "file":
          if (!input.mimeType || !input.fileName) {
            throw new Error("File ingestion requires mimeType and fileName");
          }
          content = await this.contentExtractor.extractFromFile(
            input.input,
            input.mimeType,
            input.fileName
          );
          break;
        case "text":
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
      // TODO: Fetch from database
      const currentRankings: Ranking[] = []; // Placeholder - should be fetched from DB
      const existingTools: string[] = []; // Placeholder
      const existingCompanies: string[] = []; // Placeholder

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
            sentimentScore: analysis.overall_sentiment.toString(),
            toolMentions: analysis.tool_mentions,
            companyMentions: analysis.company_mentions,
            author: input.metadata?.author,
            publishedDate: analysis.published_date
              ? new Date(analysis.published_date)
              : undefined,
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