/**
 * Tests for LLM response validation
 */

import { describe, it, expect } from 'vitest';
import {
  validateLLMResponse,
  validateOpenRouterResponse,
  extractOpenRouterContent,
  parseLLMJsonContent,
  validateLLMAnalysis,
  formatValidationErrors,
  LLMAnalysisSchema,
  OpenRouterResponseSchema,
} from '../llm-response-validator';

describe('validateLLMResponse', () => {
  it('should validate valid LLM analysis response', () => {
    const validAnalysis = {
      content: 'A'.repeat(100), // Minimum 100 characters
      title: 'Test Article Title',
      summary: 'This is a test summary',
      confidence: 0.85,
    };

    const result = validateLLMResponse(LLMAnalysisSchema, validAnalysis);

    expect(result.valid).toBe(true);
    expect(result.data).toEqual(validAnalysis);
    expect(result.errors).toBeUndefined();
  });

  it('should reject content that is too short', () => {
    const invalidAnalysis = {
      content: 'Too short', // Less than 100 characters
    };

    const result = validateLLMResponse(LLMAnalysisSchema, invalidAnalysis);

    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject content that is too long', () => {
    const invalidAnalysis = {
      content: 'A'.repeat(60000), // More than 50000 characters
    };

    const result = validateLLMResponse(LLMAnalysisSchema, invalidAnalysis);

    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should validate optional fields', () => {
    const analysisWithOptional = {
      content: 'A'.repeat(100),
      title: 'Test Title',
      summary: 'Summary text',
      tool_mentions: [
        {
          tool: 'Claude Code',
          context: 'Used for code generation',
          sentiment: 0.8,
          relevance: 0.9,
        },
      ],
    };

    const result = validateLLMResponse(LLMAnalysisSchema, analysisWithOptional);

    expect(result.valid).toBe(true);
    expect(result.data?.tool_mentions).toHaveLength(1);
  });

  it('should validate sentiment and relevance ranges', () => {
    const invalidSentiment = {
      content: 'A'.repeat(100),
      overall_sentiment: 1.5, // Out of range (-1 to 1)
    };

    const result = validateLLMResponse(LLMAnalysisSchema, invalidSentiment);

    expect(result.valid).toBe(false);
  });
});

describe('validateOpenRouterResponse', () => {
  it('should validate valid OpenRouter response', () => {
    const validResponse = {
      id: 'chatcmpl-123',
      object: 'chat.completion',
      created: 1677652288,
      model: 'anthropic/claude-sonnet-4',
      choices: [
        {
          message: {
            content: 'This is the AI response',
            role: 'assistant',
          },
          index: 0,
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150,
      },
    };

    const result = validateOpenRouterResponse(validResponse);

    expect(result.valid).toBe(true);
    expect(result.data).toEqual(validResponse);
  });

  it('should handle response without usage field', () => {
    const responseWithoutUsage = {
      id: 'chatcmpl-123',
      object: 'chat.completion',
      created: 1677652288,
      model: 'anthropic/claude-sonnet-4',
      choices: [
        {
          message: {
            content: 'Response content',
            role: 'assistant',
          },
          index: 0,
          finish_reason: 'stop',
        },
      ],
    };

    const result = validateOpenRouterResponse(responseWithoutUsage);

    expect(result.valid).toBe(true);
    expect(result.data?.usage).toBeUndefined();
  });

  it('should reject response with missing required fields', () => {
    const invalidResponse = {
      id: 'chatcmpl-123',
      // Missing 'object', 'created', 'model', 'choices'
    };

    const result = validateOpenRouterResponse(invalidResponse);

    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should reject response with invalid choice structure', () => {
    const invalidResponse = {
      id: 'chatcmpl-123',
      object: 'chat.completion',
      created: 1677652288,
      model: 'anthropic/claude-sonnet-4',
      choices: [
        {
          // Missing message field
          index: 0,
          finish_reason: 'stop',
        },
      ],
    };

    const result = validateOpenRouterResponse(invalidResponse);

    expect(result.valid).toBe(false);
  });
});

describe('extractOpenRouterContent', () => {
  it('should extract content from valid response', () => {
    const response = {
      id: 'chatcmpl-123',
      object: 'chat.completion',
      created: 1677652288,
      model: 'anthropic/claude-sonnet-4',
      choices: [
        {
          message: {
            content: 'Extracted content',
            role: 'assistant',
          },
          index: 0,
          finish_reason: 'stop',
        },
      ],
    };

    const content = extractOpenRouterContent(response);

    expect(content).toBe('Extracted content');
  });

  it('should return null for invalid response', () => {
    const invalidResponse = {
      id: 'chatcmpl-123',
      // Missing required fields
    };

    const content = extractOpenRouterContent(invalidResponse);

    expect(content).toBeNull();
  });

  it('should return null for response without content', () => {
    const responseWithoutContent = {
      id: 'chatcmpl-123',
      object: 'chat.completion',
      created: 1677652288,
      model: 'anthropic/claude-sonnet-4',
      choices: [],
    };

    const content = extractOpenRouterContent(responseWithoutContent);

    expect(content).toBeNull();
  });
});

describe('parseLLMJsonContent', () => {
  it('should parse plain JSON string', () => {
    const jsonString = '{"key": "value", "number": 42}';

    const parsed = parseLLMJsonContent(jsonString);

    expect(parsed).toEqual({ key: 'value', number: 42 });
  });

  it('should parse JSON with markdown code blocks', () => {
    const jsonWithMarkdown = '```json\n{"key": "value"}\n```';

    const parsed = parseLLMJsonContent(jsonWithMarkdown);

    expect(parsed).toEqual({ key: 'value' });
  });

  it('should handle JSON with extra whitespace', () => {
    const jsonWithWhitespace = '  \n  {"key": "value"}  \n  ';

    const parsed = parseLLMJsonContent(jsonWithWhitespace);

    expect(parsed).toEqual({ key: 'value' });
  });

  it('should throw error for invalid JSON', () => {
    const invalidJson = 'not valid json';

    expect(() => parseLLMJsonContent(invalidJson)).toThrow('Failed to parse LLM JSON content');
  });
});

describe('validateLLMAnalysis', () => {
  it('should validate and parse valid analysis JSON', () => {
    const validAnalysisJson = JSON.stringify({
      content: 'A'.repeat(100),
      title: 'Analysis Title',
      summary: 'Analysis summary',
    });

    const analysis = validateLLMAnalysis(validAnalysisJson);

    expect(analysis.content).toBe('A'.repeat(100));
    expect(analysis.title).toBe('Analysis Title');
  });

  it('should handle markdown code blocks', () => {
    const jsonWithMarkdown = '```json\n' + JSON.stringify({
      content: 'A'.repeat(100),
      title: 'Test Title Valid',
    }) + '\n```';

    const analysis = validateLLMAnalysis(jsonWithMarkdown);

    expect(analysis.content).toBe('A'.repeat(100));
    expect(analysis.title).toBe('Test Title Valid');
  });

  it('should throw error for invalid analysis structure', () => {
    const invalidAnalysisJson = JSON.stringify({
      content: 'Too short', // Less than 100 characters
    });

    expect(() => validateLLMAnalysis(invalidAnalysisJson)).toThrow();
  });
});

describe('formatValidationErrors', () => {
  it('should format validation errors into readable string', () => {
    const invalidData = {
      content: 'Short', // Too short
      overall_sentiment: 2.0, // Out of range
    };

    const result = validateLLMResponse(LLMAnalysisSchema, invalidData);

    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();

    if (result.errors) {
      const formatted = formatValidationErrors(result.errors);
      expect(formatted).toContain('content');
      expect(formatted).toBeTruthy();
    }
  });

  it('should handle nested field errors', () => {
    const invalidData = {
      content: 'A'.repeat(100),
      tool_mentions: [
        {
          // Missing 'tool' or 'name'
          context: 'Some context',
          sentiment: 0.5,
        },
      ],
    };

    const result = validateLLMResponse(LLMAnalysisSchema, invalidData);

    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();

    if (result.errors) {
      const formatted = formatValidationErrors(result.errors);
      expect(formatted).toBeTruthy();
    }
  });
});
