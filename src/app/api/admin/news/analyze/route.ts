import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";

const AnalyzeRequestSchema = z.object({
  input: z.string().min(1),
  type: z.enum(["url", "text"]),
});

const OpenRouterResponseSchema = z.object({
  title: z.string(),
  summary: z.string(),
  source: z.string(),
  url: z.string().optional(),
  published_date: z.string(),
  tool_mentions: z.array(
    z.object({
      tool: z.string(),
      context: z.string(),
      sentiment: z.number().min(-1).max(1),
    })
  ),
  overall_sentiment: z.number().min(-1).max(1),
  key_topics: z.array(z.string()),
  importance_score: z.number().min(0).max(10),
  qualitative_metrics: z
    .object({
      innovation_boost: z.number(),
      business_sentiment: z.number(),
      development_velocity: z.number(),
      market_traction: z.number(),
    })
    .optional(),
});

async function fetchArticleContent(url: string): Promise<string> {
  console.log("[News Analysis] Fetching article content from:", url);

  try {
    // Try to fetch the article content
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AINewsBot/1.0)",
      },
    });

    if (!response.ok) {
      console.error(
        `[News Analysis] Failed to fetch article from ${url}: ${response.status} ${response.statusText}`
      );
      throw new Error(`Failed to fetch article: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();

    // Simple HTML to text extraction (in production, use a proper HTML parser)
    const text = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return text.substring(0, 10000); // Limit to 10k chars
  } catch (error) {
    throw new Error(
      `Failed to fetch article: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

// Fallback analysis when OpenRouter is unavailable
function performFallbackAnalysis(content: string, url?: string) {
  console.log("[News Analysis] Using fallback analysis method");

  // Extract potential tool mentions
  const toolPatterns = [
    /\b(GPT-4|GPT-3|ChatGPT|OpenAI|Claude|Anthropic|Gemini|Bard|LLaMA|Mistral|Copilot|GitHub Copilot|Cursor|v0|Vercel|Next\.js|React|TypeScript|Python|JavaScript|AI|ML|machine learning|artificial intelligence)\b/gi,
  ];

  interface FallbackToolMention {
    tool: string;
    context: string;
    sentiment: number;
  }

  const toolMentions: FallbackToolMention[] = [];
  const seenTools = new Set<string>();

  for (const pattern of toolPatterns) {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      const tool = match[0];
      const normalizedTool = tool.toLowerCase();
      if (!seenTools.has(normalizedTool)) {
        seenTools.add(normalizedTool);
        const matchIndex = match.index ?? 0;
        const contextStart = Math.max(0, matchIndex - 50);
        const contextEnd = Math.min(content.length, matchIndex + tool.length + 50);
        const context = content.substring(contextStart, contextEnd).trim();

        toolMentions.push({
          tool: tool,
          context: context,
          sentiment: 0, // Neutral sentiment as fallback
        });
      }
    }
  }

  // Extract first sentence as title
  const firstSentence = content.match(/^[^.!?]+[.!?]/)?.[0] || "News Article";
  const title = firstSentence.length > 100 ? `${firstSentence.substring(0, 97)}...` : firstSentence;

  // Create summary from first 200 characters
  const summary =
    content.length > 200
      ? `${content.substring(0, 197).replace(/\s+/g, " ").trim()}...`
      : content.replace(/\s+/g, " ").trim();

  // Extract domain from URL if available
  let source = "Unknown";
  if (url) {
    try {
      const urlObj = new URL(url);
      source = urlObj.hostname.replace("www.", "");
    } catch {
      source = "Web";
    }
  }

  // Extract key topics (simple word frequency)
  const words = content.toLowerCase().split(/\s+/);
  const wordFreq = new Map<string, number>();
  const stopWords = new Set([
    "the",
    "a",
    "an",
    "and",
    "or",
    "but",
    "in",
    "on",
    "at",
    "to",
    "for",
    "of",
    "with",
    "by",
    "from",
    "as",
    "is",
    "was",
    "are",
    "were",
    "been",
    "be",
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "will",
    "would",
    "could",
    "should",
    "may",
    "might",
    "can",
    "shall",
    "must",
    "ought",
    "i",
    "you",
    "he",
    "she",
    "it",
    "we",
    "they",
    "them",
    "their",
    "this",
    "that",
    "these",
    "those",
  ]);

  for (const word of words) {
    const cleaned = word.replace(/[^a-z0-9]/g, "");
    if (cleaned.length > 3 && !stopWords.has(cleaned)) {
      wordFreq.set(cleaned, (wordFreq.get(cleaned) || 0) + 1);
    }
  }

  const keyTopics = Array.from(wordFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word]) => word);

  return {
    title,
    summary,
    source,
    url: url || "",
    published_date: new Date().toISOString().split("T")[0],
    tool_mentions: toolMentions,
    overall_sentiment: 0,
    key_topics: keyTopics,
    importance_score: 5,
    qualitative_metrics: {
      innovation_boost: 2.5,
      business_sentiment: 0,
      development_velocity: 2.5,
      market_traction: 2.5,
    },
    _fallback: true, // Mark this as a fallback analysis
  };
}

async function analyzeWithOpenRouter(content: string, url?: string) {
  const openRouterKey = process.env["OPENROUTER_API_KEY"];

  if (!openRouterKey) {
    console.error("[News Analysis] OPENROUTER_API_KEY is not configured in environment variables");
    throw new Error(
      "OpenRouter API key not configured. Please set OPENROUTER_API_KEY in your environment variables."
    );
  }

  // Log key info for debugging (safely)
  console.log(
    "[News Analysis] Using OpenRouter API key starting with:",
    `${openRouterKey.substring(0, 10)}...`
  );

  const systemPrompt = `You are an AI news analyst specializing in AI tools and technology. 
Analyze the provided news article and extract structured information about AI tools mentioned.
Focus on identifying tool mentions, sentiment, key topics, and qualitative metrics.
Return a JSON object matching the exact schema provided.`;

  const userPrompt = `Analyze this news article and extract the following information:
1. Title (infer if not obvious)
2. Summary (2-3 sentences)
3. Source (publication name or domain)
4. Published date (estimate if needed, format: YYYY-MM-DD)
5. Tool mentions with context and sentiment (-1 to 1)
6. Overall sentiment about AI/tech (-1 to 1)
7. Key topics (5-10 keywords)
8. Importance score (0-10, based on impact and relevance)
9. Qualitative metrics:
   - innovation_boost (0-5): How innovative are the developments?
   - business_sentiment (-2 to 2): Business/market sentiment
   - development_velocity (0-5): Speed of development/releases
   - market_traction (0-5): Market adoption/traction

Article content:
${content.substring(0, 8000)}

${url ? `Article URL: ${url}` : ""}

Return ONLY a valid JSON object with no additional text or markdown formatting.`;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openRouterKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env["NEXT_PUBLIC_BASE_URL"] || "http://localhost:3000",
        "X-Title": "AI Power Rankings Admin",
      },
      body: JSON.stringify({
        model: "anthropic/claude-3-haiku",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `OpenRouter API error (${response.status}): ${errorText}`;

      // Parse error response if it's JSON
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error?.message) {
          errorMessage = `OpenRouter API error: ${errorJson.error.message}`;

          // Provide specific guidance for common errors
          if (response.status === 401) {
            errorMessage +=
              " - Please check that your OPENROUTER_API_KEY is valid and has not expired.";
          } else if (response.status === 429) {
            errorMessage += " - Rate limit exceeded. Please wait and try again.";
          } else if (response.status === 402) {
            errorMessage +=
              " - Insufficient credits. Please add credits to your OpenRouter account.";
          }
        }
      } catch {
        // If error text is not JSON, use as-is
      }

      console.error("[News Analysis] OpenRouter API error:", errorMessage);
      throw new Error(errorMessage);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error("No response from OpenRouter");
    }

    // Parse the JSON response
    let parsed: unknown;
    try {
      // Remove any markdown code blocks if present
      const jsonStr = content.replace(/```json\n?|\n?```/g, "").trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse OpenRouter response:", content);
      throw new Error("Invalid JSON response from AI");
    }

    // Validate and return
    const validated = OpenRouterResponseSchema.parse(parsed);

    // Ensure URL is included if it was provided
    if (url && !validated.url) {
      validated.url = url;
    }

    // Set source from URL if not provided
    if (!validated.source && url) {
      try {
        const urlObj = new URL(url);
        validated.source = urlObj.hostname.replace("www.", "");
      } catch {
        validated.source = "Unknown";
      }
    }

    return validated;
  } catch (error) {
    console.error("[News Analysis] OpenRouter analysis error:", error);

    // Add more context to the error
    if (error instanceof Error) {
      if (error.message.includes("401") || error.message.includes("User not found")) {
        throw new Error(
          "Authentication failed with OpenRouter. Please verify your OPENROUTER_API_KEY is valid."
        );
      } else if (error.message.includes("fetch")) {
        throw new Error(
          "Network error connecting to OpenRouter API. Please check your internet connection."
        );
      }
    }

    throw error;
  }
}

export async function POST(request: NextRequest) {
  console.log("[News Analysis] Received analysis request");

  try {
    // Import auth utilities at the top of the function
    const { shouldBypassAuth } = await import("@/lib/auth-utils");

    // Skip authentication check for local development
    if (!shouldBypassAuth()) {
      const session = await auth();
      if (!session?.user?.isAdmin) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    } else {
      console.log("🔓 Local environment - bypassing auth for news analysis");
    }

    const body = await request.json();
    const { input, type } = AnalyzeRequestSchema.parse(body);

    let content: string;
    let url: string | undefined;

    if (type === "url") {
      url = input;
      content = await fetchArticleContent(url);
    } else {
      content = input;
    }

    let analysis:
      | z.infer<typeof OpenRouterResponseSchema>
      | ReturnType<typeof performFallbackAnalysis>;
    let usingFallback = false;

    try {
      // Try OpenRouter first
      analysis = await analyzeWithOpenRouter(content, url);
    } catch (openRouterError) {
      console.warn("[News Analysis] OpenRouter failed, using fallback:", openRouterError);

      // Use fallback analysis
      usingFallback = true;
      analysis = performFallbackAnalysis(content, url);

      // Add a warning to the response
      console.log("[News Analysis] Fallback analysis completed");
    }

    return NextResponse.json({
      success: true,
      analysis,
      warning: usingFallback
        ? "Analysis performed using fallback method due to OpenRouter API issues. For better results, please ensure OPENROUTER_API_KEY is valid."
        : undefined,
    });
  } catch (error) {
    console.error("[News Analysis] Request error:", error);

    // Determine appropriate status code based on error type
    let statusCode = 500;
    let errorMessage = "Failed to analyze news";
    const errorDetails: Record<string, unknown> = {};

    if (error instanceof Error) {
      errorMessage = error.message;

      // Set appropriate status codes for different error types
      if (
        error.message.includes("401") ||
        error.message.includes("Authentication") ||
        error.message.includes("User not found")
      ) {
        statusCode = 401;
        errorDetails.type = "authentication_error";
        errorDetails.solution = "Please check your OPENROUTER_API_KEY in the environment variables";
      } else if (error.message.includes("429") || error.message.includes("Rate limit")) {
        statusCode = 429;
        errorDetails.type = "rate_limit_error";
      } else if (error.message.includes("402") || error.message.includes("credits")) {
        statusCode = 402;
        errorDetails.type = "payment_required";
      } else if (error.message.includes("fetch") || error.message.includes("Network")) {
        statusCode = 503;
        errorDetails.type = "network_error";
      } else if (error.message.includes("validation") || error.message.includes("parse")) {
        statusCode = 400;
        errorDetails.type = "validation_error";
      }

      // Include stack trace in development only
      if (process.env["NODE_ENV"] === "development") {
        errorDetails.stack = error.stack;
      }
    }

    return NextResponse.json(
      {
        error: errorMessage,
        ...errorDetails,
      },
      { status: statusCode }
    );
  }
}
