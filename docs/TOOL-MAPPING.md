# Tool Mapping System

## Overview

The tool mapping system helps identify which AI coding tool is mentioned in news articles by matching article titles and content against a predefined set of search terms for each tool.

## Configuration

The mapping configuration is stored in `/data/json/tool-terms-mapping.json`. Each tool has:

- `tool_slug`: The unique identifier for the tool
- `tool_name`: The display name of the tool
- `search_terms`: An array of terms that should match this tool

## How It Works

1. **Text Matching**: The system uses the `findToolByText()` function in `/src/lib/tool-matcher.ts` to find tools mentioned in text.

2. **Priority**: More specific terms are matched first (e.g., "Claude Code" before "Claude").

3. **Word Boundaries**: The system checks for whole word matches to avoid false positives.

4. **Possessive Forms**: Handles possessive forms like "Windsurf's" or "Replit's".

## Examples

- "Replit CEO announces..." → Maps to "Replit Agent"
- "Claude.AI introduces new features..." → Maps to "Claude Artifacts"
- "GitHub Copilot update..." → Maps to "GitHub Copilot"
- "Windsurf's head of engineering..." → Maps to "Windsurf"

## Adding New Mappings

To add search terms for a new tool:

1. Edit `/data/json/tool-terms-mapping.json`
2. Add a new entry with the tool's slug, name, and search terms
3. Include variations, common misspellings, and abbreviations

Example:

```json
{
  "tool_slug": "new-tool",
  "tool_name": "New Tool",
  "search_terms": ["new tool", "newtool", "new-tool", "nt"]
}
```

## Usage in Code

```typescript
import { findToolByText } from "@/lib/tool-matcher";

// Find tool mentioned in a title
const toolSlug = findToolByText("Replit CEO announces new features");
// Returns: "replit-agent"
```

## Maintenance

Regularly review and update the mappings based on:

- How tools are mentioned in news articles
- New tools added to the platform
- Common variations in tool names
- Company rebranding or name changes
