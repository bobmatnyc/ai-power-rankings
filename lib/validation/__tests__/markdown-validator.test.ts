/**
 * Tests for markdown validation and excerpt generation
 */

import { describe, it, expect } from "vitest";
import {
  validateMarkdownSyntax,
  generateExcerpt,
  MarkdownArticleSchema,
  MAX_MARKDOWN_SIZE,
  MIN_MARKDOWN_SIZE,
} from "../markdown-validator";

describe("validateMarkdownSyntax", () => {
  it("should accept valid markdown", () => {
    const validMarkdown = `
# Header

This is **bold** and this is *italic*.

\`\`\`javascript
const code = true;
\`\`\`

- List item 1
- List item 2
    `;

    expect(validateMarkdownSyntax(validMarkdown)).toBe(true);
  });

  it("should reject unclosed code blocks", () => {
    const invalidMarkdown = `
# Header

\`\`\`javascript
const code = true;
    `;

    expect(validateMarkdownSyntax(invalidMarkdown)).toBe(false);
  });

  it("should reject malformed headers", () => {
    const invalidMarkdown = `
#NoSpace
    `;

    expect(validateMarkdownSyntax(invalidMarkdown)).toBe(false);
  });

  it("should accept properly formatted headers", () => {
    const validMarkdown = `
# Header 1
## Header 2
### Header 3
    `;

    expect(validateMarkdownSyntax(validMarkdown)).toBe(true);
  });

  it("should reject unclosed inline code", () => {
    const invalidMarkdown = "This has `unclosed inline code";

    expect(validateMarkdownSyntax(invalidMarkdown)).toBe(false);
  });

  it("should accept closed inline code", () => {
    const validMarkdown = "This has `closed inline code` properly";

    expect(validateMarkdownSyntax(validMarkdown)).toBe(true);
  });
});

describe("generateExcerpt", () => {
  it("should remove markdown formatting", () => {
    const markdown = "This is **bold** and *italic* text";
    const excerpt = generateExcerpt(markdown);

    expect(excerpt).toBe("This is bold and italic text");
  });

  it("should remove code blocks", () => {
    const markdown = `
Some text before

\`\`\`javascript
const code = true;
\`\`\`

Some text after
    `;

    const excerpt = generateExcerpt(markdown);
    expect(excerpt).not.toContain("const code");
    expect(excerpt).toContain("Some text before");
    expect(excerpt).toContain("Some text after");
  });

  it("should remove HTML tags", () => {
    const markdown = "This has <strong>HTML</strong> tags";
    const excerpt = generateExcerpt(markdown);

    expect(excerpt).toBe("This has HTML tags");
  });

  it("should keep link text but remove URLs", () => {
    const markdown = "Check out [this link](https://example.com)";
    const excerpt = generateExcerpt(markdown);

    expect(excerpt).toBe("Check out this link");
    expect(excerpt).not.toContain("https://");
  });

  it("should remove images completely", () => {
    const markdown = "Text before ![alt text](image.jpg) text after";
    const excerpt = generateExcerpt(markdown);

    expect(excerpt).toBe("Text before text after");
  });

  it("should truncate to specified length", () => {
    const longText = "a".repeat(1000);
    const excerpt = generateExcerpt(longText, 100);

    expect(excerpt.length).toBeLessThanOrEqual(104); // 100 + "..." = 103, rounded up
  });

  it("should normalize whitespace", () => {
    const markdown = "Too    much    space";
    const excerpt = generateExcerpt(markdown);

    expect(excerpt).toBe("Too much space");
  });

  it("should remove headers", () => {
    const markdown = `
# Big Header
## Smaller Header

Regular text
    `;

    const excerpt = generateExcerpt(markdown);
    expect(excerpt).not.toContain("#");
    expect(excerpt).toContain("Big Header");
    expect(excerpt).toContain("Regular text");
  });

  it("should remove list markers", () => {
    const markdown = `
- Item 1
- Item 2
* Item 3
1. Numbered item
    `;

    const excerpt = generateExcerpt(markdown);
    expect(excerpt).toContain("Item 1");
    expect(excerpt).not.toContain("-");
    expect(excerpt).not.toContain("*");
    expect(excerpt).not.toContain("1.");
  });
});

describe("MarkdownArticleSchema", () => {
  it("should accept valid article data", () => {
    const validArticle = {
      contentMarkdown: "# Test Article\n\nThis is valid markdown content.",
      title: "Test Article",
      summary: "A test article",
      author: "Test Author",
    };

    const result = MarkdownArticleSchema.safeParse(validArticle);
    expect(result.success).toBe(true);
  });

  it("should reject article with too short content", () => {
    const invalidArticle = {
      contentMarkdown: "short", // Less than MIN_MARKDOWN_SIZE
      title: "Test Article",
    };

    const result = MarkdownArticleSchema.safeParse(invalidArticle);
    expect(result.success).toBe(false);
  });

  it("should reject article with too long content", () => {
    const invalidArticle = {
      contentMarkdown: "a".repeat(MAX_MARKDOWN_SIZE + 1),
      title: "Test Article",
    };

    const result = MarkdownArticleSchema.safeParse(invalidArticle);
    expect(result.success).toBe(false);
  });

  it("should reject article with invalid markdown syntax", () => {
    const invalidArticle = {
      contentMarkdown: "```\nUnclosed code block",
      title: "Test Article",
    };

    const result = MarkdownArticleSchema.safeParse(invalidArticle);
    expect(result.success).toBe(false);
  });

  it("should reject article with too short title", () => {
    const invalidArticle = {
      contentMarkdown: "# Valid Content\n\nThis is valid markdown.",
      title: "AB", // Less than 3 characters
    };

    const result = MarkdownArticleSchema.safeParse(invalidArticle);
    expect(result.success).toBe(false);
  });

  it("should reject article with too long title", () => {
    const invalidArticle = {
      contentMarkdown: "# Valid Content\n\nThis is valid markdown.",
      title: "a".repeat(201), // More than 200 characters
    };

    const result = MarkdownArticleSchema.safeParse(invalidArticle);
    expect(result.success).toBe(false);
  });

  it("should accept optional fields", () => {
    const validArticle = {
      contentMarkdown: "# Test Article\n\nThis is valid markdown content.",
      title: "Test Article",
      // summary, author, etc. are optional
    };

    const result = MarkdownArticleSchema.safeParse(validArticle);
    expect(result.success).toBe(true);
  });

  it("should validate importance score range", () => {
    const invalidArticle = {
      contentMarkdown: "# Test Article\n\nThis is valid markdown content.",
      title: "Test Article",
      importanceScore: 11, // Out of range (1-10)
    };

    const result = MarkdownArticleSchema.safeParse(invalidArticle);
    expect(result.success).toBe(false);
  });

  it("should validate URL format", () => {
    const invalidArticle = {
      contentMarkdown: "# Test Article\n\nThis is valid markdown content.",
      title: "Test Article",
      sourceUrl: "not-a-url", // Invalid URL
    };

    const result = MarkdownArticleSchema.safeParse(invalidArticle);
    expect(result.success).toBe(false);
  });

  it("should accept valid tags array", () => {
    const validArticle = {
      contentMarkdown: "# Test Article\n\nThis is valid markdown content.",
      title: "Test Article",
      tags: ["ai", "machine-learning", "gpt"],
    };

    const result = MarkdownArticleSchema.safeParse(validArticle);
    expect(result.success).toBe(true);
  });

  it("should reject too many tags", () => {
    const invalidArticle = {
      contentMarkdown: "# Test Article\n\nThis is valid markdown content.",
      title: "Test Article",
      tags: Array(21).fill("tag"), // More than 20 tags
    };

    const result = MarkdownArticleSchema.safeParse(invalidArticle);
    expect(result.success).toBe(false);
  });
});
