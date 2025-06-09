# Claude.ai Web Gateway Setup

This guide explains how to expose the AI Power Rankings database to Claude.ai (web interface) using the HTTP gateway and ngrok.

## Security Features

- **Authentication**: Write operations require a Bearer token
- **Rate Limiting**: 100 requests/15min general, 10 writes/15min
- **CORS**: Enabled for all origins (Claude.ai)
- **Audit Logging**: All write operations are logged

## Quick Start

1. **Start the web gateway with ngrok:**
   ```bash
   npm run dev:ngrok
   ```

   This will:
   - Start the web gateway on port 3001
   - Start ngrok with your custom domain `1mbot.ngrok.app`
   - Generate an API key if you don't have one in .env.local

2. **Your API is now available at:** `https://1mbot.ngrok.app`

3. **Save your API key:**
   - Check the console output for your API key
   - Add it to `.env.local`: `MCP_API_KEY=your_generated_key`

## Available Endpoints

### Read Operations (No Auth Required)

- **Get Rankings**: `GET https://1mbot.ngrok.app/rankings?category=code-editor&limit=10`
- **Get Tool Details**: `GET https://1mbot.ngrok.app/tools/cursor`
- **Get Tool Metrics**: `GET https://1mbot.ngrok.app/metrics/cursor`
- **Search Tools**: `POST https://1mbot.ngrok.app/search` with body: `{"query": "open source"}`
- **Get Categories**: `GET https://1mbot.ngrok.app/categories`

### Write Operations (Requires Authentication)

- **Add Metric**: `POST https://1mbot.ngrok.app/metrics`
  
  Headers:
  ```
  Authorization: Bearer YOUR_API_KEY
  Content-Type: application/json
  ```
  
  Body:
  ```json
  {
    "tool_id": "cursor",
    "metric_key": "monthly_arr",
    "value": 600000000,
    "source": "TechCrunch"
  }
  ```

- **Update Tool**: `PUT https://1mbot.ngrok.app/tools/cursor`
  ```json
  {
    "description": "Updated description",
    "status": "active"
  }
  ```

- **Add Tool**: `POST https://1mbot.ngrok.app/tools`
  ```json
  {
    "id": "new-tool",
    "name": "New AI Tool",
    "company_name": "AI Company",
    "category": "autonomous-agent",
    "description": "An amazing new AI coding tool"
  }
  ```

## How to Use with Claude.ai

When chatting with Claude.ai, you can ask it to:

1. **Fetch current rankings:**
   "Can you get the current AI tool rankings from https://1mbot.ngrok.app/rankings"

2. **Search for tools:**
   "Search for open source AI coding tools at https://1mbot.ngrok.app/search"

3. **Get tool details:**
   "Get details about Cursor from https://1mbot.ngrok.app/tools/cursor"

4. **Add metrics:**
   "Add a new ARR metric for Cursor at https://1mbot.ngrok.app/metrics"

## Security Notes

⚠️ **WARNING**: This gateway provides FULL READ/WRITE access to your database!
- Only use for development/testing
- The ngrok URL is public - anyone with the URL can access it
- Consider adding authentication for production use
- All write operations are logged with `[AUDIT]` prefix

## Troubleshooting

1. **Port already in use**: Kill any process using port 3001
2. **ngrok not authenticated**: Run `ngrok config add-authtoken YOUR_TOKEN`
3. **CORS errors**: The gateway includes CORS headers for all origins

## Alternative: Manual Setup

If you prefer to run components separately:

1. Start web gateway: `npm run dev:web`
2. In another terminal: `ngrok http 3001 --domain=1mbot.ngrok.app`