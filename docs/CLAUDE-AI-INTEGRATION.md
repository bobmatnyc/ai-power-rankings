# Claude.ai Integration Guide

This guide explains how to integrate the AI Power Rankings API with Claude.ai.

## Quick Start (Development Mode)

1. **Add to environment variables** (`.env.local` or Vercel):
   ```
   ENABLE_DEV_MODE=true
   ```

2. **Deploy to Vercel or run locally**:
   ```bash
   npm run dev
   ```

3. **Enter the URL in Claude.ai**:
   - Local: `http://localhost:3000/api/mcp`
   - Production: `https://your-domain.vercel.app/api/mcp`
   - Custom domain: `https://1mbot.ngrok.app/api/mcp`

## How It Works

### Development Mode (No Auth)
When `ENABLE_DEV_MODE=true`, the API accepts all requests without authentication. This is the easiest way to get started.

### Production Mode (OAuth 2.0)
In production, the API implements OAuth 2.0:

1. Claude.ai discovers OAuth endpoints via `/.well-known/oauth-authorization-server`
2. Claude.ai redirects to `/api/mcp/oauth/authorize`
3. User approves access (auto-approved in current implementation)
4. Claude.ai receives tokens from `/api/mcp/oauth/token`
5. Claude.ai uses the access token for API requests

## API Endpoints

All endpoints are under `/api/mcp/`:

### Public Endpoints
- `GET /api/mcp` - API info and OAuth discovery
- `GET /api/mcp/rankings` - Get current rankings
- `GET /api/mcp/tools/[id]` - Get tool details
- `GET /api/mcp/metrics/[tool_id]` - Get tool metrics
- `POST /api/mcp/search` - Search tools
- `GET /api/mcp/categories` - Get categories

### Protected Endpoints (Write Operations)
- `POST /api/mcp/metrics` - Add a metric
- `PUT /api/mcp/tools/[id]` - Update tool info
- `POST /api/mcp/tools` - Add new tool

## Testing with Claude.ai

1. **Open Claude.ai**
2. **Go to integrations/connections**
3. **Add new integration**
4. **Enter your API URL**: `https://your-domain/api/mcp`
5. **Claude.ai will**:
   - In dev mode: Connect immediately
   - In production: Show OAuth login flow

## Environment Variables

```env
# Required
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_key

# Optional
ENABLE_DEV_MODE=true  # Skip OAuth in development
NEXT_PUBLIC_BASE_URL=https://your-domain.com  # For OAuth redirects
```

## Troubleshooting

### "Make sure your server handles auth correctly"
- Set `ENABLE_DEV_MODE=true` for development
- Ensure CORS headers are present (handled by middleware)
- Check that all `/api/mcp/*` routes are accessible

### OAuth Flow Issues
- Verify `NEXT_PUBLIC_BASE_URL` is set correctly
- Check OAuth endpoints are accessible
- Look for errors in Vercel logs

## Security Notes

⚠️ **Development Mode Warning**: 
- Only use `ENABLE_DEV_MODE=true` for testing
- In production, remove this variable to enable OAuth
- The service role key provides full database access

## Next Steps

1. Test with development mode first
2. Deploy to Vercel
3. Add proper authentication UI for production
4. Implement user consent flow
5. Add rate limiting and monitoring