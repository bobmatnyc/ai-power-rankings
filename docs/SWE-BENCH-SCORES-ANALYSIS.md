# SWE-bench Scores Analysis Report

## Executive Summary

After thorough investigation of the AI Power Rankings project, I've identified several critical issues with the SWE-bench scores in the current rankings data:

1. **Outdated Scores**: Many tools are showing outdated or incorrect SWE-bench scores
2. **Missing Scores**: 77.4% of tools (24 out of 31) have no SWE-bench scores despite some having published results
3. **Inconsistent Data**: Discrepancies between the incoming data file and what's reflected in the rankings
4. **Wrong Score Values**: Some tools have incorrect scores that don't match the latest benchmarks

## Current State of SWE-bench Scores

### Tools with Scores in Rankings (7 tools - 22.6%)
1. **Claude Code**: 70.3% (Outdated - should be 72.7% or 74.4% with Refact.ai implementation)
2. **Augment Code**: 65.4% (Correct as of March 2025)
3. **GitHub Copilot**: 56% (Correct as of April 2025)
4. **Amazon Q Developer**: 55% (Correct as of January 2025)
5. **Google Jules**: 52.2% (Correct but from December 2024)
6. **Aider**: 26.3% (Outdated - should be 33.83% on Full benchmark with Claude 3.7)
7. **Devin**: 13.86% (Correct but very old - from March 2024)

### Missing Scores That Should Be Added (Based on incoming data)

1. **Warp**: Should have 71% (June 2025)
2. **EPAM AI/Run**: Should have 62.8% (February 2025)
3. **SWE-agent** (if included): Should have 65.4% Verified or 33.83% Full
4. **Refact.ai Agent** (if included): Should have 74.4% - Current leader

### Tools Without Published Scores (24 tools - 77.4%)
- Cursor, Kiro, Windsurf, Lovable, Tabnine, Bolt.new, Google Gemini Code Assist, Replit Agent, Zed, OpenAI Codex CLI, ChatGPT Canvas, v0, Claude Artifacts, Sourcegraph Cody, Cline, OpenHands, JetBrains AI Assistant, Qodo Gen, Continue, CodeRabbit, Snyk Code, Microsoft IntelliCode, Sourcery, Diffblue Cover

## Specific Issues Identified

### 1. Score Accuracy Issues

**Claude Code**
- Current: 70.3%
- Should be: 72.7% (standard) or 79.4% (with parallel compute)
- Source: Claude 4 announcement (May 22, 2025)

**Aider**
- Current: 26.3% (appears to be old SWE-bench Lite score)
- Should be: 33.83% on Full benchmark (February 2025 with Claude 3.7)
- Note: Different benchmark versions cause confusion

### 2. Missing Important Scores

Several tools with significant SWE-bench achievements are missing scores entirely:
- **Warp**: 71% - Top 5 performer
- **EPAM AI/Run**: 62.8% - Enterprise solution

### 3. Data Source Discrepancies

The `/data/incoming/swe-bench-scores-history.md` file contains comprehensive, up-to-date scores that aren't reflected in the rankings. This includes:
- Monthly progression showing improvements from ~55% to 74.4%
- Detailed methodology notes
- Multiple score variants (standard vs. high-compute)

### 4. Benchmark Version Confusion

The project doesn't clearly distinguish between:
- **SWE-bench Full** (2,294 problems)
- **SWE-bench Verified** (500 problems) - Most commonly reported
- **SWE-bench Lite** (300 problems)

This leads to comparing incomparable scores (e.g., Aider's 26.3% on Lite vs. 33.83% on Full).

## Recommendations

### 1. Immediate Updates Needed

Update the following scores in the rankings:
```json
{
  "claude-code": {
    "swe_bench_score": 72.7,
    "swe_bench_variant": "verified",
    "swe_bench_date": "2025-05-22"
  },
  "aider": {
    "swe_bench_score": 33.83,
    "swe_bench_variant": "full",
    "swe_bench_date": "2025-02-01"
  }
}
```

### 2. Add Missing Scores

For tools with published SWE-bench results:
- Add Warp (71% Verified)
- Consider adding benchmark results for tools not in current rankings but with scores (e.g., EPAM AI/Run, Refact.ai)

### 3. Implement Score Metadata

Add fields to track:
- `swe_bench_variant`: "full" | "verified" | "lite"
- `swe_bench_date`: Date of the benchmark
- `swe_bench_model`: Model used (e.g., "Claude 3.7 Sonnet")

### 4. Create Update Process

1. Use `/data/incoming/swe-bench-scores-history.md` as the source of truth
2. Implement a script to sync scores from this file to rankings
3. Add validation to ensure scores are current (flag if >3 months old)

### 5. Handle Missing Scores Better

For tools without SWE-bench scores:
- Consider alternative benchmarks (HumanEval, MBPP, etc.)
- Add a note explaining why the score is missing
- Don't penalize tools that haven't published benchmarks

### 6. Data Structure Improvements

Consider updating the metrics structure:
```json
"metrics": {
  "benchmarks": {
    "swe_bench": {
      "score": 72.7,
      "variant": "verified",
      "date": "2025-05-22",
      "model": "Claude 4 Sonnet",
      "source_url": "https://www.anthropic.com/news/claude-4"
    },
    "humaneval": {
      "score": 84.9,
      "date": "2025-05-22"
    }
  }
}
```

## Conclusion

The SWE-bench scores in the AI Power Rankings are significantly outdated and incomplete. The project has excellent source data in the incoming files but this isn't being properly utilized in the rankings. Implementing the recommended updates would provide users with accurate, current benchmark data that better reflects the rapidly evolving state of AI coding tools.