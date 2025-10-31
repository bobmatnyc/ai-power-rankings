# Tool Issues Investigation Report
**Date**: 2025-10-30
**Investigator**: Research Agent
**Project**: AI Power Rankings

---

## Executive Summary

Investigation completed on four reported tool entry issues in the AI Power Rankings database. Key findings:

1. **docker-compose-agents**: Auto-created placeholder - RECOMMEND REMOVAL
2. **Microsoft Agentic DevOps**: Legitimate but incomplete entry - NEEDS ENRICHMENT
3. **Goose Logo**: Logo assets identified - READY TO ADD
4. **Recently Updated Tools**: Missing logo_url in API response - FIX IDENTIFIED

---

## Issue 1: docker-compose-agents

### Database Investigation

**Status**: ✅ Found in database

**Database Entry**:
- ID: `515b0d4e-5291-49c1-a7f9-d0c80d6305b0`
- Slug: `docker-compose-agents`
- Name: `Docker Compose Agents`
- Category: `other`
- Status: `active`
- Created: `2025-10-27T02:17:21.421Z`
- Updated: `2025-10-27T02:17:21.421Z`

**Data JSONB**:
```json
{
  "autoCreated": true,
  "createdByArticleId": "552e6c6b-4ec5-4eae-b8ca-f159b977f8cd",
  "firstMentionedDate": "2025-10-27T02:17:21.375Z"
}
```

### Research Findings

**What it Actually Is**:
- NOT a standalone tool
- This is **"Docker Compose for Agents"** - a Docker feature/capability
- Announced at Docker events in 2024-2025
- GitHub repository: `docker/compose-for-agents`
- It's a FRAMEWORK/PLATFORM capability, not a distinct AI coding tool

**Official Information**:
- Website: https://www.docker.com/blog/build-ai-agents-with-docker-compose/
- GitHub: https://github.com/docker/compose-for-agents
- Description: "Build and run AI agents using Docker Compose. A collection of ready-to-use examples for orchestrating open-source LLMs, tools, and agent runtimes."

### Analysis

**Problems with Current Entry**:
1. ❌ Auto-created from news article mention
2. ❌ No proper metadata (no website, description, logo)
3. ❌ Categorized as "other" instead of proper category
4. ❌ Not a standalone AI coding tool
5. ❌ More of a development framework feature

### Recommendation: **REMOVE**

**Rationale**:
- This is a Docker platform feature, not an independent AI tool
- Similar to not listing "VS Code Extensions API" as a separate tool
- The article likely mentioned it in context of Docker's AI capabilities
- Would be more appropriate as a note under Docker's entry

**Alternative**: If keeping, must:
1. Rename to proper name: "Docker Compose for Agents"
2. Add complete metadata from official sources
3. Recategorize (possibly to "platform" or "framework")
4. Add clear description explaining it's a Docker feature
5. Add logo (Docker logo or variant)
6. Add website and documentation URLs

---

## Issue 2: Microsoft Agentic DevOps

### Database Investigation

**Status**: ✅ Found in database

**Database Entry**:
- ID: `8f27e333-bc0b-4006-abd6-a2904728b683`
- Slug: `microsoft-agentic-devops`
- Name: `Microsoft Agentic DevOps`
- Category: `code-assistant`
- Status: `active`
- Created: `2025-10-27T02:17:21.387Z`
- Updated: `2025-10-27T02:17:21.387Z`

**Data JSONB**:
```json
{
  "autoCreated": true,
  "createdByArticleId": "552e6c6b-4ec5-4eae-b8ca-f159b977f8cd",
  "firstMentionedDate": "2025-10-27T02:17:21.340Z"
}
```

### Research Findings

**What it Is**:
- **"Agentic DevOps"** is Microsoft's VISION/STRATEGY, not a standalone product
- Announced at Microsoft Build 2025 (May 2025)
- Encompasses multiple products and services:
  - GitHub Copilot Agent Mode
  - Azure AI Foundry Agent Service
  - Microsoft Agent Framework (announced October 2025)

**Key Components**:

1. **GitHub Copilot Agent Mode**
   - Supercharged GitHub Copilot for complex, multi-step tasks
   - Can analyze entire codebases, edit across files, generate tests
   - Part of GitHub Copilot subscription

2. **Azure AI Foundry Agent Service** (GA in 2025)
   - Orchestrate multiple specialized agents
   - Unified SDK with Semantic Kernel and AutoGen
   - Agent-to-Agent (A2A) and Model Context Protocol (MCP) support

3. **Microsoft Agent Framework** (October 2025 Public Preview)
   - Open-source SDK and runtime
   - Available on GitHub
   - Supports .NET and Python
   - For building, managing, and deploying intelligent agents

### Analysis

**Problems with Current Entry**:
1. ❌ "Microsoft Agentic DevOps" is not a product name
2. ❌ It's a strategic initiative/vision encompassing multiple products
3. ❌ Auto-created from article mention without proper research
4. ❌ Missing ALL metadata (logo, website, description, etc.)
5. ❌ Unclear what specific product this represents

### Recommendation: **RESTRUCTURE**

**Option A: Remove and Create Separate Entries**
Create individual entries for:
1. **GitHub Copilot** (should already exist - enhance with Agent Mode info)
2. **Microsoft Agent Framework** (new entry)
3. **Azure AI Foundry Agent Service** (new entry if relevant)

**Option B: Repurpose as Microsoft Agent Framework**
Transform this entry into:
- Name: `Microsoft Agent Framework`
- Category: `framework` or `code-assistant`
- Add comprehensive metadata (see below)

### Missing Information to Add

**Product Name**: Microsoft Agent Framework

**Description**:
"Open-source SDK and runtime for building, orchestrating, and deploying AI agents and multi-agent workflows. Part of Microsoft's Agentic DevOps initiative announced at Build 2025."

**Website**:
- Main: https://devblogs.microsoft.com/blog/reimagining-every-phase-of-the-developer-lifecycle
- Azure Blog: https://azure.microsoft.com/en-us/blog/agentic-devops-evolving-software-development-with-github-copilot-and-microsoft-azure/

**Logo**:
- Use Microsoft Azure logo or Microsoft logo
- Download from: https://www.microsoft.com/en-us/legal/intellectualproperty/trademarks

**Launch Date**:
- October 1, 2025 (Public Preview)
- Announced at Microsoft Build 2025 (May 19, 2025)

**Pricing**:
- Open-source (free)
- Part of Azure AI Foundry services (enterprise pricing varies)

**Key Features**:
- Unified SDK for .NET and Python
- Multi-agent workflow orchestration
- Agent-to-Agent (A2A) communication
- Model Context Protocol (MCP) support
- Integration with Semantic Kernel and AutoGen

**Status**: Public Preview (as of October 2025)

**Relationship to GitHub Copilot**:
This is separate but complementary. GitHub Copilot has its own "Agent Mode" feature, while Agent Framework is for building custom agents.

---

## Issue 3: Goose Logo

### Database Investigation

**Status**: ✅ Found in database

**Current State**:
- Name: `Goose`
- Category: `code-assistant`
- Current Logo: `N/A` (missing)
- Website: `N/A` (missing)

### Research Findings

**Official Logo Assets Located**:

From https://block.github.io/goose/:
1. **Light Logo**: `https://block.github.io/goose/img/logo_light.png`
2. **Dark Logo**: `https://block.github.io/goose/img/logo_dark.png`
3. **Black Logo**: `https://block.github.io/goose/img/goose-logo-black.png`

### Recommendation

**Download and Use**:
- Primary: `logo_dark.png` or `logo_light.png`
- Format: PNG (as available)
- Recommended local path: `/public/tools/goose.png`

**Instructions**:
1. Download logo from: `https://block.github.io/goose/img/logo_dark.png`
2. Save to: `/public/tools/goose.png`
3. Resize to 200x200px if needed
4. Update database entry with logo_url: `/tools/goose.png`

**Additional Metadata to Add**:
- Website: `https://block.github.io/goose/`
- GitHub: `https://github.com/block/goose`
- Description: "Your local AI agent, automating engineering tasks seamlessly"
- Company: Block (formerly Square)

---

## Issue 4: Recently Updated Tools - Missing Logos

### Component Investigation

**Status**: ✅ Issue identified

**Component Location**: `/Users/masa/Projects/aipowerranking/components/ui/whats-new-modal.tsx`

**API Endpoint**: `/Users/masa/Projects/aipowerranking/app/api/whats-new/route.ts`

### Analysis

**Root Cause**: The API endpoint does NOT include `logo_url` in the tool data response.

**Current API Response** (lines 113-120 in `/app/api/whats-new/route.ts`):
```typescript
.map((tool) => ({
  id: tool.id,
  name: tool.name,
  slug: tool.slug,
  description: (tool as any).description || "",
  updatedAt: tool.updated_at,
  category: tool.category,
}));
```

**Problem**: Missing `logo_url` field from response.

**Component Issue**: The `WhatsNewModal` component (lines 312-344) renders tool updates but has no code to display logos because the data isn't provided.

### Fix Required

**Location**: `/Users/masa/Projects/aipowerranking/app/api/whats-new/route.ts`

**Change Needed** (around line 113-120):

```typescript
.map((tool) => {
  const toolData = tool.info || {};
  return {
    id: tool.id,
    name: tool.name,
    slug: tool.slug,
    description: (tool as any).description || "",
    updatedAt: tool.updated_at,
    category: tool.category,
    logo_url: toolData.logo_url || null,  // ADD THIS LINE
  };
});
```

**Component Update**: `/Users/masa/Projects/aipowerranking/components/ui/whats-new-modal.tsx`

Update the type definition (around line 44-53):
```typescript
| {
    type: "tool";
    date: string;
    id: string;
    name: string;
    slug: string;
    description: string;
    updatedAt: string;
    category: string;
    logo_url?: string;  // ADD THIS LINE
  }
```

Add logo rendering in the component (around line 320-323):
```tsx
<div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer">
  <div className="flex-shrink-0 mt-1">
    {item.logo_url ? (
      <img src={item.logo_url} alt={item.name} className="h-8 w-8 rounded" />
    ) : (
      getItemTypeIcon(item)
    )}
  </div>
  ...
```

---

## Summary of Recommendations

### Immediate Actions

1. **docker-compose-agents**:
   - ❌ **DELETE** this entry
   - Reason: Not a standalone tool, auto-created placeholder

2. **Microsoft Agentic DevOps**:
   - 🔄 **TRANSFORM** into "Microsoft Agent Framework"
   - Add all missing metadata (see details above)
   - Find and add Microsoft/Azure logo

3. **Goose Logo**:
   - ✅ **ADD LOGO** from `https://block.github.io/goose/img/logo_dark.png`
   - Add missing website and metadata

4. **Recently Updated Tools**:
   - 🔧 **FIX API** to include logo_url field
   - 🔧 **UPDATE COMPONENT** to display logos
   - Code changes specified above

### Database Cleanup Tasks

1. Review all tools with `autoCreated: true` flag
2. Remove or enrich auto-created entries
3. Add missing logos for established tools
4. Verify all tools have proper metadata

---

## Files Reference

### Database Schema
- `/Users/masa/Projects/aipowerranking/lib/db/schema.ts`
- `/Users/masa/Projects/aipowerranking/lib/db/repositories/tools.repository.ts`

### API Endpoints
- `/Users/masa/Projects/aipowerranking/app/api/whats-new/route.ts` - Main feed
- `/Users/masa/Projects/aipowerranking/app/api/tools/recent-updates/route.ts` - Legacy endpoint

### Components
- `/Users/masa/Projects/aipowerranking/components/ui/whats-new-modal.tsx` - Main modal

### Investigation Scripts
- `/Users/masa/Projects/aipowerranking/scripts/investigate-tool-issues.ts` - Database query script

---

## Additional Notes

**Auto-Created Tools Warning**:
Both problematic entries have `"autoCreated": true` in their data. This suggests an automatic tool creation process from news article mentions that needs review. Recommend:
1. Review all auto-created tools
2. Either disable auto-creation or add validation
3. Require manual approval for auto-created tools

**Article Reference**:
Both tools were created by article ID: `552e6c6b-4ec5-4eae-b8ca-f159b977f8cd`
- Recommend reviewing this article to understand context
- Check if article mentions are being correctly interpreted

---

**Report Complete**
