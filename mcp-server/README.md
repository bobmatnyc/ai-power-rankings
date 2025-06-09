# AI Power Rankings MCP Server

This MCP (Model Context Protocol) server provides direct access to the AI Power Rankings database for AI assistants like Claude.

## Features

The MCP server provides three types of features:

### Resources (Quick Data Access)
- `rankings://current` - Current rankings snapshot with all scores
- `tools://directory` - Complete tools directory organized by category
- `metrics://definitions` - Detailed metric definitions and weights
- `categories://list` - Tool categories with descriptions and counts

### Prompts (Guided Interactions)
- `analyze-rankings` - Analyze current AI tool rankings and trends
- `compare-tools` - Compare multiple AI coding tools side-by-side
- `track-metrics` - Track and update metrics for a specific tool
- `add-new-tool` - Add a new AI coding tool with guided setup

### Tools (Direct API Access)

#### Query Tools (Read Access)
- `get_current_rankings` - Get current AI tool rankings with optional category filter
- `get_tool_details` - Get detailed information about a specific tool
- `get_tool_metrics` - Get current metrics for a specific tool
- `get_metrics_history` - Get historical metrics with time range
- `search_tools` - Search tools by name or description
- `get_tool_categories` - List all categories with tool counts
- `compare_tools` - Compare metrics between multiple tools
- `get_trending_metrics` - Find tools with significant metric changes

### Write Tools (Write Access)
- `add_metric` - Add a new metric value for a tool
- `update_tool_info` - Update tool information (description, status, etc)
- `add_tool` - Add a new AI coding tool to the database
- `bulk_add_metrics` - Add multiple metrics at once
- `delete_metric` - Delete a specific metric entry


## Local Development Setup

### Prerequisites

1. Install dependencies from the MCP server directory:
   ```bash
   cd mcp-server
   npm install
   ```

2. Install ngrok (for remote access):
   ```bash
   # macOS
   brew install ngrok
   
   # Or download from https://ngrok.com
   ```

3. Set up ngrok authentication:
   ```bash
   ngrok config add-authtoken YOUR_AUTH_TOKEN
   ```

### Running Locally

1. Build the TypeScript code:
   ```bash
   npm run build
   ```

2. Start the MCP server:
   ```bash
   npm run dev
   ```

3. In another terminal, start ngrok:
   ```bash
   ngrok tcp 3001
   ```

4. Note the ngrok forwarding URL (e.g., `tcp://0.tcp.ngrok.io:12345`)

### Configure Claude Desktop

Add to your Claude Desktop config (`~/.claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "ai-power-rankings": {
      "command": "node",
      "args": ["/path/to/ai-power-rankings/mcp-server/dist/index.js"],
      "env": {}
    }
  }
}
```

For ngrok access, use:

```json
{
  "mcpServers": {
    "ai-power-rankings": {
      "command": "ssh",
      "args": ["-t", "tcp://YOUR_NGROK_URL", "node /path/to/mcp-server/dist/index.js"],
      "env": {}
    }
  }
}
```

## Usage Examples

Once connected, you can use the MCP server in three ways:

### 1. Resources (Quick Access)
- "Show me the current rankings resource"
- "Get the tools directory"
- "What metrics are used in the rankings?"
- "List all tool categories"

### 2. Prompts (Guided Tasks)
- "Use the analyze-rankings prompt"
- "Use the compare-tools prompt for cursor, github-copilot, and claude-code"
- "Use the track-metrics prompt for windsurf"
- "Use the add-new-tool prompt"

### 3. Direct Tool Usage

#### Read Operations
- "What are the current top 5 AI coding tools?"
- "Show me details about Cursor"
- "Compare GitHub Copilot and Claude Code"
- "What tools have seen the biggest growth in monthly ARR?"
- "Search for open-source AI coding tools"
- "Show me the SWE-bench scores for autonomous agents"

### Write Operations
- "Add a new metric for Cursor: monthly_arr = 600000000 (source: TechCrunch)"
- "Update GitHub Copilot's description to include the latest features"
- "Add a new tool called 'CodeAssist Pro' in the ide-assistant category"
- "Add multiple metrics for Claude Code from the latest blog post"
- "Update Windsurf's status to 'acquired'"

## Security Notes

- **WARNING**: This MCP server has FULL READ/WRITE access to your database
- It uses the Supabase service role key which bypasses Row Level Security
- Only use this for local development with trusted AI assistants
- Do not expose your Supabase service role key in production
- ngrok URLs are temporary and will change each session
- Consider implementing audit logging for write operations in production

## Troubleshooting

1. **Server won't start**: Check that `.env.local` exists in the parent directory with:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

2. **Claude can't connect**: 
   - Ensure the MCP server is running
   - Check the path in Claude Desktop config is absolute
   - Restart Claude Desktop after config changes

3. **ngrok issues**:
   - Make sure you're authenticated with ngrok
   - Check that port 3001 is not in use
   - Use the TCP forwarding URL, not HTTP

## Development

To add new tools or modify functionality:

1. Edit `src/index.ts`
2. Add new tool definitions in `tools/list` handler
3. Implement handlers in `tools/call` switch statement
4. Rebuild: `npm run build`
5. Restart the server