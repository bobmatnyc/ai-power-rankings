#!/bin/bash

# Quick test of news analysis endpoint with fallback

echo "Testing News Analysis API with fallback mechanism..."
echo ""

# Test with text input (should use fallback if OpenRouter fails)
curl -X POST http://localhost:3000/api/admin/news/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "type": "text",
    "input": "OpenAI has released GPT-4 Turbo, their latest language model with improved performance and reduced costs. The new model features a 128K context window and better instruction following. Microsoft and Google are also advancing their AI offerings with Copilot and Gemini respectively. This represents a major advancement in artificial intelligence technology."
  }' \
  2>/dev/null | python3 -m json.tool

echo ""
echo "Test completed. Check if fallback warning is present if OpenRouter API key is invalid."