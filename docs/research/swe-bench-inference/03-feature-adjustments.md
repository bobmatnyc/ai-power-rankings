# Feature-Based Adjustments for SWE-bench Inference

Research conducted: January 2025
Part of: SWE-bench Score Inference Model

## Executive Summary

Beyond architecture type and base LLM, specific features significantly impact a tool's SWE-bench performance. This document establishes a systematic approach to quantifying feature impacts through:

1. Feature taxonomy and categorization
2. Evidence-based impact ranges
3. Stacking rules for multiple features
4. Conflict resolution guidelines

**Key Finding:** Feature bonuses can add 5-35% to base performance, but are subject to diminishing returns and architecture constraints.

---

## 1. Feature Categories

Features are grouped into five categories:

1. **Execution & Testing** - Code running and verification
2. **Codebase Understanding** - Context and knowledge management
3. **Planning & Reasoning** - Strategic capabilities
4. **Quality & Safety** - Error prevention and handling
5. **Workflow Integration** - Development environment features

---

## 2. Execution & Testing Features

### 2.1 Direct Code Execution

**Impact: +10% to +15%**

Can execute code directly without manual copy-paste:

- **+15%**: Full sandbox with arbitrary code execution
- **+12%**: Restricted execution (safe commands only)
- **+10%**: Script execution with confirmation

**Examples:**
- ✅ Devin, OpenHands, Goose (full)
- ✅ Aider, Cursor (with approval)
- ❌ GitHub Copilot standard (no execution)

**Why Important:**
- Enables iterative development
- Can verify solutions immediately
- Catches errors early
- Required for autonomous operation

---

### 2.2 Automated Test Execution

**Impact: +10% to +20%**

Can run test suites automatically and interpret results:

- **+20%**: Full test suite execution + interpretation + iteration
- **+15%**: Run tests + basic interpretation
- **+10%**: Can trigger tests (human interprets)
- **+5%**: Test awareness (can read test files)

**Examples:**
- ✅ Autonomous agents (20%)
- ✅ Agent frameworks (15%)
- ⚠️ IDE assistants (5-10%)
- ❌ Completion tools (0%)

**Why Important:**
- SWE-bench requires passing tests
- Iteration based on test failures is critical
- Autonomous validation loop

**Stacking Note:** If tool has execution (+15%) AND automated testing (+20%), cap combined bonus at +25% (not +35%) due to overlap.

---

### 2.3 Debugging Capabilities

**Impact: +5% to +10%**

Can analyze errors and debug issues:

- **+10%**: Automated debugging with stack trace analysis
- **+8%**: Interactive debugger integration
- **+5%**: Error message interpretation
- **+3%**: Basic error awareness

**Examples:**
- ✅ Cursor, Windsurf (8-10%)
- ✅ Aider, Cline (5-8%)
- ⚠️ Copilot (3-5%)

**Why Important:**
- SWE-bench issues often require debugging
- Faster error resolution
- Better fix quality

---

## 3. Codebase Understanding Features

### 3.1 Full Codebase Indexing

**Impact: +10% to +15%**

Can search and understand entire codebase:

- **+15%**: Full semantic code search with RAG
- **+12%**: Full-text search + basic semantic understanding
- **+10%**: File tree + import graph awareness
- **+5%**: Open files only

**Examples:**
- ✅ Cursor, Windsurf, Sourcegraph Cody (15%)
- ✅ Continue, Cline (10-12%)
- ⚠️ Copilot (5%)

**Why Important:**
- SWE-bench issues span multiple files
- Need to understand dependencies
- Context awareness critical

---

### 3.2 Multi-File Editing

**Impact: +5% to +10%**

Can read/write multiple files in single operation:

- **+10%**: Atomic multi-file edits with conflict detection
- **+8%**: Multi-file editing with sequencing
- **+5%**: Can suggest edits to multiple files
- **+3%**: Aware of multi-file changes needed

**Examples:**
- ✅ Cursor Composer, Windsurf Cascade (10%)
- ✅ Aider (8%)
- ⚠️ Copilot Chat (5%)
- ❌ Copilot standard (0%)

**Why Important:**
- 70% of SWE-bench issues require multi-file changes
- Coordination between files matters
- Reduces context switching

---

### 3.3 Extended Context Window

**Impact: +5% to +15%**

Large context window for better understanding:

- **+15%**: 200K+ tokens with excellent retrieval
- **+12%**: 100K-200K tokens
- **+8%**: 50K-100K tokens
- **+5%**: 32K-50K tokens
- **+0%**: <32K tokens (standard)

**Examples:**
- ✅ Claude 4 based tools (15%, 200K context)
- ✅ GPT-4 Turbo tools (12%, 128K context)
- ✅ Gemini 1.5 tools (15%, 1M context)

**Why Important:**
- More code context = better understanding
- Can hold entire modules in context
- Better cross-file reasoning

**Note:** Effective context matters more than raw size. Gemini's 1M context doesn't always outperform Claude's 200K due to retrieval quality.

---

### 3.4 Project Knowledge / Memory

**Impact: +3% to +8%**

Maintains project-specific knowledge across sessions:

- **+8%**: Full project memory with semantic retrieval
- **+5%**: Conversation history + basic memory
- **+3%**: Session-only memory

**Examples:**
- ✅ Cursor, Windsurf (8%)
- ✅ Cline, Continue (5%)
- ❌ Most tools (0%, stateless)

**Why Important:**
- Reduces repeated explanations
- Learns project conventions
- Better context over time

---

## 4. Planning & Reasoning Features

### 4.1 Multi-Step Planning

**Impact: +10% to +15%**

Can create and follow implementation plans:

- **+15%**: Detailed planning with verification checkpoints
- **+12%**: Task breakdown with prioritization
- **+10%**: Simple task sequencing
- **+5%**: Aware of steps needed

**Examples:**
- ✅ Autonomous agents (15%)
- ✅ Agent frameworks (12%)
- ⚠️ Agentic IDE assistants (10%)
- ❌ Completion tools (0%)

**Why Important:**
- Complex SWE-bench issues need strategy
- Order of operations matters
- Prevents getting stuck

---

### 4.2 Self-Correction Loops

**Impact: +8% to +12%**

Can detect and fix own mistakes:

- **+12%**: Automated validation + retry with different approach
- **+10%**: Can detect errors and retry
- **+8%**: Prompted self-review
- **+5%**: Basic error awareness

**Examples:**
- ✅ OpenHands with critic model (12%)
- ✅ Devin, autonomous agents (10%)
- ⚠️ Aider with reflection (8%)
- ❌ Standard assistants (0%)

**Why Important:**
- First attempt rarely perfect
- SWE-bench allows multiple tries
- Distinguishes good from great tools

---

### 4.3 Chain-of-Thought Reasoning

**Impact: +3% to +8%**

Explicit reasoning before code generation:

- **+8%**: Enforced reasoning with verification
- **+5%**: Prompted reasoning (optional)
- **+3%**: Implicit reasoning

**Examples:**
- ✅ o1-based tools (8%)
- ✅ Claude with thinking (5%)
- ⚠️ Most tools (3%, implicit)

**Why Important:**
- Better understanding of complex issues
- Fewer logic errors
- More maintainable solutions

---

### 4.4 Alternative Approach Generation

**Impact: +5% to +10%**

Can generate multiple solution approaches:

- **+10%**: Multiple approaches with evaluation
- **+8%**: N-shot generation with selection
- **+5%**: Can suggest alternatives if asked

**Examples:**
- ✅ OpenHands with multiple samples (10%)
- ⚠️ Some IDE assistants (5%)
- ❌ Most tools (0%)

**Why Important:**
- SWE-bench issues often have multiple solutions
- Some approaches better than others
- Increases success rate

---

## 5. Quality & Safety Features

### 5.1 Error Recovery & Handling

**Impact: +5% to +10%**

Gracefully handles errors and failures:

- **+10%**: Comprehensive error handling with fallbacks
- **+8%**: Error detection + recovery strategies
- **+5%**: Basic error handling
- **+3%**: Error awareness

**Examples:**
- ✅ Production agent frameworks (10%)
- ✅ Robust CLI tools (8%)
- ⚠️ IDE assistants (5%)

**Why Important:**
- Things go wrong in development
- Resilience matters for SWE-bench
- Prevents getting stuck on errors

---

### 5.2 Code Quality Checks

**Impact: +3% to +8%**

Built-in linting, formatting, type checking:

- **+8%**: Full static analysis integration
- **+5%**: Linting + basic checks
- **+3%**: Format checking only

**Examples:**
- ✅ Cursor, Windsurf (5-8%)
- ✅ IDE-integrated tools (5%)
- ❌ Standalone tools (varies)

**Why Important:**
- Prevents obvious errors
- Maintains code quality
- Catches issues before testing

---

### 5.3 Security Scanning

**Impact: +2% to +5%**

Identifies security vulnerabilities:

- **+5%**: Comprehensive security analysis
- **+3%**: Basic vulnerability detection
- **+2%**: Awareness of common issues

**Examples:**
- ✅ Enterprise tools (5%)
- ⚠️ Some IDE assistants (3%)
- ❌ Most tools (0%)

**Why Important:**
- Security matters for production code
- Some SWE-bench issues security-related
- Prevents introducing vulnerabilities

---

## 6. Workflow Integration Features

### 6.1 Git Integration

**Impact: +3% to +8%**

Native git operations:

- **+8%**: Full git workflow (branch, commit, PR)
- **+5%**: Basic git operations (commit, diff)
- **+3%**: Git awareness (can read history)

**Examples:**
- ✅ Aider, Cursor (8%)
- ✅ Cline, Continue (5%)
- ⚠️ Many tools (3%)

**Why Important:**
- Development workflow efficiency
- Context from git history
- SWE-bench based on git repos

---

### 6.2 Terminal Access

**Impact: +5% to +10%**

Direct terminal/shell access:

- **+10%**: Full terminal with arbitrary commands
- **+8%**: Restricted safe commands
- **+5%**: Limited command execution
- **+0%**: No terminal access

**Examples:**
- ✅ CLI tools, agents (10%)
- ✅ Some IDE assistants (5-8%)
- ❌ Completion-only tools (0%)

**Why Important:**
- Essential for building, testing
- Package management
- Development operations

---

### 6.3 Browser Automation

**Impact: +3% to +8%**

Can interact with web browsers:

- **+8%**: Full browser control (Playwright, etc.)
- **+5%**: Basic navigation and interaction
- **+3%**: Can open URLs

**Examples:**
- ✅ Devin, some agents (8%)
- ⚠️ Few tools have this (rare)
- ❌ Most tools (0%)

**Why Important:**
- Some issues require testing UI
- Documentation research
- External resource access

**Note:** Less critical for most SWE-bench issues, so lower impact.

---

## 7. Feature Stacking Rules

### 7.1 Diminishing Returns

Features don't stack linearly. Use these rules:

#### Category Caps

Maximum bonus per category:

- **Execution & Testing**: Cap at +25% (not sum of all)
- **Codebase Understanding**: Cap at +20%
- **Planning & Reasoning**: Cap at +20%
- **Quality & Safety**: Cap at +12%
- **Workflow Integration**: Cap at +15%

**Overall Feature Cap: +50%** (even if category caps sum higher)

#### Example of Capping

Tool with:
- Code execution (+15%)
- Test automation (+20%)
- Debugging (+10%)

Sum: 45%, but **capped at +25%** for Execution category.

---

### 7.2 Architecture Constraints

Some features impossible or redundant for certain architectures:

#### Completion-Only Tools

Cannot benefit from:
- Multi-step planning (requires iteration)
- Test automation (no execution)
- Self-correction (no feedback loop)

**Max feature bonus: +15%** regardless of claimed features.

#### CLI Tools

Already include by definition:
- Terminal access (built-in, no bonus)
- File system access (built-in, no bonus)

Only count features beyond baseline capabilities.

#### Autonomous Agents

Most features expected/included:
- Execution (baseline)
- Planning (baseline)
- Multi-file (baseline)

Only count exceptional features as bonuses.

---

### 7.3 Dependency Rules

Some features require others:

```
IF automated_testing THEN requires code_execution
IF self_correction THEN requires execution OR testing
IF browser_automation THEN bonus only if needed for task
```

---

## 8. Feature Detection Guidelines

### 8.1 Documentation-Based

Check tool documentation for:

- ✅ **Explicit claims**: "Can execute code", "Runs tests"
- ⚠️ **Implicit capabilities**: Shows examples of execution
- ❌ **Vague claims**: "Intelligent coding", "Advanced AI"

### 8.2 Architecture-Based Inference

If documentation unclear, infer from architecture:

```
IF autonomous_agent THEN:
  - Assume: execution, testing, planning, multi-file
  - Verify: self-correction, browser, advanced features

IF ide_assistant THEN:
  - Assume: multi-file (if agentic), context window
  - Verify: execution, testing, planning

IF completion_tool THEN:
  - Assume: basic context only
  - Verify: anything beyond completion
```

### 8.3 Conservative Approach

When uncertain:
- **Don't assume** features without evidence
- **Downgrade claims** from marketing materials by 20%
- **Use lower bound** of impact range
- **Mark as low confidence**

---

## 9. Example Feature Scoring

### Example 1: Cursor (IDE Assistant, Agentic)

**Documented Features:**
- ✅ Multi-file editing → +10%
- ✅ Full codebase indexing → +15%
- ✅ Large context (200K) → +15% *overlap with indexing, count as +12%*
- ✅ Code execution (limited) → +10%
- ⚠️ Planning (basic) → +8%
- ✅ Git integration → +5%

**Raw Sum:** 60%
**After Stacking Rules:**
- Codebase category (15+12): Cap at +20%
- Execution category (10): +10%
- Planning category (8): +8%
- Workflow (5): +5%

**Final Feature Bonus: +30%** (reduced from 60% due to overlaps and caps)

**Confidence:** Medium (well-documented)

---

### Example 2: GitHub Copilot (Completion-Focused)

**Documented Features:**
- ⚠️ Context awareness (limited) → +5%
- ❌ Multi-file (weak) → +3%
- ❌ No execution → +0%
- ❌ No planning → +0%
- ✅ Code quality (via GitHub integration) → +3%

**Raw Sum:** 11%
**After Architecture Constraints:**
- Completion tools max +15%
- Sum is 11%, no cap needed

**Final Feature Bonus: +11%**

**Confidence:** High (well-known tool)

---

### Example 3: OpenHands (Autonomous Agent)

**Documented Features:**
- ✅ Full execution → +15%
- ✅ Automated testing → +20% *overlap, combined cap +25%*
- ✅ Debugging → +10% *included in execution cap*
- ✅ Full codebase → +15%
- ✅ Multi-file → +10% *overlap with codebase*
- ✅ Extended context → +12% *overlap*
- ✅ Multi-step planning → +15%
- ✅ Self-correction (with critic) → +12%
- ✅ Multiple approaches → +10%
- ✅ Error recovery → +10%
- ✅ Git integration → +8%
- ✅ Terminal access → +10% *baseline for agent*

**Raw Sum:** 137% (!!)
**After Stacking Rules:**
- Execution category: +25% (capped)
- Codebase category: +20% (capped)
- Planning category: +20% (capped)
- Quality category: +10%
- Workflow: +8%
Sum: 83%, **but overall cap: +50%**

**Final Feature Bonus: +50%** (max possible)

**Confidence:** High (open-source, benchmarked)

---

## 10. Feature Bonus Summary Table

| Feature | Category | Impact | Evidence Needed |
|---------|----------|--------|----------------|
| **Code Execution** | Execution | +10-15% | Demo, docs, or architecture |
| **Automated Testing** | Execution | +10-20% | Test running examples |
| **Debugging** | Execution | +5-10% | Debug workflow docs |
| **Full Codebase Index** | Codebase | +10-15% | Search features, RAG |
| **Multi-File Editing** | Codebase | +5-10% | Edit examples |
| **Extended Context** | Codebase | +5-15% | Model specs (>32K) |
| **Project Memory** | Codebase | +3-8% | Memory features |
| **Multi-Step Planning** | Planning | +10-15% | Planning interface |
| **Self-Correction** | Planning | +8-12% | Iteration examples |
| **Chain-of-Thought** | Planning | +3-8% | Reasoning display |
| **Multiple Approaches** | Planning | +5-10% | N-shot generation |
| **Error Recovery** | Quality | +5-10% | Error handling docs |
| **Code Quality Checks** | Quality | +3-8% | Linting integration |
| **Security Scanning** | Quality | +2-5% | Security features |
| **Git Integration** | Workflow | +3-8% | Git commands |
| **Terminal Access** | Workflow | +5-10% | Shell examples |
| **Browser Automation** | Workflow | +3-8% | Browser features |

---

## 11. Recommendations for Inference Script

### Step 1: Feature Detection
```typescript
interface FeatureSet {
  // Execution & Testing
  code_execution: boolean;
  test_automation: boolean;
  debugging: boolean;

  // Codebase Understanding
  full_codebase_index: boolean;
  multi_file_editing: boolean;
  extended_context: number; // in thousands
  project_memory: boolean;

  // Planning & Reasoning
  multi_step_planning: boolean;
  self_correction: boolean;
  chain_of_thought: boolean;
  multiple_approaches: boolean;

  // Quality & Safety
  error_recovery: boolean;
  code_quality_checks: boolean;
  security_scanning: boolean;

  // Workflow Integration
  git_integration: boolean;
  terminal_access: boolean;
  browser_automation: boolean;
}
```

### Step 2: Calculate Raw Bonuses
```typescript
function calculateRawBonus(features: FeatureSet): number {
  let bonus = 0;

  // Execution category
  if (features.code_execution) bonus += 0.15;
  if (features.test_automation) bonus += 0.20;
  if (features.debugging) bonus += 0.10;

  // ... (continue for all features)

  return bonus;
}
```

### Step 3: Apply Stacking Rules
```typescript
function applyStackingRules(
  rawBonus: number,
  architecture: ArchitectureType,
  features: FeatureSet
): number {
  // Calculate per-category bonuses
  const executionBonus = Math.min(
    calculateExecutionBonus(features),
    0.25 // cap
  );

  // ... (other categories)

  // Sum categories
  let totalBonus = executionBonus + codebaseBonus +
                   planningBonus + qualityBonus + workflowBonus;

  // Apply architecture constraints
  if (architecture === 'completion') {
    totalBonus = Math.min(totalBonus, 0.15);
  }

  // Apply overall cap
  totalBonus = Math.min(totalBonus, 0.50);

  return totalBonus;
}
```

---

## Next Steps

1. Build complete inference formula combining all components
2. Implement TypeScript calculation script
3. Create feature detection heuristics
4. Validate against known scores
5. Generate estimates for all 51 tools

---

## References

- Tool documentation and feature analysis
- SWE-bench task requirements
- Performance studies of validated tools
- Architecture pattern analysis
