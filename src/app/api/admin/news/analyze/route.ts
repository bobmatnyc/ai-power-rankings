import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOpenRouterApiKey } from "@/lib/startup-validation";

const AnalyzeRequestSchema = z.object({
  input: z.string().min(1),
  type: z.enum(["url", "text", "file"]),
  filename: z.string().optional(),
  mimeType: z.string().optional(),
  verbose: z.boolean().optional(),
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

async function analyzeWithOpenRouter(content: string, url?: string, verbose = false) {
  const startTime = Date.now();

  // Get API key using validation helper - will throw if not configured
  const openRouterKey = getOpenRouterApiKey();

  // Enhanced debugging with timing
  if (verbose) {
    console.log("[News Analysis] === OPENROUTER API CALL DEBUG ===");
    console.log("[News Analysis] Timestamp:", new Date().toISOString());
    console.log(
      "[News Analysis] API Key (first 10 chars):",
      `${openRouterKey.substring(0, 10)}...`
    );
    console.log("[News Analysis] Content length:", content.length, "characters");
    console.log("[News Analysis] URL:", url || "N/A");
  }

  const systemPrompt = `You are an AI news analyst specializing in AI tools and technology. 
Analyze the provided news article and extract structured information about AI tools mentioned.
Focus on identifying specific tool/product names (like GPT-4, Claude, Gemini, Copilot, ChatGPT, Midjourney, etc.), 
sentiment about each tool, key topics, and qualitative metrics.
Be very thorough in identifying ALL mentioned AI tools, models, and services.
Return a JSON object matching the exact schema provided.`;

  const userPrompt = `Analyze this news article and extract the following information:
1. Title (infer if not obvious)
2. Summary (2-3 sentences)
3. Source (publication name or domain)
4. Published date (estimate if needed, format: YYYY-MM-DD)
5. Tool mentions - IMPORTANT: List EVERY AI tool, model, or service mentioned by name:
   - Include: GPT models (GPT-3, GPT-4, GPT-5), Claude models, Gemini, Copilot, ChatGPT, 
     Midjourney, DALL-E, Stable Diffusion, LLaMA, Bard, Perplexity, Character.AI, 
     Anthropic tools, OpenAI tools, Google AI tools, Microsoft AI tools, etc.
   - For each tool provide: exact tool name, brief context of mention, sentiment (-1 to 1)
   - Use the exact product/tool name as it appears (e.g., "GPT-5" not "OpenAI GPT-5")
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

Return ONLY a valid JSON object with this EXACT structure:
{
  "title": "article title",
  "summary": "2-3 sentence summary",
  "source": "publication name",
  "published_date": "YYYY-MM-DD",
  "tool_mentions": [
    {
      "tool": "exact tool name (e.g., 'GPT-5', 'Claude 3.5', 'Copilot')",
      "context": "brief description of how it's mentioned",
      "sentiment": 0.8
    }
  ],
  "overall_sentiment": 0.9,
  "key_topics": ["topic1", "topic2"],
  "importance_score": 8,
  "qualitative_metrics": {
    "innovation_boost": 4,
    "business_sentiment": 1,
    "development_velocity": 4,
    "market_traction": 3
  }
}`;

  const requestBody = {
    model: "anthropic/claude-3-haiku",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.3,
    max_tokens: 2000,
  };

  // Use correct header names for OpenRouter API
  const requestHeaders = {
    Authorization: `Bearer ${openRouterKey}`,
    "Content-Type": "application/json",
    // OpenRouter expects "Referer" not "HTTP-Referer"
    Referer: process.env["NEXT_PUBLIC_BASE_URL"] || "http://localhost:3000",
    // Also include HTTP-Referer for compatibility
    "HTTP-Referer": process.env["NEXT_PUBLIC_BASE_URL"] || "http://localhost:3000",
    "X-Title": "AI Power Rankings Admin",
  };

  if (verbose) {
    console.log("[News Analysis] Request headers (without auth):", {
      ...requestHeaders,
      Authorization: "Bearer [REDACTED]",
    });
    console.log("[News Analysis] Request model:", requestBody.model);
    console.log("[News Analysis] Message count:", requestBody.messages.length);
    console.log("[News Analysis] Temperature:", requestBody.temperature);
    console.log("[News Analysis] Max tokens:", requestBody.max_tokens);
  }

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: requestHeaders,
      body: JSON.stringify(requestBody),
    });

    const responseTime = Date.now() - startTime;

    if (verbose) {
      console.log("[News Analysis] Response status:", response.status);
      console.log("[News Analysis] Response status text:", response.statusText);
      console.log("[News Analysis] Response time:", `${responseTime}ms`);
      console.log("[News Analysis] Response headers:", {
        "content-type": response.headers.get("content-type"),
        "x-ratelimit-limit": response.headers.get("x-ratelimit-limit"),
        "x-ratelimit-remaining": response.headers.get("x-ratelimit-remaining"),
        "x-ratelimit-reset": response.headers.get("x-ratelimit-reset"),
      });
    }

    if (!response.ok) {
      const errorText = await response.text();

      // Always log authentication errors for debugging
      if (response.status === 401) {
        console.error("[News Analysis] Authentication failed with OpenRouter API");
        console.error("[News Analysis] Response status:", response.status);
        console.error("[News Analysis] Response headers:", {
          "www-authenticate": response.headers.get("www-authenticate"),
          "x-error-code": response.headers.get("x-error-code"),
          "x-error-message": response.headers.get("x-error-message"),
        });
        console.error("[News Analysis] Error response body:", errorText);
        console.error("[News Analysis] API Key format check:");
        console.error(`  - Length: ${openRouterKey.length} characters`);
        console.error(`  - Starts with: ${openRouterKey.substring(0, 10)}...`);
        console.error(`  - Ends with: ...${openRouterKey.substring(openRouterKey.length - 4)}`);
        console.error("[News Analysis] Request headers sent:", {
          ...requestHeaders,
          Authorization: `Bearer ${openRouterKey.substring(0, 10)}...[REDACTED]`,
        });
      } else if (verbose) {
        console.error("[News Analysis] Error response body:", errorText);
      }

      let errorMessage = `OpenRouter API error (${response.status}): ${errorText}`;
      let troubleshootingSteps: string[] = [];

      // Parse error response if it's JSON
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error?.message) {
          errorMessage = `OpenRouter API error: ${errorJson.error.message}`;

          // Log additional error details for authentication failures
          if (response.status === 401 && errorJson.error) {
            console.error("[News Analysis] OpenRouter error details:", errorJson.error);
          }

          // Provide specific guidance for common errors
          if (response.status === 401) {
            troubleshootingSteps = [
              "Verify OPENROUTER_API_KEY is set correctly in .env.local",
              "Check that the API key starts with 'sk-or-' prefix",
              "Ensure the API key has not expired or been revoked",
              "Try regenerating the API key from https://openrouter.ai/keys",
              "Verify the Referer header matches your allowed domains in OpenRouter settings",
            ];
          } else if (response.status === 429) {
            const resetTime = response.headers.get("x-ratelimit-reset");
            troubleshootingSteps = [
              "Rate limit exceeded. Wait before retrying.",
              resetTime
                ? `Rate limit resets at: ${new Date(parseInt(resetTime) * 1000).toLocaleString()}`
                : "Check OpenRouter dashboard for rate limit status",
              `Remaining requests: ${response.headers.get("x-ratelimit-remaining") || "unknown"}`,
            ];
          } else if (response.status === 402) {
            troubleshootingSteps = [
              "Insufficient credits in OpenRouter account",
              "Add credits at https://openrouter.ai/credits",
              "Check your usage at https://openrouter.ai/activity",
            ];
          } else if (response.status === 503) {
            troubleshootingSteps = [
              "OpenRouter service is temporarily unavailable",
              "Check https://status.openrouter.ai/ for service status",
              "Try again in a few minutes",
            ];
          }
        }
      } catch {
        // If error text is not JSON, use as-is
      }

      console.error("[News Analysis] OpenRouter API error:", errorMessage);
      if (troubleshootingSteps.length > 0) {
        console.error("[News Analysis] Troubleshooting steps:", troubleshootingSteps);
      }

      const error = new Error(errorMessage) as Error & {
        statusCode?: number;
        troubleshooting?: string[];
      };
      error.statusCode = response.status;
      error.troubleshooting = troubleshootingSteps;
      throw error;
    }

    const responseText = await response.text();

    if (verbose) {
      console.log("[News Analysis] Raw response length:", responseText.length);
      console.log("[News Analysis] Response preview:", responseText.substring(0, 200));
    }

    let data: unknown;
    try {
      data = JSON.parse(responseText);
    } catch {
      console.error("[News Analysis] Failed to parse response as JSON:", responseText);
      throw new Error("Invalid JSON response from OpenRouter API");
    }

    const content = (data as any).choices?.[0]?.message?.content;

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

    // Validate and return with more lenient handling
    const parsedObj = parsed as any;
    const validated = OpenRouterResponseSchema.parse({
      title: parsedObj.title,
      summary: parsedObj.summary,
      source: parsedObj.source,
      url: parsedObj.url,
      published_date: parsedObj.published_date,
      tool_mentions: parsedObj.tool_mentions?.filter((tm: any) => tm?.tool) || [],
      overall_sentiment: parsedObj.overall_sentiment,
      key_topics: parsedObj.key_topics,
      importance_score: parsedObj.importance_score,
      qualitative_metrics: parsedObj.qualitative_metrics,
    });

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
      if (
        error.message.includes("401") ||
        error.message.includes("User not found") ||
        error.message.includes("Unauthorized")
      ) {
        throw new Error(
          "Authentication failed with OpenRouter. Please verify:\n" +
            "1. OPENROUTER_API_KEY is set correctly in .env.local\n" +
            "2. The API key starts with 'sk-or-' prefix\n" +
            "3. The API key has not been revoked\n" +
            "Get your API key at: https://openrouter.ai/keys"
        );
      } else if (error.message.includes("fetch")) {
        throw new Error(
          "Network error connecting to OpenRouter API. Please check your internet connection."
        );
      } else if (error.message.includes("not configured")) {
        throw new Error(
          "OpenRouter API key is required for news analysis. Please set OPENROUTER_API_KEY in your .env.local file. Get your key at: https://openrouter.ai/keys"
        );
      }
    }

    throw error;
  }
}

// Helper function to extract text from PDF
async function extractTextFromPdf(base64Content: string): Promise<string> {
  console.log("[News Analysis] PDF extraction requested");

  try {
    // Dynamic import to avoid issues with server-side rendering
    const pdfParse = (await import("pdf-parse" as any)).default as any;

    const buffer = Buffer.from(base64Content, "base64");
    const data = await pdfParse(buffer);

    if (!data.text || data.text.length < 100) {
      throw new Error(
        "Could not extract sufficient text from PDF. Please copy and paste the text instead."
      );
    }

    console.log(
      `[News Analysis] Extracted ${data.text.length} characters from PDF (${data.numpages} pages)`
    );

    // Limit to 10k characters for processing
    return data.text.substring(0, 10000);
  } catch (error) {
    console.error("[News Analysis] PDF extraction error:", error);

    // Fallback: try basic text extraction
    try {
      const buffer = Buffer.from(base64Content, "base64");
      const text = buffer.toString("utf-8", 0, Math.min(buffer.length, 10000));
      // Extract readable ASCII text
      const readableText = text
        .replace(/[^\x20-\x7E\n\r\t]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      if (readableText.length >= 100) {
        console.log("[News Analysis] Using fallback text extraction from PDF");
        return readableText;
      }
    } catch {}

    throw new Error(
      "Failed to extract text from PDF. Please use text input or try a different file."
    );
  }
}

// Helper function to extract text from various file types
async function extractTextFromFile(
  base64Content: string,
  mimeType: string,
  filename: string
): Promise<string> {
  console.log(`[News Analysis] Extracting text from file: ${filename} (${mimeType})`);

  if (mimeType === "application/pdf") {
    return extractTextFromPdf(base64Content);
  } else if (mimeType.startsWith("text/") || mimeType === "application/json") {
    // Direct text extraction for text files
    const buffer = Buffer.from(base64Content, "base64");
    return buffer.toString("utf-8");
  } else if (mimeType === "text/markdown" || filename.endsWith(".md")) {
    // Markdown files
    const buffer = Buffer.from(base64Content, "base64");
    return buffer.toString("utf-8");
  } else {
    throw new Error(`Unsupported file type: ${mimeType}. Supported types: .txt, .md, .pdf, .json`);
  }
}

export async function POST(request: NextRequest) {
  const requestStartTime = Date.now();
  console.log("[News Analysis] Received analysis request at", new Date().toISOString());

  try {
    // Check admin authentication
    const { isAdminAuthenticated } = await import("@/lib/admin-auth");
    const isAuthenticated = await isAdminAuthenticated();
    
    if (!isAuthenticated) {
      console.log("[News Analysis] Unauthorized - admin authentication required");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { input, type, filename, mimeType, verbose = false } = AnalyzeRequestSchema.parse(body);

    if (verbose) {
      console.log("[News Analysis] Request details:", {
        type,
        inputLength: input.length,
        filename,
        mimeType,
      });
    }

    let content: string;
    let url: string | undefined;

    if (type === "url") {
      url = input;
      content = await fetchArticleContent(url);
    } else if (type === "file") {
      // Extract text from uploaded file
      if (!mimeType || !filename) {
        throw new Error("File upload requires mimeType and filename");
      }
      content = await extractTextFromFile(input, mimeType, filename);

      if (verbose) {
        console.log("[News Analysis] Extracted text length:", content.length);
        console.log("[News Analysis] Text preview:", content.substring(0, 200));
      }
    } else {
      content = input;
    }

    // Analyze with OpenRouter (no fallback)
    const analysis = await analyzeWithOpenRouter(content, url, verbose);

    const totalTime = Date.now() - requestStartTime;

    const response = {
      success: true,
      analysis,
      debug: verbose
        ? {
            processingTime: `${totalTime}ms`,
            method: "openrouter",
            timestamp: new Date().toISOString(),
          }
        : undefined,
    };

    if (verbose) {
      console.log("[News Analysis] Request completed in", `${totalTime}ms`);
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("[News Analysis] Request error:", error);

    // Determine appropriate status code based on error type
    let statusCode = 500;
    let errorMessage = "Failed to analyze news";
    const errorDetails: Record<string, unknown> = {};

    if (error instanceof Error) {
      errorMessage = error.message;

      // Set appropriate status codes for different error types
      const errorWithDetails = error as Error & {
        statusCode?: number;
        troubleshooting?: string[];
      };
      if (errorWithDetails.statusCode) {
        statusCode = errorWithDetails.statusCode;
      } else if (
        error.message.includes("401") ||
        error.message.includes("Authentication") ||
        error.message.includes("User not found")
      ) {
        statusCode = 401;
        errorDetails["type"] = "authentication_error";
        errorDetails["help"] = [
          "Verify OPENROUTER_API_KEY is set correctly in .env.local",
          "Check that the API key starts with 'sk-or-' prefix",
          "Ensure the API key has not been revoked",
          "Check the Referer header matches your allowed domains in OpenRouter",
        ];
        errorDetails["documentation"] = "https://openrouter.ai/keys";
      } else if (error.message.includes("429") || error.message.includes("Rate limit")) {
        statusCode = 429;
        errorDetails["type"] = "rate_limit_error";
      } else if (error.message.includes("402") || error.message.includes("credits")) {
        statusCode = 402;
        errorDetails["type"] = "payment_required";
      } else if (error.message.includes("fetch") || error.message.includes("Network")) {
        statusCode = 503;
        errorDetails["type"] = "network_error";
      } else if (error.message.includes("validation") || error.message.includes("parse")) {
        statusCode = 400;
        errorDetails["type"] = "validation_error";
      } else if (error.message.includes("Unsupported file type")) {
        statusCode = 415;
        errorDetails["type"] = "unsupported_media_type";
      } else if (error.message.includes("not configured") || error.message.includes("required")) {
        statusCode = 500;
        errorDetails["type"] = "configuration_error";
        errorDetails["help"] =
          "OpenRouter API key is required. Set OPENROUTER_API_KEY in .env.local";
        errorDetails["documentation"] = "https://openrouter.ai/keys";
      }

      // Add troubleshooting steps if available
      if (errorWithDetails.troubleshooting) {
        errorDetails["troubleshooting"] = errorWithDetails.troubleshooting;
      }

      // Include stack trace in development only
      if (process.env["NODE_ENV"] === "development") {
        errorDetails["stack"] = error.stack;
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
