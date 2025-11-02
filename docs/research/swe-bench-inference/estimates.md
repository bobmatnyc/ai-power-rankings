# SWE-bench Score Estimates

Generated: 2025-11-01T15:58:36.851Z

| Rank | Tool | Est. Score | Range | Confidence | Base Model |
|------|------|-----------|-------|------------|------------|
| 1 | Windsurf | 51.3% | 41-61.6% | very_low | swe-1.5 |
| 2 | Aider | 51% | 45.9-56.1% | medium | gpt-4.1 |
| 3 | Cursor | 46.6% | 39.6-53.5% | low | claude-3.5-sonnet-20241022 |
| 4 | GitHub Copilot | 31.1% | 26.4-35.7% | low | gpt-4.1 |


## Detailed Reasoning

### Windsurf (51.3%)

**Confidence:** very_low (±20%)

**Calculation:**
- Base Model: swe-1.5 (60%)
- Architecture: ide_agentic (0.8x)
- Feature Bonus: +35%
  - Execution: +10%
  - Codebase: +20%
  - Planning: +10%
  - Workflow: +15%
  - (Capped from 55% to 35%)
- Formula: 60.0 × 0.8 × 1.35 = 64.8 → 51.3

**Calibrations:**
- IDE ceiling: capped at 95% of base (57.0%)
- Marketing claims discount: -10%

---

### Aider (51%)

**Confidence:** medium (±10%)

**Calculation:**
- Base Model: gpt-4.1 (54%)
- Architecture: cli_tool (0.7x)
- Feature Bonus: +35%
  - Execution: +10%
  - Codebase: +8%
  - Planning: +10%
  - Workflow: +15%
  - (Capped from 43% to 35%)
- Formula: 54.0 × 0.7 × 1.35 = 51.0

**Validation:**
- Known Score: 26.3%
- Error: 24.7% (93.9%)

---

### Cursor (46.6%)

**Confidence:** low (±15%)

**Calculation:**
- Base Model: claude-3.5-sonnet-20241022 (49%)
- Architecture: ide_agentic (0.8x)
- Feature Bonus: +35%
  - Execution: +10%
  - Codebase: +20%
  - Planning: +10%
  - Workflow: +13%
  - (Capped from 53% to 35%)
- Formula: 49.0 × 0.8 × 1.35 = 52.9 → 46.5

**Calibrations:**
- IDE ceiling: capped at 95% of base (46.5%)

---

### GitHub Copilot (31.1%)

**Confidence:** low (±15%)

**Calculation:**
- Base Model: gpt-4.1 (54%)
- Architecture: ide_completion (0.5x)
- Feature Bonus: +15%
  - Codebase: +20%
  - Quality: +5%
  - (Capped from 25% to 15%)
- Formula: 54.0 × 0.5 × 1.15 = 31.0

---

