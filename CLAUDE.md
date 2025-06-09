# Claude Code Instructions

## MCP Server Integration

This project includes a Model Context Protocol (MCP) server that provides direct database access with three types of features:

### Resources (Quick Data Access)
- `rankings://current` - Current AI tool rankings
- `tools://directory` - Complete tools directory
- `metrics://definitions` - Metric definitions and weights
- `categories://list` - Tool categories with descriptions

### Prompts (Guided Tasks)
- `analyze-rankings` - Analyze rankings and trends
- `compare-tools` - Compare multiple tools
- `track-metrics` - Track and update tool metrics
- `add-new-tool` - Add new AI coding tools

### Tools (Direct API)
- Read tools: get_current_rankings, get_tool_details, search_tools, etc.
- Write tools: add_metric, update_tool_info, add_tool, bulk_add_metrics, delete_metric

See `/docs/MCP-SERVER.md` for setup instructions.

## CRITICAL: Review Required Documentation

**IMPORTANT**: Before starting any work, you MUST review these files:

1. `/docs/INSTRUCTIONS.md` - Core development instructions
2. `/docs/WORKFLOW.md` - Required workflow processes
3. `/docs/PROJECT.md` - Project specifications and requirements (if exists)
4. `/docs/DATABASE.md` - Database connection, schema, and manipulation guide

**Following these instructions is MANDATORY. Ask for clarification before considering ANY variance from the documented procedures.**

## Development Guidelines

- Always run lint and typecheck before completing tasks
- Follow existing code patterns and conventions
- **NEVER deviate from documented instructions without explicit approval**
