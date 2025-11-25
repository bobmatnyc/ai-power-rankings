/**
 * Markdown Validation and Processing
 *
 * This module provides validation for markdown content and utilities
 * for generating plain text excerpts from markdown.
 *
 * Design Decision: Field Separation Strategy
 * - contentMarkdown: Stores full markdown source (user input)
 * - content: Auto-generated plain text excerpt (first 500 chars)
 *
 * This provides:
 * - Full markdown for rendering
 * - Plain text for search/preview
 * - No redundancy (different purposes)
 */

import { z } from "zod";

// Validation constants
export const MAX_MARKDOWN_SIZE = 50 * 1024; // 50KB - prevents DoS via large uploads
export const MAX_CONTENT_SIZE = 1000; // 1000 chars for excerpt
export const MIN_MARKDOWN_SIZE = 10; // Minimum 10 characters

/**
 * Validates markdown syntax for common issues
 *
 * Checks for:
 * - Unclosed code blocks (```)
 * - Unclosed inline code blocks (`)
 * - Malformed headers (multiple # without space)
 * - Unclosed HTML tags (basic check)
 *
 * Performance: O(n) where n is markdown length
 */
export function validateMarkdownSyntax(markdown: string): boolean {
  // Check for unclosed code blocks
  const codeBlockCount = (markdown.match(/```/g) || []).length;
  if (codeBlockCount % 2 !== 0) {
    return false; // Unclosed code block
  }

  // Check for unclosed inline code (basic check - counts backticks per line)
  const lines = markdown.split("\n");
  for (const line of lines) {
    // Skip code blocks
    if (line.trim().startsWith("```")) continue;

    const backtickCount = (line.match(/`/g) || []).length;
    if (backtickCount % 2 !== 0) {
      return false; // Unclosed inline code
    }
  }

  // Check for malformed headers (### without space after)
  const malformedHeaders = /#{1,6}[a-zA-Z]/g;
  if (malformedHeaders.test(markdown)) {
    return false; // Header should have space after #
  }

  // Basic HTML tag check (not comprehensive, just catches obvious issues)
  // Check for common unclosed tags
  const openTags = markdown.match(/<(div|span|p|a|strong|em|b|i|ul|ol|li|table|tr|td|th)>/gi) || [];
  const closeTags = markdown.match(/<\/(div|span|p|a|strong|em|b|i|ul|ol|li|table|tr|td|th)>/gi) || [];

  // Simple count check (not perfect but catches obvious issues)
  if (openTags.length !== closeTags.length) {
    // Allow self-closing tags and void elements
    const voidElements = /<(br|hr|img|input|meta|link)[\s/>]/gi;
    const voidCount = (markdown.match(voidElements) || []).length;

    if (openTags.length - closeTags.length !== voidCount) {
      return false; // Likely unclosed HTML tag
    }
  }

  return true;
}

/**
 * Generate plain text excerpt from markdown
 *
 * Removes markdown syntax and HTML, keeping only plain text.
 * Truncates to maxLength characters.
 *
 * Algorithm:
 * 1. Remove code blocks
 * 2. Remove HTML tags
 * 3. Remove markdown formatting (**, *, `, etc.)
 * 4. Remove links (keep link text only)
 * 5. Normalize whitespace
 * 6. Truncate to maxLength
 *
 * Performance: O(n) where n is markdown length
 *
 * @param markdown - Full markdown text
 * @param maxLength - Maximum excerpt length (default: 500)
 * @returns Plain text excerpt
 */
export function generateExcerpt(markdown: string, maxLength = 500): string {
  let text = markdown;

  // Remove code blocks (``` ... ```)
  text = text.replace(/```[\s\S]*?```/g, " ");

  // Remove inline code (` ... `)
  text = text.replace(/`[^`]+`/g, " ");

  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, " ");

  // Remove markdown links but keep text: [text](url) -> text
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  // Remove markdown images: ![alt](url)
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, "");

  // Remove markdown formatting
  text = text.replace(/(\*\*|__)(.*?)\1/g, "$2"); // Bold
  text = text.replace(/(\*|_)(.*?)\1/g, "$2"); // Italic
  text = text.replace(/~~(.*?)~~/g, "$1"); // Strikethrough

  // Remove headers (# Header)
  text = text.replace(/^#{1,6}\s+/gm, "");

  // Remove horizontal rules (---, ___, ***)
  text = text.replace(/^[-_*]{3,}$/gm, " ");

  // Remove blockquotes (> quote)
  text = text.replace(/^>\s+/gm, "");

  // Remove list markers (-, *, +, 1.)
  text = text.replace(/^[\s]*[-*+]\s+/gm, "");
  text = text.replace(/^[\s]*\d+\.\s+/gm, "");

  // Normalize whitespace
  text = text.replace(/\s+/g, " ").trim();

  // Truncate to maxLength
  if (text.length > maxLength) {
    // Try to break at word boundary
    const truncated = text.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(" ");

    if (lastSpace > maxLength * 0.8) {
      // If last space is close to end, use it
      text = truncated.substring(0, lastSpace) + "...";
    } else {
      // Otherwise just truncate hard
      text = truncated + "...";
    }
  }

  return text;
}

/**
 * Zod schema for markdown article validation
 *
 * Validates:
 * - contentMarkdown: Required, 10-50KB, valid markdown syntax
 * - title: Required, 3-200 characters
 * - summary: Optional, max 500 characters
 * - Other article fields
 *
 * Error Handling:
 * - Size limits enforced to prevent DoS
 * - Syntax validation catches malformed markdown
 * - Type validation ensures correct data types
 */
export const MarkdownArticleSchema = z.object({
  contentMarkdown: z
    .string()
    .min(MIN_MARKDOWN_SIZE, `Article must be at least ${MIN_MARKDOWN_SIZE} characters`)
    .max(MAX_MARKDOWN_SIZE, `Article too large (max ${MAX_MARKDOWN_SIZE / 1024}KB)`)
    .refine(validateMarkdownSyntax, {
      message: "Invalid markdown syntax - check for unclosed code blocks, malformed headers, or unclosed HTML tags",
    }),

  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(200, "Title must be less than 200 characters"),

  summary: z
    .string()
    .max(500, "Summary must be less than 500 characters")
    .optional(),

  author: z
    .string()
    .max(255, "Author name must be less than 255 characters")
    .optional(),

  sourceUrl: z
    .string()
    .url("Invalid URL format")
    .max(1000, "URL must be less than 1000 characters")
    .optional()
    .nullable(),

  sourceName: z
    .string()
    .max(255, "Source name must be less than 255 characters")
    .optional(),

  category: z
    .string()
    .max(100, "Category must be less than 100 characters")
    .optional(),

  tags: z
    .array(z.string().max(50, "Tag must be less than 50 characters"))
    .max(20, "Maximum 20 tags allowed")
    .optional(),

  toolMentions: z
    .array(z.string().max(100, "Tool mention must be less than 100 characters"))
    .max(50, "Maximum 50 tool mentions allowed")
    .optional(),

  importanceScore: z
    .number()
    .int("Importance score must be an integer")
    .min(1, "Importance score must be at least 1")
    .max(10, "Importance score must be at most 10")
    .optional(),

  publishedDate: z
    .date()
    .or(z.string().datetime())
    .optional(),

  ingestionType: z
    .enum(["url", "text", "file"])
    .optional(),

  status: z
    .enum(["draft", "active", "archived", "deleted"])
    .optional(),
});

/**
 * Partial schema for updates (all fields optional)
 */
export const PartialMarkdownArticleSchema = MarkdownArticleSchema.partial();

/**
 * Type exports for TypeScript
 */
export type ValidatedArticle = z.infer<typeof MarkdownArticleSchema>;
export type PartialValidatedArticle = z.infer<typeof PartialMarkdownArticleSchema>;

/**
 * Validation error formatter
 *
 * Converts Zod errors to user-friendly messages
 */
export function formatValidationErrors(error: z.ZodError): string[] {
  if (!error || !error.errors) {
    return ["Unknown validation error"];
  }
  return error.errors.map((err) => {
    const path = err.path.join(".");
    return path ? `${path}: ${err.message}` : err.message;
  });
}
