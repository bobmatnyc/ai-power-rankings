# OpenRouter API Setup Guide

## Overview

The AI Power Rankings admin panel uses OpenRouter API for intelligent news article analysis. This guide explains how to set up and configure OpenRouter for the news analysis feature.

## Prerequisites

1. An OpenRouter account
2. API credits in your OpenRouter account
3. Access to your environment variables

## Setup Instructions

### Step 1: Get Your OpenRouter API Key

1. Visit [OpenRouter](https://openrouter.ai/)
2. Sign up or log in to your account
3. Navigate to the API Keys section
4. Create a new API key or copy an existing one
5. Your key should start with `sk-or-v1-`

### Step 2: Configure Environment Variables

Add the following to your `.env.local` file:

```bash
# OpenRouter API Configuration
OPENROUTER_API_KEY=sk-or-v1-your-actual-key-here
```

**Important:** Never commit your API key to version control!

### Step 3: Verify Your Setup

Run the test script to verify your configuration:

```bash
node scripts/test-openrouter.js
```

You should see:
- ✅ OPENROUTER_API_KEY found
- ✅ API call successful!

## Troubleshooting

### Error: "User not found" (401)

**Cause:** Invalid or expired API key

**Solution:**
1. Verify your API key is correct and starts with `sk-or-v1-`
2. Check that the key hasn't expired
3. Generate a new key if needed

### Error: "Insufficient credits" (402)

**Cause:** No credits in your OpenRouter account

**Solution:**
1. Log into OpenRouter
2. Add credits to your account
3. Check your usage and limits

### Error: "Rate limit exceeded" (429)

**Cause:** Too many requests in a short time

**Solution:**
1. Wait a few minutes before retrying
2. Consider upgrading your OpenRouter plan
3. Implement request queuing in production

### Error: "Network error"

**Cause:** Connection issues to OpenRouter API

**Solution:**
1. Check your internet connection
2. Verify OpenRouter API status
3. Check if your firewall/proxy allows HTTPS connections to openrouter.ai

## Fallback Mechanism

If OpenRouter is unavailable, the system automatically uses a fallback analysis method that:

- Extracts tool mentions using pattern matching
- Generates basic summaries
- Identifies key topics through word frequency
- Provides neutral sentiment scores

While less sophisticated than AI analysis, this ensures the admin panel remains functional even when the API is unavailable.

## API Usage & Costs

### Model Used

The system uses `anthropic/claude-3-haiku` for analysis, which offers:
- Fast response times
- Good accuracy for structured extraction
- Cost-effective pricing

### Typical Usage

- Each news analysis consumes approximately 1,000-2,000 tokens
- Cost per analysis: ~$0.001-0.002
- Monthly estimate (100 articles): ~$0.10-0.20

### Monitoring Usage

Check your usage at: https://openrouter.ai/dashboard

## Security Best Practices

1. **Never expose your API key in client-side code**
2. **Use environment variables for all sensitive data**
3. **Rotate API keys regularly**
4. **Set spending limits in your OpenRouter account**
5. **Monitor usage for unusual activity**

## Testing the Integration

### Manual Test

1. Start the development server:
   ```bash
   pnpm run dev:pm2 start
   ```

2. Navigate to the admin panel:
   ```
   http://localhost:3000/admin
   ```

3. Go to the News Management section

4. Try analyzing a news article:
   - Enter a URL or paste text
   - Click "Analyze"
   - Verify the analysis results

### Automated Test

Use the provided test script:

```bash
# Test OpenRouter API directly
node scripts/test-openrouter.js

# Test the full news analysis endpoint (requires dev server running)
node scripts/test-news-analyze.js
```

## Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `OPENROUTER_API_KEY` | Your OpenRouter API key | `sk-or-v1-abc123...` |
| `NEXT_PUBLIC_BASE_URL` | Your application URL (for API referrer) | `https://aipowerrankings.com` |

## Support

For OpenRouter-specific issues:
- Documentation: https://openrouter.ai/docs
- Support: support@openrouter.ai

For application-specific issues:
- Check the logs: `pnpm run dev:pm2 logs`
- Review error messages in the browser console
- Check the fallback analysis is working as expected