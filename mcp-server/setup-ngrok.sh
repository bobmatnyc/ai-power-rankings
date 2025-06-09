#!/bin/bash

echo "🚀 Setting up ngrok for AI Power Rankings MCP Server"
echo ""
echo "Prerequisites:"
echo "1. Install ngrok: brew install ngrok (macOS) or download from https://ngrok.com"
echo "2. Create ngrok account and get auth token"
echo "3. Run: ngrok config add-authtoken YOUR_AUTH_TOKEN"
echo ""
echo "To start the MCP server with ngrok:"
echo "1. In terminal 1: cd mcp-server && npm run dev"
echo "2. In terminal 2: ngrok tcp 3001"
echo ""
echo "The ngrok URL will be displayed. Use it in your Claude Desktop config."
echo ""
echo "Example Claude Desktop config (~/.claude/claude_desktop_config.json):"
echo '{'
echo '  "mcpServers": {'
echo '    "ai-power-rankings": {'
echo '      "command": "ssh",'
echo '      "args": ["-t", "YOUR_NGROK_URL", "ai-power-rankings-mcp"],'
echo '      "env": {}'
echo '    }'
echo '  }'
echo '}'