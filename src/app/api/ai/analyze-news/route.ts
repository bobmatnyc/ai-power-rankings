import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { loggers } from "@/lib/logger";

// Schema for qualitative metrics extraction
const QualitativeMetricsSchema = z.object({
  // Innovation signals
  productLaunches: z
    .array(
      z.object({
        feature: z.string().describe("Name of the feature or product launched"),
        significance: z
          .enum(["breakthrough", "major", "incremental"])
          .describe("How significant is this launch?"),
        impact: z
          .number()
          .min(0)
          .max(10)
          .describe("Expected impact on the tool's competitiveness (0-10)"),
        description: z.string().describe("Brief description of what was launched"),
      })
    )
    .default([]),

  // Business momentum
  partnerships: z
    .array(
      z.object({
        partner: z.string().describe("Name of the partner organization"),
        type: z
          .enum(["strategic", "integration", "distribution", "technology"])
          .describe("Type of partnership"),
        significance: z
          .number()
          .min(0)
          .max(10)
          .describe("Strategic value of the partnership (0-10)"),
        description: z.string().describe("What the partnership entails"),
      })
    )
    .default([]),

  // Technical achievements
  technicalMilestones: z
    .array(
      z.object({
        achievement: z.string().describe("What technical milestone was achieved"),
        category: z
          .enum(["performance", "capability", "scale", "reliability"])
          .describe("Type of achievement"),
        improvement: z
          .number()
          .nullable()
          .describe("Percentage improvement if quantifiable, null if not applicable"),
        impact: z.number().min(0).max(10).describe("Impact on technical capability (0-10)"),
      })
    )
    .default([]),

  // Market sentiment analysis
  sentiment: z.object({
    overall: z.number().min(-1).max(1).describe("Overall sentiment (-1 to 1)"),
    confidence: z.number().min(0).max(1).describe("Confidence in sentiment analysis (0-1)"),
    aspects: z.object({
      product: z.number().min(-1).max(1).describe("Product-related sentiment"),
      leadership: z.number().min(-1).max(1).describe("Leadership/company sentiment"),
      competition: z.number().min(-1).max(1).describe("Competitive position sentiment"),
      future: z.number().min(-1).max(1).describe("Future outlook sentiment"),
    }),
  }),

  // Development signals
  developmentActivity: z.object({
    releaseCadence: z
      .enum(["accelerating", "steady", "slowing", "unknown"])
      .describe("Release frequency trend"),
    featureVelocity: z.number().min(0).max(10).describe("Speed of feature development (0-10)"),
    communityEngagement: z
      .enum(["increasing", "high", "medium", "low", "declining", "unknown"])
      .describe("Community activity level"),
    openSourceActivity: z.boolean().optional().describe("Is there open source activity mentioned?"),
  }),

  // Competitive positioning
  competitivePosition: z.object({
    mentioned_competitors: z
      .array(z.string())
      .default([])
      .describe("Competitors mentioned in the article"),
    positioning: z
      .enum(["leader", "challenger", "follower", "niche", "unclear"])
      .describe("Market position"),
    differentiators: z.array(z.string()).default([]).describe("Key differentiators mentioned"),
    threats: z.array(z.string()).default([]).describe("Competitive threats identified"),
  }),

  // Key events
  keyEvents: z
    .array(
      z.object({
        event: z.string().describe("Description of the key event"),
        type: z.enum(["funding", "acquisition", "leadership", "crisis", "expansion", "other"]),
        impact: z.enum(["positive", "negative", "neutral", "mixed"]),
        significance: z.number().min(0).max(10).describe("Significance of the event (0-10)"),
      })
    )
    .default([]),
});

export type QualitativeMetrics = z.infer<typeof QualitativeMetricsSchema>;

// Route handler for AI news analysis
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { article, toolName, toolContext, debug = false } = body;

    // Debug environment variables if requested
    if (debug) {
      console.log("ENV Check:", {
        openrouter: !!process.env["OPENROUTER_API_KEY"],
        openai: !!process.env["OPENAI_API_KEY"],
        analysis_enabled: process.env["ENABLE_AI_NEWS_ANALYSIS"],
      });
    }

    if (!article || !toolName) {
      return NextResponse.json({ error: "Article and toolName are required" }, { status: 400 });
    }

    // System prompt
    const systemPrompt = `You are an expert AI analyst specializing in developer tools and AI coding assistants. 
Your task is to extract qualitative metrics from news articles that traditional pattern matching cannot capture.
Focus on understanding the strategic implications, market dynamics, and technical progress.
Be objective and base your analysis only on what is explicitly stated or strongly implied in the article.

You must respond with valid JSON matching this schema:
{
  "productLaunches": [{"feature": "string", "significance": "breakthrough|major|incremental", "impact": 0-10, "description": "string"}],
  "partnerships": [{"partner": "string", "type": "strategic|integration|distribution|technology", "significance": 0-10, "description": "string"}],
  "technicalMilestones": [{"achievement": "string", "category": "performance|capability|scale|reliability", "improvement": number, "impact": 0-10}],
  "sentiment": {"overall": -1 to 1, "confidence": 0-1, "aspects": {"product": -1 to 1, "leadership": -1 to 1, "competition": -1 to 1, "future": -1 to 1}},
  "developmentActivity": {"releaseCadence": "accelerating|steady|slowing|unknown", "featureVelocity": 0-10, "communityEngagement": "increasing|high|medium|low|declining|unknown", "openSourceActivity": boolean},
  "competitivePosition": {"mentioned_competitors": ["string"], "positioning": "leader|challenger|follower|niche|unclear", "differentiators": ["string"], "threats": ["string"]},
  "keyEvents": [{"event": "string", "type": "funding|acquisition|leadership|crisis|expansion|other", "impact": "positive|negative|neutral|mixed", "significance": 0-10}]
}`;

    // User prompt
    const userPrompt = `Analyze this news article about ${toolName} and extract qualitative metrics.

Context about ${toolName}: ${toolContext || "An AI-powered developer tool"}

Article Title: ${article.title}
Published: ${article.published_date}
Source: ${article.source || "Unknown"}

Content:
${article.content}

Extract all relevant qualitative information according to the schema. Be specific and include quotes where relevant.
For numerical scores (0-10), use this scale:
- 0-2: Minimal/Poor
- 3-4: Below Average
- 5-6: Average
- 7-8: Good/Strong
- 9-10: Excellent/Exceptional

For sentiment (-1 to 1):
- -1.0 to -0.6: Very Negative
- -0.6 to -0.2: Negative
- -0.2 to 0.2: Neutral
- 0.2 to 0.6: Positive
- 0.6 to 1.0: Very Positive`;

    // Use OpenAI directly via fetch
    if (!process.env["OPENAI_API_KEY"]) {
      throw new Error("OPENAI_API_KEY not configured");
    }

    const modelName = "gpt-4o-mini";

    if (debug) {
      console.log("Using OpenAI directly:", { modelName, provider: "openai" });
    }

    try {
      // Call OpenAI API directly
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env["OPENAI_API_KEY"]}`,
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.3,
          response_format: { type: "json_object" },
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;

      if (!content) {
        throw new Error("No content in OpenAI response");
      }

      // Parse the JSON response
      const parsedResult = JSON.parse(content);

      // Validate against our schema
      const result = QualitativeMetricsSchema.parse(parsedResult);

      loggers.api.info(`AI news analysis completed for ${toolName}`, {
        tool: toolName,
        article_id: article.id,
        provider: "openai",
        model: modelName,
        metrics_summary: {
          product_launches: result.productLaunches.length,
          partnerships: result.partnerships.length,
          technical_milestones: result.technicalMilestones.length,
          overall_sentiment: result.sentiment.overall,
        },
      });

      return NextResponse.json({
        metrics: result,
        provider: "openai",
        model: modelName,
      });
    } catch (error) {
      // Fallback to simpler analysis if gateway fails
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const errorStack = error instanceof Error ? error.stack : "";

      console.error("AI Error:", error);
      if (error instanceof Error) {
        console.error("Error details:", {
          name: error.name,
          message: error.message,
          cause: (error as any).cause,
          data: (error as any).data,
        });
      }

      loggers.api.warn(`AI failed, returning basic analysis for ${toolName}`, {
        error: errorMessage,
        stack: errorStack,
        model: modelName,
      });

      // Return a minimal metrics object based on simple keyword matching
      const content = (article.content || "").toLowerCase();
      const hasPositiveKeywords = /launch|release|improve|enhance|partner|funding|growth/.test(
        content
      );
      const hasNegativeKeywords = /issue|problem|delay|bug|concern|criticism/.test(content);

      const fallbackMetrics: QualitativeMetrics = {
        productLaunches: [],
        partnerships: [],
        technicalMilestones: [],
        sentiment: {
          overall: hasPositiveKeywords ? 0.3 : hasNegativeKeywords ? -0.3 : 0,
          confidence: 0.3,
          aspects: {
            product: 0,
            leadership: 0,
            competition: 0,
            future: 0,
          },
        },
        developmentActivity: {
          releaseCadence: "unknown" as const,
          featureVelocity: 5,
          communityEngagement: "medium" as const,
          openSourceActivity: false,
        },
        competitivePosition: {
          mentioned_competitors: [],
          positioning: "unclear" as const,
          differentiators: [],
          threats: [],
        },
        keyEvents: [],
      };

      return NextResponse.json({
        metrics: fallbackMetrics,
        provider: "fallback",
        model: "keyword-based",
      });
    }
  } catch (error) {
    loggers.api.error("AI news analysis failed", { error });

    return NextResponse.json(
      {
        error: "Failed to analyze news article",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
