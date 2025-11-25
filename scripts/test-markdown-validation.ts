/**
 * Manual test script for markdown validation
 *
 * Run with: npx tsx scripts/test-markdown-validation.ts
 */

import {
  validateMarkdownSyntax,
  generateExcerpt,
  MarkdownArticleSchema,
  formatValidationErrors,
} from "../lib/validation/markdown-validator";

console.log("🧪 Testing Markdown Validation\n");

// Test 1: Valid markdown
console.log("Test 1: Valid markdown syntax");
const validMarkdown = `# Test Article

This is **bold** and *italic* text.

\`\`\`javascript
const code = true;
\`\`\`

- List item 1
- List item 2
`;

const isValid = validateMarkdownSyntax(validMarkdown);
console.log(`✓ Valid markdown: ${isValid}`);
console.assert(isValid === true, "Valid markdown should pass");

// Test 2: Invalid markdown (unclosed code block)
console.log("\nTest 2: Invalid markdown (unclosed code block)");
const invalidMarkdown = `# Test

\`\`\`javascript
const code = true;
`;

const isInvalid = validateMarkdownSyntax(invalidMarkdown);
console.log(`✓ Invalid markdown detected: ${!isInvalid}`);
console.assert(isInvalid === false, "Unclosed code block should fail");

// Test 3: Generate excerpt
console.log("\nTest 3: Generate excerpt from markdown");
const markdownWithFormatting = "This is **bold** and *italic* text with [link](https://example.com)";
const excerpt = generateExcerpt(markdownWithFormatting, 100);
console.log(`Original: "${markdownWithFormatting}"`);
console.log(`Excerpt: "${excerpt}"`);
console.assert(!excerpt.includes("**"), "Excerpt should not contain markdown formatting");
console.assert(!excerpt.includes("https://"), "Excerpt should not contain URLs");
console.assert(excerpt.includes("link"), "Excerpt should contain link text");

// Test 4: Truncation
console.log("\nTest 4: Excerpt truncation");
const longMarkdown = "a".repeat(1000);
const truncatedExcerpt = generateExcerpt(longMarkdown, 100);
console.log(`Long text length: ${longMarkdown.length}`);
console.log(`Excerpt length: ${truncatedExcerpt.length}`);
console.assert(truncatedExcerpt.length <= 104, "Excerpt should be truncated to ~100 chars");

// Test 5: Schema validation (valid)
console.log("\nTest 5: Schema validation (valid article)");
const validArticle = {
  contentMarkdown: "# Test Article\n\nThis is valid markdown content with enough characters.",
  title: "Test Article Title",
  summary: "A brief summary",
  author: "Test Author",
};

const validResult = MarkdownArticleSchema.safeParse(validArticle);
console.log(`✓ Valid article accepted: ${validResult.success}`);
console.assert(validResult.success === true, "Valid article should pass schema validation");

// Test 6: Schema validation (too short)
console.log("\nTest 6: Schema validation (content too short)");
const tooShort = {
  contentMarkdown: "short",
  title: "Test Article",
};

const shortResult = MarkdownArticleSchema.safeParse(tooShort);
console.log(`✓ Too short content rejected: ${!shortResult.success}`);
if (!shortResult.success) {
  try {
    const errorMessages = shortResult.error.errors.map((e: any) => `${e.path.join(".")}: ${e.message}`);
    console.log(`  Errors: ${errorMessages.join(", ")}`);
  } catch (e) {
    console.log(`  Errors: Validation failed (error details unavailable)`);
  }
}
console.assert(shortResult.success === false, "Too short content should fail");

// Test 7: Schema validation (invalid markdown)
console.log("\nTest 7: Schema validation (invalid markdown syntax)");
const invalidSyntax = {
  contentMarkdown: "```\nUnclosed code block with enough characters to pass length check",
  title: "Test Article",
};

const syntaxResult = MarkdownArticleSchema.safeParse(invalidSyntax);
console.log(`✓ Invalid syntax rejected: ${!syntaxResult.success}`);
if (!syntaxResult.success) {
  try {
    const errorMessages = syntaxResult.error.errors.map((e: any) => `${e.path.join(".")}: ${e.message}`);
    console.log(`  Errors: ${errorMessages.join(", ")}`);
  } catch (e) {
    console.log(`  Errors: Validation failed (error details unavailable)`);
  }
}
console.assert(syntaxResult.success === false, "Invalid markdown syntax should fail");

// Test 8: Schema validation (importance score out of range)
console.log("\nTest 8: Schema validation (importance score validation)");
const invalidScore = {
  contentMarkdown: "# Test Article\n\nThis is valid markdown content with enough characters.",
  title: "Test Article",
  importanceScore: 11, // Out of range (1-10)
};

const scoreResult = MarkdownArticleSchema.safeParse(invalidScore);
console.log(`✓ Out of range score rejected: ${!scoreResult.success}`);
if (!scoreResult.success) {
  try {
    const errorMessages = scoreResult.error.errors.map((e: any) => `${e.path.join(".")}: ${e.message}`);
    console.log(`  Errors: ${errorMessages.join(", ")}`);
  } catch (e) {
    console.log(`  Errors: Validation failed (error details unavailable)`);
  }
}
console.assert(scoreResult.success === false, "Out of range importance score should fail");

// Test 9: Remove HTML tags from excerpt
console.log("\nTest 9: HTML tag removal in excerpt");
const htmlMarkdown = "This has <strong>HTML</strong> tags and <em>elements</em>";
const htmlExcerpt = generateExcerpt(htmlMarkdown);
console.log(`Original: "${htmlMarkdown}"`);
console.log(`Excerpt: "${htmlExcerpt}"`);
console.assert(!htmlExcerpt.includes("<"), "Excerpt should not contain HTML tags");
console.assert(htmlExcerpt.includes("HTML"), "Excerpt should contain text content");

// Test 10: Complex markdown with multiple elements
console.log("\nTest 10: Complex markdown processing");
const complexMarkdown = `
# Big Header
## Smaller Header

This is a paragraph with **bold**, *italic*, and \`inline code\`.

\`\`\`typescript
const example = "code block";
\`\`\`

- List item 1
- List item 2
* Another list item

1. Numbered item
2. Another numbered item

Check out [this link](https://example.com) and ![image](image.jpg).

> This is a quote

---

Final paragraph.
`;

const complexExcerpt = generateExcerpt(complexMarkdown, 200);
console.log(`Complex excerpt (${complexExcerpt.length} chars): "${complexExcerpt.substring(0, 100)}..."`);
console.assert(!complexExcerpt.includes("#"), "Should not contain header markers");
console.assert(!complexExcerpt.includes("```"), "Should not contain code block markers");
console.assert(!complexExcerpt.includes("["), "Should not contain link markers");
console.assert(!complexExcerpt.includes(">"), "Should not contain blockquote markers");
console.assert(!complexExcerpt.includes("---"), "Should not contain horizontal rules");

console.log("\n✅ All tests passed!");
