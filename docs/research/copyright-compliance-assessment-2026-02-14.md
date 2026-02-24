# Article Summarization Copyright Compliance Assessment

**Date:** 2026-02-14
**Investigator:** Claude Code
**Status:** Completed

## Executive Summary

The article summarization system has **significant gaps** in copyright compliance that require attention. While the current implementation includes some positive elements (source attribution, link to original), the LLM prompts do not explicitly instruct the model to avoid verbatim copying or to focus specifically on facts rather than creative expression.

**Overall Assessment: NEEDS IMPROVEMENT**

### Key Findings

| Requirement | Status | Priority |
|-------------|--------|----------|
| Transformative (adds analysis/value) | PARTIAL | Medium |
| Original language (no verbatim copying) | MISSING | **HIGH** |
| Focus on facts (not expression) | MISSING | **HIGH** |
| Proportional length | GOOD | Low |
| Source attribution | GOOD | Low |

---

## Detailed Analysis

### 1. Main Summarization Code Location

**Primary File:** `/Users/masa/Projects/aipowerranking/lib/services/article-ingestion.service.ts`

**Classes Involved:**
- `AIAnalyzer` (lines 515-750) - Main article analysis and summarization
- `ContentExtractor` (lines 291-510) - Content extraction from URLs/files

**Key Prompt Location:** Lines 536-627 (systemPrompt and userPrompt)

### 2. Current Summarization Prompts Analysis

#### System Prompt (Lines 536-562)

```typescript
const systemPrompt = `You are an expert AI industry analyst specializing in AI tools, technologies, and market trends.
Your task is to analyze articles and extract structured information about AI tools, companies, and their potential impact on rankings.

Focus on:
1. Identifying ALL AI tools, models, and services mentioned...
2. Understanding the context and sentiment around each tool
3. Identifying companies behind the tools
4. Predicting potential ranking impacts based on the news
5. Extracting key insights and trends
6. Creating CONCISE content:
   - Summary: **400-500 words** - This is the MAIN content readers will see...
   - Rewritten content: Approximately 800-1000 words...
   - Include key analysis and context (be concise, not verbose)
   - Preserve ALL important links from the source article at the end
   - Be focused and informative - provide value without padding
   - CRITICAL: Never truncate mid-sentence...

Be thorough and precise. Extract the exact tool names as mentioned, we'll handle normalization.

IMPORTANT: You MUST return ONLY a valid JSON object...`;
```

#### User Prompt (Lines 573-627)

The prompt asks for:
- `"summary": "A concise 400-500 word summary that serves as the main article content..."`
- `"rewritten_content": "Optional extended version..."`

### 3. Copyright Compliance Gap Analysis

#### POSITIVE Elements Already Present

1. **Source Attribution:**
   - Source URL is preserved (`source_url` field)
   - Source name is extracted (`source` field)
   - Links to original are preserved in content

2. **Transformative Elements:**
   - Adds sentiment analysis
   - Adds tool/company extraction
   - Adds ranking impact predictions
   - Adds key insights extraction

3. **Proportional Length:**
   - Summary is 400-500 words (reasonable ratio)
   - Content is limited to ~15,000 characters for processing

4. **Display Attribution:**
   - `news-detail-content.tsx` (lines 499-504): Shows source name
   - `news-detail-content.tsx` (lines 680-686): "View Source" button linking to original
   - `news-card.tsx` (lines 173-181): "View Source" button
   - Article note (lines 699-707): Disclaimer about AI compilation

#### CRITICAL GAPS Requiring Attention

1. **No Explicit Instruction Against Verbatim Copying:**
   - The prompt does NOT instruct the LLM to use original language
   - The prompt does NOT tell the LLM to avoid copying phrases verbatim
   - Risk: LLM may directly copy striking phrases or sentences from source

2. **No Focus on Facts vs. Expression:**
   - The prompt does NOT distinguish between facts (not copyrightable) and creative expression (copyrightable)
   - The prompt asks for "rewritten content" but doesn't specify how to rewrite
   - Risk: LLM may reproduce the author's creative expression

3. **No Paraphrasing Instructions:**
   - The term "paraphrase" or "original language" is not mentioned
   - The term "in your own words" is not mentioned
   - Risk: Direct reproduction of copyrightable expression

### 4. Other Summary Services Analysis

#### WhatsNew Summary Service (`whats-new-summary.service.ts`)

**Prompt Location:** Lines 217-236

This service has BETTER copyright posture:
- Instructs to "synthesize" news articles into a "cohesive narrative"
- Asks for "analytical, not just descriptive" content
- Creates a derivative work (monthly summary) rather than per-article summaries

#### State of AI Summary Service (`state-of-ai-summary.service.ts`)

**Prompt Location:** Lines 193-261

This service also has BETTER copyright posture:
- Creates editorial content (monthly updates)
- Instructs to write in a specific editorial voice
- Has "Death List" of prohibited language to avoid generic copying

---

## Recommendations

### HIGH PRIORITY - Prompt Modifications Required

#### Recommendation 1: Add Explicit Anti-Copying Instructions

**File:** `/Users/masa/Projects/aipowerranking/lib/services/article-ingestion.service.ts`
**Location:** Lines 536-562 (systemPrompt)

**Add the following to the system prompt:**

```typescript
CRITICAL COPYRIGHT REQUIREMENTS:
- You MUST use your own original language in all summaries and rewritten content
- NEVER copy sentences, phrases, or unique expressions verbatim from the source
- Focus on extracting FACTS and NEWSWORTHY INFORMATION (facts are not copyrightable)
- Avoid reproducing the author's creative expression, metaphors, or unique phrasing
- Paraphrase all information in your own words while preserving accuracy
- The summary should be a transformative analysis, not a condensed version of the original
```

#### Recommendation 2: Update User Prompt Summary Instructions

**File:** `/Users/masa/Projects/aipowerranking/lib/services/article-ingestion.service.ts`
**Location:** Lines 581-588 (summary field description in userPrompt)

**Change from:**
```json
"summary": "A concise 400-500 word summary that serves as the main article content..."
```

**To:**
```json
"summary": "A 400-500 word original analysis IN YOUR OWN WORDS that:
- Synthesizes the key FACTS and newsworthy information (not the author's creative expression)
- Paraphrases all information - NEVER copy phrases verbatim from the source
- Adds your analytical perspective and industry context
- Focuses on what matters to developers evaluating AI tools
- Is a transformative work that provides new value beyond the original"
```

#### Recommendation 3: Update Rewritten Content Instructions

**File:** `/Users/masa/Projects/aipowerranking/lib/services/article-ingestion.service.ts`
**Location:** Lines 589-597 (rewritten_content field description)

**Change from:**
```json
"rewritten_content": "Optional extended version of approximately 800-1000 words with additional details..."
```

**To:**
```json
"rewritten_content": "Optional extended ORIGINAL analysis (800-1000 words) that:
- Is written entirely in your own words (never copy from source)
- Provides deeper context, analysis, and industry implications
- Extracts and paraphrases facts while avoiding the author's creative expression
- Includes proper attribution to sources with markdown links
- Adds transformative value through expert analysis"
```

### MEDIUM PRIORITY - Enhanced Attribution

#### Recommendation 4: Add Source Attribution to Summaries

Consider adding an automatic footer to displayed summaries:

**File:** `/Users/masa/Projects/aipowerranking/components/news/news-detail-content.tsx`

Add after article content (around line 605):
```tsx
{article.source && article.source_url && (
  <p className="text-sm text-muted-foreground mt-4 italic">
    Originally reported by {article.source}.
    <a href={article.source_url} target="_blank" rel="noopener noreferrer" className="underline">
      Read the original article
    </a>.
  </p>
)}
```

### LOW PRIORITY - Documentation

#### Recommendation 5: Add Copyright Policy Documentation

Create internal documentation explaining:
- The legal basis for fair use/paraphrasing
- Guidelines for content team reviewing AI-generated summaries
- Escalation process for potential copyright concerns

---

## Implementation Code Changes

### Primary Change: article-ingestion.service.ts

**Location:** Lines 536-562

**Current systemPrompt (partial):**
```typescript
const systemPrompt = `You are an expert AI industry analyst specializing in AI tools, technologies, and market trends.
Your task is to analyze articles and extract structured information about AI tools, companies, and their potential impact on rankings.

Focus on:
...
6. Creating CONCISE content:
   - Summary: **400-500 words** - This is the MAIN content readers will see. Must be concise with clear introduction, body, and conclusion
   - Rewritten content: Approximately 800-1000 words - Optional extended version for archival/reference
   ...
```

**Recommended systemPrompt (additions highlighted):**
```typescript
const systemPrompt = `You are an expert AI industry analyst specializing in AI tools, technologies, and market trends.
Your task is to analyze articles and extract structured information about AI tools, companies, and their potential impact on rankings.

Focus on:
1. Identifying ALL AI tools, models, and services mentioned...
2. Understanding the context and sentiment around each tool
3. Identifying companies behind the tools
4. Predicting potential ranking impacts based on the news
5. Extracting key insights and trends
6. Creating CONCISE content:
   - Summary: **400-500 words** - This is the MAIN content readers will see. Must be concise with clear introduction, body, and conclusion
   - Rewritten content: Approximately 800-1000 words - Optional extended version for archival/reference
   - Include key analysis and context (be concise, not verbose)
   - Preserve ALL important links from the source article at the end
   - Be focused and informative - provide value without padding
   - CRITICAL: Never truncate mid-sentence. Always complete your thoughts and end with proper conclusion

CRITICAL COPYRIGHT & PARAPHRASING REQUIREMENTS:
- You MUST write all summaries and content in your OWN ORIGINAL LANGUAGE
- NEVER copy sentences, phrases, or unique expressions verbatim from the source article
- Focus on extracting and reporting FACTS (factual information is not copyrightable)
- Avoid reproducing the author's creative expression, metaphors, unique phrasing, or editorial voice
- Paraphrase all information while maintaining accuracy - this is legal paraphrasing, not copying
- Add your own analytical perspective and industry context to make the content transformative
- The goal is to CREATE NEW VALUE through expert analysis, not to condense the original

Be thorough and precise. Extract the exact tool names as mentioned, we'll handle normalization.

IMPORTANT: You MUST return ONLY a valid JSON object. Do not include any explanatory text before or after the JSON.`;
```

---

## Legal Considerations

### Fair Use Doctrine (US)

Under 17 U.S.C. Section 107, fair use considers:

1. **Purpose and character of use** - TRANSFORMATIVE use favored
   - Current: Partially transformative (adds analysis)
   - After changes: More clearly transformative

2. **Nature of copyrighted work** - Factual works get less protection
   - News articles are factual, which favors fair use

3. **Amount and substantiality** - Using less is better
   - 400-500 word summaries from full articles is reasonable

4. **Effect on market** - Don't replace the original
   - "View Source" links encourage viewing original

### Paraphrasing vs. Copyright Infringement

Legal paraphrasing requires:
- Using different words and sentence structures
- Not copying striking phrases or creative expression
- Focusing on ideas/facts rather than expression
- Adding transformative value (analysis, new perspective)

The recommended prompt changes explicitly instruct the LLM to follow these principles.

---

## Testing Recommendations

After implementing changes, test with sample articles:

1. Run summarization on 3-5 diverse articles
2. Compare summaries against originals for:
   - Verbatim phrase copying (should find none)
   - Structural similarity (should be different)
   - Factual accuracy (should be preserved)
   - Transformative analysis (should be present)
3. Document results for compliance records

---

## Files Modified Summary

| File | Lines | Change Type |
|------|-------|-------------|
| `lib/services/article-ingestion.service.ts` | 536-562 | System prompt additions |
| `lib/services/article-ingestion.service.ts` | 581-597 | User prompt updates |
| `components/news/news-detail-content.tsx` | ~605 | Optional: Enhanced attribution |

---

## Conclusion

The current article summarization system has a foundation for copyright compliance through source attribution and some transformative elements, but lacks explicit instructions preventing verbatim copying. The recommended prompt changes will significantly strengthen copyright compliance by explicitly instructing the LLM to:

1. Use original language
2. Focus on facts rather than creative expression
3. Paraphrase rather than copy
4. Add transformative analysis

These changes align with fair use principles and legal paraphrasing standards while preserving the system's functionality.

**Action Required:** Implement HIGH PRIORITY recommendations before processing additional articles.
