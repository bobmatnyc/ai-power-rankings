import { NextRequest, NextResponse } from "next/server";
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { loggers } from "@/lib/logger";

// Schema for qualitative metrics extraction
const QualitativeMetricsSchema = z.object({
  // Innovation signals
  productLaunches: z.array(z.object({
    feature: z.string().describe('Name of the feature or product launched'),
    significance: z.enum(['breakthrough', 'major', 'incremental']).describe('How significant is this launch?'),
    impact: z.number().min(0).max(10).describe('Expected impact on the tool\'s competitiveness (0-10)'),
    description: z.string().describe('Brief description of what was launched')
  })).default([]),
  
  // Business momentum
  partnerships: z.array(z.object({
    partner: z.string().describe('Name of the partner organization'),
    type: z.enum(['strategic', 'integration', 'distribution', 'technology']).describe('Type of partnership'),
    significance: z.number().min(0).max(10).describe('Strategic value of the partnership (0-10)'),
    description: z.string().describe('What the partnership entails')
  })).default([]),
  
  // Technical achievements
  technicalMilestones: z.array(z.object({
    achievement: z.string().describe('What technical milestone was achieved'),
    category: z.enum(['performance', 'capability', 'scale', 'reliability']).describe('Type of achievement'),
    improvement: z.number().nullable().describe('Percentage improvement if quantifiable, null if not applicable'),
    impact: z.number().min(0).max(10).describe('Impact on technical capability (0-10)')
  })).default([]),
  
  // Market sentiment analysis
  sentiment: z.object({
    overall: z.number().min(-1).max(1).describe('Overall sentiment (-1 to 1)'),
    confidence: z.number().min(0).max(1).describe('Confidence in sentiment analysis (0-1)'),
    aspects: z.object({
      product: z.number().min(-1).max(1).describe('Product-related sentiment'),
      leadership: z.number().min(-1).max(1).describe('Leadership/company sentiment'),
      competition: z.number().min(-1).max(1).describe('Competitive position sentiment'),
      future: z.number().min(-1).max(1).describe('Future outlook sentiment')
    })
  }),
  
  // Development signals
  developmentActivity: z.object({
    releaseCadence: z.enum(['accelerating', 'steady', 'slowing', 'unknown']).describe('Release frequency trend'),
    featureVelocity: z.number().min(0).max(10).describe('Speed of feature development (0-10)'),
    communityEngagement: z.enum(['increasing', 'high', 'medium', 'low', 'declining']).describe('Community activity level'),
    openSourceActivity: z.boolean().describe('Is there open source activity mentioned?')
  }),
  
  // Competitive positioning
  competitivePosition: z.object({
    mentioned_competitors: z.array(z.string()).default([]).describe('Competitors mentioned in the article'),
    positioning: z.enum(['leader', 'challenger', 'follower', 'niche', 'unclear']).describe('Market position'),
    differentiators: z.array(z.string()).default([]).describe('Key differentiators mentioned'),
    threats: z.array(z.string()).default([]).describe('Competitive threats identified')
  }),
  
  // Key events
  keyEvents: z.array(z.object({
    event: z.string().describe('Description of the key event'),
    type: z.enum(['funding', 'acquisition', 'leadership', 'crisis', 'expansion', 'other']),
    impact: z.enum(['positive', 'negative', 'neutral', 'mixed']),
    significance: z.number().min(0).max(10).describe('Significance of the event (0-10)')
  })).default([])
});

export type QualitativeMetrics = z.infer<typeof QualitativeMetricsSchema>;

// Route handler for AI news analysis
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { article, toolName, toolContext, provider = 'openai' } = body;

    if (!article || !toolName) {
      return NextResponse.json(
        { error: "Article and toolName are required" },
        { status: 400 }
      );
    }

    // System prompt
    const systemPrompt = `You are an expert AI analyst specializing in developer tools and AI coding assistants. 
Your task is to extract qualitative metrics from news articles that traditional pattern matching cannot capture.
Focus on understanding the strategic implications, market dynamics, and technical progress.
Be objective and base your analysis only on what is explicitly stated or strongly implied in the article.`;

    // User prompt
    const userPrompt = `Analyze this news article about ${toolName} and extract qualitative metrics.

Context about ${toolName}: ${toolContext || 'An AI-powered developer tool'}

Article Title: ${article.title}
Published: ${article.published_date}
Source: ${article.source || 'Unknown'}

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

    // Select model based on provider preference
    const modelName = provider === 'anthropic' 
      ? 'claude-3-5-haiku-latest'
      : 'gpt-4-turbo';
    
    const model = provider === 'anthropic' 
      ? anthropic(modelName)
      : openai(modelName);

    try {
      // Generate analysis using AI SDK
      const result = await generateObject({
        model,
        schema: QualitativeMetricsSchema,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
      });

      loggers.api.info(`AI news analysis completed for ${toolName}`, {
        tool: toolName,
        article_id: article.id,
        provider,
        model: modelName,
        metrics_summary: {
          product_launches: result.object.productLaunches.length,
          partnerships: result.object.partnerships.length,
          technical_milestones: result.object.technicalMilestones.length,
          overall_sentiment: result.object.sentiment.overall,
        }
      });

      return NextResponse.json({
        metrics: result.object,
        provider: provider,
        model: modelName,
      });
    } catch (error) {
      // Fallback to simpler analysis if gateway fails
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : '';
      
      console.error('AI Error:', error);
      if (error instanceof Error) {
        console.error('Error details:', {
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
      const content = (article.content || '').toLowerCase();
      const hasPositiveKeywords = /launch|release|improve|enhance|partner|funding|growth/.test(content);
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
            future: 0
          }
        },
        developmentActivity: {
          releaseCadence: 'unknown' as const,
          featureVelocity: 5,
          communityEngagement: 'medium' as const,
          openSourceActivity: false
        },
        competitivePosition: {
          mentioned_competitors: [],
          positioning: 'unclear' as const,
          differentiators: [],
          threats: []
        },
        keyEvents: []
      };
      
      return NextResponse.json({
        metrics: fallbackMetrics,
        provider: 'fallback',
        model: 'keyword-based',
      });
    }
  } catch (error) {
    loggers.api.error("AI news analysis failed", { error });
    
    return NextResponse.json(
      { 
        error: "Failed to analyze news article",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}