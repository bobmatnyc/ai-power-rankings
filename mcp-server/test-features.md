# MCP Server Features Test Guide

This guide shows how to test the new resource and prompt features.

## Testing Resources

When connected to the MCP server, try these commands:

### 1. List Available Resources
Ask: "What resources are available?"

Expected: The server should list 4 resources:
- rankings://current
- tools://directory  
- metrics://definitions
- categories://list

### 2. Read Current Rankings
Ask: "Show me the rankings://current resource"

Expected: JSON with current rankings, scores, and tool details

### 3. Read Tools Directory
Ask: "Get the tools://directory resource"

Expected: JSON with all tools organized by category

### 4. Read Metric Definitions
Ask: "What's in the metrics://definitions resource?"

Expected: JSON with detailed metric definitions and weights

### 5. Read Categories List
Ask: "Show me the categories://list resource"

Expected: JSON with all categories, descriptions, and tool counts

## Testing Prompts

### 1. List Available Prompts
Ask: "What prompts are available?"

Expected: The server should list 4 prompts:
- analyze-rankings
- compare-tools
- track-metrics
- add-new-tool

### 2. Analyze Rankings
Ask: "Use the analyze-rankings prompt"

Expected: A pre-filled prompt to analyze current rankings

### 3. Compare Tools
Ask: "Use the compare-tools prompt with cursor,github-copilot,claude-code"

Expected: A prompt to compare these three tools

### 4. Track Metrics
Ask: "Use the track-metrics prompt for windsurf"

Expected: A prompt to track and update metrics for Windsurf

### 5. Add New Tool
Ask: "Use the add-new-tool prompt"

Expected: A guided prompt to add a new AI coding tool

## Testing Tools (Direct API)

The existing tools still work as before:
- get_current_rankings
- get_tool_details
- search_tools
- add_metric
- update_tool_info
- etc.

## Full Example Session

```
User: What resources are available?
Assistant: [Lists 4 resources]

User: Show me the rankings://current resource
Assistant: [Shows current rankings JSON]

User: Use the analyze-rankings prompt for code-editor tools
Assistant: [Runs analysis on code editor rankings]

User: Compare cursor and github-copilot
Assistant: [Uses tools to compare the two]
```