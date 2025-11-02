# SWE-bench Inference - Quick Start Guide

**Goal:** Generate SWE-bench score estimates for tools without published benchmarks

**Time Required:** 5 minutes to understand, 2-4 hours to implement for all tools

---

## TL;DR

```bash
# 1. Run the inference script
npx tsx scripts/infer-swebench-scores.ts

# 2. Check output
cat docs/research/swe-bench-inference/estimates.md
cat docs/research/swe-bench-inference/estimates.json

# 3. Review estimates
# Edit script to add your tools, then re-run
```

---

## How It Works

```
Estimated Score = LLM Base Score × Architecture Multiplier × (1 + Features)
```

**Example:**

```typescript
Cursor = 49% (Claude 3.5 Sonnet Oct 24)
       × 0.80 (IDE assistant)
       × 1.35 (+35% features)
       = 52.9% → capped at 46.6%

Confidence: Low (±15%)
Range: 39.6% - 53.5%
```

---

## 3-Step Process

### Step 1: Identify Tool Components

For each tool, determine:

1. **Base Model** - Which LLM? (e.g., "claude-4-sonnet", "gpt-4.1")
2. **Architecture** - What type of tool?
   - Autonomous agent (Devin)
   - Agent framework (Replit Agent)
   - IDE assistant agentic (Cursor)
   - IDE assistant completion (Copilot)
   - CLI tool (Aider)
   - Specialized (Sweep, Codium)

3. **Features** - What can it do?
   - Execute code? (yes/limited/no)
   - Run tests? (yes/basic/no)
   - Edit multiple files? (yes/basic/no)
   - Index full codebase? (yes/basic/no)
   - Plan multi-step tasks? (yes/basic/no)

### Step 2: Create Tool Input

```typescript
const tool: ToolInput = {
  id: "cursor",
  name: "Cursor",
  primary_model: "claude-3.5-sonnet-20241022",
  architecture: "ide_agentic",
  features: {
    code_execution: "limited",
    codebase_indexing: "full",
    multi_file_editing: "atomic",
    context_window: 200,
    planning: "basic",
    git_integration: "full",
  },
  has_detailed_docs: true,
};
```

### Step 3: Run Inference

```typescript
const estimate = inferSWEBenchScore(tool);

console.log(estimate.estimated_score); // 46.6%
console.log(estimate.confidence_level); // "low"
console.log(estimate.range); // { lower: 39.6, upper: 53.5 }
```

---

## Architecture Quick Reference

| Type | Multiplier | Examples |
|------|-----------|----------|
| **Autonomous Agent** | 1.10x | Devin, Jules |
| **Agent Framework** | 0.95x | Replit Agent, Rovo |
| **IDE Agentic** | 0.80x | Cursor, Windsurf, Cline |
| **IDE Completion** | 0.50x | Copilot, Tabnine |
| **CLI Tool** | 0.70x | Aider, Goose |
| **Specialized** | 0.60-0.75x | Sweep, Codium |

---

## Feature Impact Quick Reference

### High Impact (+10-20%)

- ✅ Can run tests automatically
- ✅ Full codebase indexing
- ✅ Multi-step planning
- ✅ Direct code execution

### Medium Impact (+5-10%)

- ✅ Multi-file editing
- ✅ Self-correction loops
- ✅ Extended context (100K+)
- ✅ Error recovery

### Low Impact (+2-5%)

- ✅ Git integration
- ✅ Code quality checks
- ✅ Project memory
- ✅ Security scanning

### Caps

- **Per category:** 12-25%
- **Overall max:** +50%
- **IDE assistants:** +35% max
- **Completion tools:** +15% max

---

## Confidence Levels

| Level | Margin | When to Use |
|-------|--------|-------------|
| **High** | ±5% | Published benchmarks, validated architecture |
| **Medium** | ±10% | Good documentation, clear features |
| **Low** | ±15% | Limited info, inferred architecture |
| **Very Low** | ±20% | Minimal data, novel approach |

---

## Common Tool Patterns

### Pattern 1: IDE Assistant (Most Common)

```typescript
{
  architecture: "ide_agentic",
  features: {
    code_execution: "limited",      // +10%
    codebase_indexing: "full",       // +15%
    multi_file_editing: "atomic",    // +10%
    context_window: 100-200,         // +12-15%
    planning: "basic",               // +10%
    git_integration: "basic",        // +5%
  }
  // Expected: 35-55% depending on base model
}
```

### Pattern 2: Autonomous Agent

```typescript
{
  architecture: "autonomous_agent",
  features: {
    code_execution: "full",          // +15%
    test_automation: "full",         // +20% (capped w/ execution)
    codebase_indexing: "full",       // +15%
    multi_file_editing: "atomic",    // +10%
    planning: "advanced",            // +15%
    self_correction: "loops",        // +12%
    // Many more features...
  }
  // Expected: 60-80% with frontier models
}
```

### Pattern 3: Code Completion Tool

```typescript
{
  architecture: "ide_completion",
  features: {
    code_execution: "none",          // +0%
    codebase_indexing: "basic",      // +10%
    multi_file_editing: "basic",     // +5%
    context_window: 32,              // +5%
    code_quality_checks: "basic",    // +5%
  }
  // Expected: 15-30% depending on base model
}
```

---

## Example Estimates

Based on research and validation:

| Tool | Base Model | Architecture | Est. Score | Confidence |
|------|-----------|--------------|-----------|------------|
| **Devin** | GPT-4.1 | Autonomous | ~60-70% | Medium |
| **Cursor** | Claude 3.5 Oct | IDE Agentic | 46.6% | Low |
| **Windsurf** | SWE-1.5 | IDE Agentic | 51.3% | Very Low |
| **Copilot** | GPT-4.1 | IDE Completion | 31.1% | Low |
| **Aider** | GPT-4.1 | CLI | 51% | Medium |
| **Replit Agent** | Claude 4 | Agent Framework | ~69% | Medium |

---

## Data Collection Checklist

For each of 51 tools, find:

- [ ] **Primary LLM** - Check docs, blog posts, or infer
- [ ] **Architecture type** - Analyze tool design
- [ ] **Code execution?** - Can it run code?
- [ ] **Test automation?** - Can it run tests?
- [ ] **Codebase indexing?** - Full repo search?
- [ ] **Multi-file editing?** - Atomic or sequential?
- [ ] **Context window** - How many tokens?
- [ ] **Planning capability** - Multi-step workflows?
- [ ] **Self-correction** - Iterative improvement?
- [ ] **Git integration** - Native git commands?
- [ ] **Terminal access** - Shell commands?

**Time per tool:** 10-15 minutes research
**Total for 51 tools:** 8-12 hours

---

## Output Format

### JSON Output

```json
{
  "tool_id": "cursor",
  "tool_name": "Cursor",
  "estimated_score": 46.6,
  "confidence_level": "low",
  "range": {
    "lower": 39.6,
    "upper": 53.5
  },
  "reasoning": {
    "base_model": "claude-3.5-sonnet-20241022",
    "base_score": 49,
    "architecture": "ide_agentic",
    "architecture_multiplier": 0.8,
    "feature_bonus_percent": 35,
    "calculation": "49.0 × 0.8 × 1.35 = 52.9 → 46.5"
  }
}
```

### Markdown Output

```markdown
| Rank | Tool | Est. Score | Range | Confidence |
|------|------|-----------|-------|------------|
| 1 | Cursor | 46.6% | 39.6-53.5% | low |
```

---

## Integration with Database

### Add Schema Field

```sql
ALTER TABLE tools ADD COLUMN swe_bench_estimate JSONB;

-- Structure:
{
  "score": 46.6,
  "confidence": "low",
  "range": { "lower": 39.6, "upper": 53.5 },
  "generated_at": "2025-01-01T00:00:00Z"
}
```

### Update Tools

```typescript
// After running inference
const estimates = inferBatchScores(tools);

for (const est of estimates) {
  await db.tools.update({
    where: { id: est.tool_id },
    data: {
      swe_bench_estimate: {
        score: est.estimated_score,
        confidence: est.confidence_level,
        range: est.range,
        generated_at: new Date()
      }
    }
  });
}
```

---

## UI Display

### Show Estimate with Badge

```tsx
<div className="swe-bench-score">
  {tool.swe_bench_score ? (
    <>
      <span className="score">{tool.swe_bench_score}%</span>
      <Badge variant="success">Verified</Badge>
    </>
  ) : tool.swe_bench_estimate ? (
    <>
      <span className="score">{tool.swe_bench_estimate.score}%</span>
      <Badge variant={confidenceVariant[tool.swe_bench_estimate.confidence]}>
        Estimated
      </Badge>
    </>
  ) : (
    <span className="score">N/A</span>
  )}
</div>
```

### Confidence Colors

```typescript
const confidenceVariant = {
  high: "success",      // Green
  medium: "warning",    // Yellow
  low: "secondary",     // Orange
  very_low: "error"     // Red
};
```

---

## Troubleshooting

### Q: Estimate seems too high/low?

**Check:**
1. Base model correct? (Claude 4 vs 3.5 is 20+ points)
2. Architecture category accurate?
3. Features not over-claimed?
4. Applied caps correctly?

**Fix:**
- Use conservative base model estimate
- Double-check architecture type
- Verify features in documentation
- Review calibrations

### Q: Confidence level unclear?

**Guidelines:**
- Has published benchmark → High
- Good docs, clear architecture → Medium
- Limited info → Low
- Minimal/marketing only → Very Low

### Q: Which base model to use if unclear?

**Tiers:**
- Latest model mentioned → Use that
- "Frontier" claim → Use `frontier` (60%)
- Older tool → Use `midtier` (40%)
- Very basic → Use `basic` (25%)

### Q: Architecture doesn't fit categories?

**Hybrid approach:**
- If has IDE + agent features → `ide_agentic`
- If primarily one type → Use that
- If truly novel → `unknown` (0.70 default)
- Document assumption

---

## Next Steps

1. **Read this guide** (5 min) ✅ You're here!
2. **Review example tools** in `scripts/infer-swebench-scores.ts` (5 min)
3. **Run script once** to see output (2 min)
4. **Collect data for 5 tools** as practice (1 hour)
5. **Review estimates** - do they seem reasonable? (15 min)
6. **Adjust multipliers** if needed (30 min)
7. **Scale to all 51 tools** (3-4 hours)
8. **Generate final estimates** (5 min)
9. **Integrate into database** (dev work)
10. **Update UI** (dev work)

**Total time:** 1-2 days for complete implementation

---

## Resources

- **Full Research:** See `README.md` and 4 research documents
- **Script:** `scripts/infer-swebench-scores.ts`
- **Examples:** `estimates.json` and `estimates.md`
- **LLM Scores:** `01-llm-baselines.md`
- **Architecture Guide:** `02-architecture-multipliers.md`
- **Feature Guide:** `03-feature-adjustments.md`
- **Complete Model:** `04-inference-model.md`

---

**Ready to start?** Run the script and see example output:

```bash
npx tsx scripts/infer-swebench-scores.ts
```

Then check:
- `docs/research/swe-bench-inference/estimates.md`
- `docs/research/swe-bench-inference/estimates.json`

Good luck! 🚀
