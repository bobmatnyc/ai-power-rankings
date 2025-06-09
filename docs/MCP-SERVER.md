# MCP Server Setup for AI Power Rankings

This guide explains how to set up the MCP (Model Context Protocol) server for local development with ngrok integration.

## Overview

The MCP server provides Claude AI with direct access to query the AI Power Rankings database. It's configured for local development only and uses ngrok to expose the local server to Claude.

## Setup Instructions

### 1. Install Dependencies

From the project root:

```bash
npm run mcp:setup
```

This will install dependencies and build the MCP server.

### 2. Install ngrok

```bash
# macOS
brew install ngrok

# Or download from https://ngrok.com
```

### 3. Configure ngrok

1. Create a free account at https://ngrok.com
2. Get your auth token from the dashboard
3. Configure ngrok:

```bash
ngrok config add-authtoken YOUR_AUTH_TOKEN
```

### 4. Start the MCP Server

In one terminal:

```bash
npm run mcp:dev
```

### 5. Configure Claude Desktop

Since MCP servers communicate via stdio (not HTTP), you don't need ngrok for Claude Desktop. Instead, configure Claude Desktop to run the MCP server directly.

**Note**: The ngrok domain (1mbot.ngrok.app) would only be needed if you were building a web-based interface to the MCP server, which is not the standard setup.

Add to your Claude Desktop config file:

**Location:**
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/claude/claude_desktop_config.json`

**Configuration:**

```json
{
  "mcpServers": {
    "ai-power-rankings": {
      "command": "node",
      "args": ["/Users/masa/Projects/ai-power-rankings/mcp-server/dist/index.js"],
      "env": {}
    }
  }
}
```

### 7. Restart Claude Desktop

After updating the config, completely quit and restart Claude Desktop.

## Available MCP Features

The MCP server provides three types of features:

### Resources

Resources provide quick access to common data:

- **rankings://current** - Current AI tool rankings with scores
- **tools://directory** - Complete directory of all AI coding tools
- **metrics://definitions** - Definitions of all ranking metrics
- **categories://list** - List of tool categories with descriptions

### Prompts

Pre-configured prompts for common tasks:

- **analyze-rankings** - Analyze current rankings and trends
- **compare-tools** - Compare multiple AI coding tools
- **track-metrics** - Track and update metrics for a tool
- **add-new-tool** - Add a new AI tool to the database

### Tools

#### Query Tools (Read Access)

- **get_current_rankings** - Get current AI tool rankings
  - Optional: `category` filter (e.g., "code-editor", "autonomous-agent")
  - Optional: `limit` (default: 15)

- **get_tool_details** - Get detailed information about a tool
  - Required: `tool_id` (e.g., "cursor", "github-copilot")

- **get_tool_metrics** - Get current metrics for a tool
  - Required: `tool_id`

- **search_tools** - Search tools by name or description
  - Required: `query` string

- **get_tool_categories** - List all categories with tool counts

### Write Tools (Database Modification)

- **add_metric** - Add a new metric value for a tool
  - Required: `tool_id`, `metric_key`, `value`, `source`
  - Optional: `source_url`, `notes`
  - Automatically determines correct value type (integer/decimal/boolean/json)

- **update_tool_info** - Update tool information
  - Required: `tool_id`, `updates` object
  - Can update: description, tagline, status, website_url, github_repo

- **add_tool** - Add a new AI coding tool
  - Required: `id`, `name`, `company_name`, `category`, `description`
  - Optional: `website_url`, `pricing_model`
  - Automatically creates company if needed

- **bulk_add_metrics** - Add multiple metrics at once
  - Required: `metrics` array
  - Each metric needs: tool_id, metric_key, value, source

- **delete_metric** - Delete a specific metric entry
  - Required: `metric_id`

## Usage Examples

### Using Resources

Ask Claude to:
- "Show me the current rankings resource"
- "Get the tools directory resource"
- "What metrics are used for rankings?"
- "List all tool categories"

### Using Prompts

Ask Claude to:
- "Use the analyze-rankings prompt for code editors"
- "Use the compare-tools prompt for cursor and github-copilot"
- "Use the track-metrics prompt for windsurf"
- "Use the add-new-tool prompt for a new AI assistant"

### Direct Tool Usage

Ask Claude:

### Read Examples
- "What are the current top 5 AI coding tools?"
- "Show me details about Cursor"
- "Search for open-source AI coding tools"
- "What categories of AI coding tools are available?"
- "Get the metrics for GitHub Copilot"

### Write Examples
- "Add a metric for Cursor: set monthly_arr to 600 million, source is TechCrunch"
- "Update the description for GitHub Copilot to mention multi-model support"
- "Add a new tool: SuperCoder AI by CodeCraft Inc in the autonomous-agent category"
- "Add these metrics for Claude Code: swe_bench_score=75.2, monthly_arr=10000000, source: Anthropic Blog"
- "Change Windsurf's status to acquired"

## Troubleshooting

### MCP Server Won't Start

1. Check environment variables in `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

2. Ensure you've run `npm run mcp:setup`

### Claude Can't Connect

1. Make sure the MCP server is running (`npm run mcp:dev`)
2. Check the path in Claude config is absolute, not relative
3. Restart Claude Desktop completely after config changes
4. Check Claude's developer console for error messages

### ngrok Issues

1. Ensure ngrok is authenticated with your token
2. Check that port 3001 is not already in use
3. Make sure you're using the TCP URL from ngrok, not HTTP

## Security Notes

⚠️ **IMPORTANT SECURITY WARNING** ⚠️

- This MCP server has **FULL READ/WRITE ACCESS** to your database
- It uses the Supabase service role key which bypasses all Row Level Security
- **Only use this for local development with trusted AI assistants**
- Never commit your `.env.local` file
- ngrok URLs are temporary and change each session
- In production, consider:
  - Implementing separate read-only and write credentials
  - Adding audit logging for all write operations
  - Rate limiting write operations
  - Validating all inputs before database operations

## Development

To modify the MCP server:

1. Edit `mcp-server/src/index.ts`
2. Rebuild: `npm run mcp:build`
3. Restart the server: `npm run mcp:dev`

The server automatically loads environment variables from the parent `.env.local` file.