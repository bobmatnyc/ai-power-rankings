# 🔧 INSTRUCTIONS (AI Power Rankings Development)

Updated: 2025-09-23

<!-- PM_INSTRUCTIONS_VERSION: 0003 -->
<!-- 🔴 CRITICAL PM OVERRIDE: See /docs/PM_INSTRUCTIONS.md for PM-specific rules -->

---

## 📌 1. Agent Protocol & Execution Flow

**Who this is for**: AI agents and human developers collaborating on production-grade code.

### ✅ Protocol Summary

1. **Validate assumptions** – ask clarifying questions before proceeding.
2. **Implement with simplicity** – prefer minimal, working code.
3. **Test and lint rigorously** – `pnpm run lint && pnpm run type-check && pnpm test`.
4. **Verify CI checks before closing tickets** – run full CI pipeline locally.
5. **Document intent** – not just behavior.
6. **Confirm before architectural shifts or abstractions.**

> You are expected to follow all rules by default. No mocks, hacks, or shortcuts unless explicitly approved.

### 🔴 PM-Specific Override
**If you are the PM (Project Manager):**
- **MANDATORY**: Read `/docs/PM_INSTRUCTIONS.md` FIRST
- **DELEGATE 100%** of implementation work
- **NEVER** write code, edit files, or implement features yourself
- **ALWAYS** use Task tool with appropriate agent

---

## 🧠 2. Core Principles

- **Build real, test real** – avoid mocks unless directed.
- **Simplicity > Cleverness** – prefer straight-line solutions.
- **Validate all assumptions** – ask before introducing new paradigms.
- **Follow monorepo principles** – workspace isolation, shared utilities.
- **Document clearly** – capture why, not just how.
- **No implicit fallbacks** – when configurations fail, fail gracefully with clear errors. Never automatically fall back to different services.

---

## 🛠️ 3. Stack-Specific Directives

### TypeScript

- Must use `strict: true` config (`tsconfig.json`).
- Avoid `any`. Prefer `unknown`, generics, or well-defined types.
- Use `Pick`, `Partial`, `Required`, etc. to reduce duplication.
- All functions and exports must use **JSDoc** with type annotations.

### Next.js (15+)

- Use the **App Router** (`src/app`) with layout grouping.
- Prefer **React Server Components** by default.
- Explicitly define rendering mode (SSG, ISR, SSR, RSC).
- API routes live in `src/app/api`; use `POST` methods with proper validation.

### Supabase

- Use source-oriented metrics storage (`metrics_sources` table)
- Each source URL is unique and can contain metrics for multiple tools
- Store all metrics as JSON with evidence and confidence levels
- Use materialized views for tool-centric queries

### Data Collection

- Use AI-powered extraction with GPT-4 for article analysis
- Follow METRICS-EXTRACTION-PROMPT.md for consistent extraction
- Store metrics with full attribution and source URLs
- Support multi-tool sources (benchmarks, comparisons)

---

## 📦 4. Monorepo Workflow

### Project Structure

```
/
├── apps/
│   ├── web/
│   └── admin/
├── packages/
│   ├── ui/
│   ├── utils/
│   └── config/
├── tools/
└── package.json
```

### Automation

- Use `pnpm` for package management, builds, tests, and CI.
- `pnpm run lint && pnpm run type-check && pnpm test` required before merge.
- Feature branches only. Use squash merges.
- Run full CI checks locally before pushing: `pnpm run ci:local`

---

## ✅ 5. Best Practices

### Package Selection Protocol

1. **Always search for official or well-supported packages first**

   - Check for official packages from the vendor (e.g., `@payloadcms/email-resend` for Resend + Payload)
   - Look for packages with strong community support (weekly downloads, recent updates, active maintainers)
   - Verify compatibility with our current stack versions
   - Check package documentation and examples before implementation

2. **Evaluate packages before custom development**

   - NPM weekly downloads > 1,000 preferred
   - Last publish date within 6 months
   - Active issue resolution and maintenance
   - Compatible license (MIT, Apache 2.0, etc.)
   - Well-documented API and usage examples

3. **Only build custom solutions when**
   - No suitable package exists after thorough search
   - Existing packages don't meet security requirements
   - Custom requirements are significantly different from available solutions
   - The team explicitly approves custom development

### General Best Practices

- Use modern, community-validated standards.
- Prefer mature, well-supported libraries.
- Explain any deviations from best practices.
- Confirm before changing behavior, logic, or architecture.

---

## 🧪 6. Testing Standards

- All utilities and APIs must have unit tests.
- Use **Jest** (`pnpm test`).
- Minimum 80% coverage unless annotated with `@low-test-priority`.
- Avoid snapshots unless explicitly justified.
- Prefer real API interactions over mocks.
- Ensure all mocked modules match actual export signatures.

---

## ⚙️ 7. CI / DevOps

- Pre-commit hooks must run lint, type-check, and tests.
- Do not merge if any check fails.
- Verify CI status before closing any ticket.
- Secrets must go in `.env.local` – never hardcoded.
- All API clients must include comments: purpose, inputs, outputs.

### CI Pre-flight Checklist

Before pushing changes or closing tickets:

1. **Run full CI locally:**

   ```bash
   pnpm run lint
   pnpm run type-check
   pnpm test
   pnpm run build
   ```

2. **Fix all errors before pushing** – don't rely on CI to catch issues
3. **Verify pnpm-lock.yaml** is up to date: `pnpm install`
4. **Check for unused imports** – remove them to avoid lint errors
5. **Verify module case sensitivity** – ensure all imports match actual filenames

**For deployment procedures, see [`/docs/WORKFLOW.md`](/docs/WORKFLOW.md)**

---

## 📘 8. Documentation

- Document _intent_ as well as behavior.
- Use JSDoc with full TypeScript annotations.
- Comment all API interactions clearly.

---

## 🔭 9. Code Quality & Workflow

- Run linting and type checks after every change.
- Build and verify tests before handing off code.
- Follow existing conventions and naming patterns.
- Fix all lint/type errors before pushing changes.

### Common Issues to Watch For

1. **Module Resolution:**

   - Use exact case for imports (e.g., `pathValidator.ts` not `PathValidator.ts`)
   - Export all utilities from their index files
   - Ensure mocked modules in tests match actual exports

2. **TypeScript Compilation:**

   - Remove unused imports immediately
   - Use proper types, avoid `any`
   - Ensure all files are included in `tsconfig.json`

3. **Package Management:**
   - Always run `pnpm install` after changing dependencies
   - Keep `pnpm-lock.yaml` synchronized
   - Use pnpm for all operations

### Fallback Behavior

1. **API Client Selection:**

   - Never implement automatic fallbacks between AI services
   - If the user's configured service is unavailable, fail with a clear error
   - List all available options in error messages
   - Fallback strategies must be explicitly configured by the user

2. **Configuration Failures:**

   - When required environment variables are missing, fail immediately
   - Provide specific guidance on which variables need to be set
   - Never assume a default service or configuration
   - Always respect user intent - if they configured Service A, never use Service B

3. **Error Messages:**
   - Include actionable steps to resolve configuration issues
   - List specific environment variables needed
   - Provide example values or formats where appropriate

---

## 📝 10. Design Documents

Design documents live in `doc/design/` and are required for all substantial features, architecture changes, or systems work. They provide a persistent source of truth for human and AI collaborators.

### 📌 Purpose

Design docs should:

- Capture **intent** and **trade-offs** before implementation.
- Guide decisions, discussions, and downstream work (testing, docs, API boundaries).
- Serve as onboarding material for new engineers or agents picking up the system.

### 📄 Structure

```md
# Feature Name or System Title

## Summary

What is this and why are we doing it?

## Problem

The pain point, friction, or opportunity this addresses.

## Goals & Non-goals

Explicit scope boundaries.

## Product Considerations

User needs, performance, accessibility, regulatory impacts.

## Technical Design

Architecture, key components, protocols, libraries, and rationale.

## Implementation Plan

Phased rollout or sequencing steps.

## Open Questions

Unresolved items or future revisits.

## References

Link related issues, PRs, or past work.
```

### 🔗 Workflow Expectations

- Each major issue in `PROJECT.md` **must reference a design doc** in `doc/design/` unless trivial.
- GitHub Issues proposing large features must either embed or link to the doc.
- Revisit/update the design doc post-launch with a closing summary.

---

## 🔁 11. Git Workflow & Version Control

**See [`/docs/WORKFLOW.md`](/docs/WORKFLOW.md) for comprehensive Git workflow procedures, commit conventions, and branch management.**

---

## 🧭 12. GitHub Issue Tracking

We use **GitHub Issues** for all tracked work—features, bugs, ideas, spikes.  
Submit via GitHub Issues REST API with `GITHUB_TOKEN`. No automation scripts.

Each issue answers: _What are we doing, why does it matter, and how will we know it’s done?_

### Issue Fields to Fill

- **Title** – human-readable and emoji-tagged (e.g. `🚀 Add login flow`)
- **Description** – context, proposed approach, and acceptance criteria
- **Labels** – use taxonomy below
- **Assignee** – assign only when actively in progress
- **Milestone** – for cycles/themes
- **References** – include links to **design docs** where applicable

### Label Taxonomy

| Category | Prefix    | Examples                                 |
| -------- | --------- | ---------------------------------------- |
| Theme    | `theme:`  | `theme:infra`, `theme:ai`, `theme:ux`    |
| Status   | `status:` | `status:in-progress`, `status:blocked`   |
| Priority | `prio:`   | `prio:high`, `prio:low`                  |
| Effort   | `size:`   | `size:xs`, `size:m`, `size:xl`           |
| Type     | `type:`   | `type:bug`, `type:feature`, `type:chore` |

---

## 📅 13. Milestones = Roadmap Buckets

Milestones replace a static `ROADMAP.md`. Use them to group issues by cycle or theme.

- Examples: `May 2025`, `LLM Infra`, `Billing Cleanup`
- Include: goal (1–2 lines), timeframe, and summary
- Optionally close with a wrap-up issue
- Design docs should be linked for each milestone initiative

---

## 📌 14. Decision Logs

Capture important design or architectural decisions as `type:decision` issues.

- Use titles like `📌 Decision: Move to Mastra`
- Include rationale and resolution in comments
- Reference relevant **design documents** if one informed the decision

---

## 🧾 15. How to Write Good Issues

- Start with **why**
- Use checklists if multiple deliverables
- Use code blocks and links to previous Issues/PRs
- Link relevant design docs from `doc/design/`

---

## 🚀 16. Proposing New Work

Anyone can open an Issue. Use this template:

```md
### Summary

What’s the idea or problem?

### Why it matters

Why now? What impact does it have?

### Proposal (if known)

How might we tackle this? Link to any relevant design doc in `doc/design/`.

### Success Criteria

What does “done” look like?
```

Apply appropriate `type:` and `theme:` labels.

---

## 🔁 17. Replaces These Docs

- `ROADMAP.md` → use Milestones
- `PROGRESS.md` → use Labels + Issues
- Task trackers (Notion, Google Docs) → link Issues and **Design Docs**

---

## 🚀 Quick Reference: CI Commands

Run these commands before pushing any changes:

```bash
# Full CI check (run all in sequence)
pnpm run lint        # Check code style
pnpm run type-check  # Check TypeScript types
pnpm test           # Run all tests
pnpm run build      # Build the project

# Fix common issues
pnpm install        # Sync pnpm-lock.yaml
pnpm run lint:fix   # Auto-fix lint issues (if available)

# Verify everything at once
pnpm run ci:local   # Run full CI pipeline locally (if configured)
```

---

## 👁️ Final Note

Issues aren't just tasks—they're **shared context**.  
Design docs make that context durable.

Write them like you're briefing a future teammate (or future you).  
Clear Issues and thoughtful docs create speed later.
