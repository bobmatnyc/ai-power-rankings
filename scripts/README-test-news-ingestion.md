# Real News Ingestion Test Script

A comprehensive test script for validating the AI Power Ranking news article ingestion and analysis pipeline using real-world content about agentic AI and UI tools.

## Features

### 1. Real Article Testing
- Tests with actual news articles about major AI tools and platforms
- Includes articles about:
  - Anthropic Claude Computer Use
  - OpenAI GPT-5 and ChatGPT Canvas
  - Salesforce Agentforce
  - Microsoft Copilot Studio
  - Google Gemini 2.0
  - GitHub Copilot Workspace
  - Cursor, Windsurf, and other AI IDEs

### 2. Tool Detection & Normalization
- Automatically detects AI tools mentioned in articles
- Normalizes tool names to match database entries
- Maps variations (e.g., "gpt-4" → "ChatGPT Canvas")
- Tracks context and sentiment for each mention

### 3. Comprehensive Analysis
Each article is analyzed for:
- **Tools Mentioned**: All AI tools and platforms detected
- **Sentiment Analysis**: Overall, innovation, and adoption scores
- **Impact Scoring**: Importance rating from 0-10
- **Ranking Predictions**: Winners, losers, and emerging tools
- **Category Classification**: code-generation, development-tools, etc.

### 4. Comparative Analytics
After processing all articles, provides:
- Articles ranked by impact score
- Most frequently mentioned tools
- Average sentiment per tool
- Category distribution
- Overall market sentiment

## Usage

### Basic Usage
```bash
npx tsx scripts/test-real-news-ingestion.ts
```

### Quick Mode (Test 3 Articles)
```bash
npx tsx scripts/test-real-news-ingestion.ts --quick
```

### With OpenRouter API
For full AI-powered analysis, set your OpenRouter API key:
```bash
# In .env.local
OPENROUTER_API_KEY=your-api-key-here

# Then run
npx tsx scripts/test-real-news-ingestion.ts
```

## Output Format

### Per-Article Output
```
Article #1: Anthropic's Claude 3.5 Sonnet Can Now Use Computers
======================================================================
  📰 URL: https://anthropic.com/claude-computer-use
  📍 Source: Anthropic Blog
  📅 Date: 2025-01-01

  🛠️  Tools Detected (8):
     ✅ Claude → Claude 3.5 Sonnet
        Context: Primary tool discussed...
        Sentiment: 0.80 | Relevance: 0.90
     ✅ ChatGPT → ChatGPT Canvas
        Context: Competitor mentioned...
        Sentiment: 0.60 | Relevance: 0.70

  😊 Sentiment Analysis:
     Overall: positive
     Innovation Score: 9.0/10
     Adoption Score: 7.5/10

  📊 Impact Score:
     Importance: 8.5/10
     Total Impact: 7.25

  📈 Ranking Changes:
     Winners: Claude 3.5 Sonnet
     Losers: GPT-4
     Emerging: Computer Use APIs
```

### Comparative Analysis
```
🏆 Articles by Impact Score:
  🥇 OpenAI GPT-5 Launch - Impact: 8.5
  🥈 Claude Computer Use - Impact: 7.25
  🥉 Salesforce Agentforce - Impact: 6.80

🔧 Most Mentioned Tools:
  📈 ChatGPT Canvas: 5 mentions (sentiment: 0.75)
  📈 GitHub Copilot: 4 mentions (sentiment: 0.68)
  📈 Claude 3.5: 3 mentions (sentiment: 0.82)

😊 Overall Market Sentiment:
  Positive: 8 articles
  Negative: 1 article
  Neutral: 2 articles
```

## Mock Content Fallback

The script includes realistic mock articles for testing when:
- Real URLs are inaccessible (403/404 errors)
- Testing without internet connection
- Rapid prototyping and development

Mock articles simulate real news about:
- Claude computer use capabilities
- GPT-5 code generation features
- Salesforce Agentforce enterprise adoption
- GitHub Copilot Workspace collaboration
- Google Gemini 2.0 multimodal features

## Tool Normalization Map

The script automatically normalizes tool name variations:
- `gpt-4`, `gpt-4-turbo`, `chatgpt` → `ChatGPT Canvas`
- `claude`, `claude-3` → `Claude 3.5 Sonnet`
- `copilot` → `GitHub Copilot`
- `gemini` → `Google Gemini`
- `agentforce` → `Salesforce Agentforce Builder`

## Error Handling

The script gracefully handles:
- HTTP errors (403, 404, timeouts)
- Missing API keys (falls back to mock analysis)
- Rate limiting (automatic delays between requests)
- Invalid content (skips malformed articles)

## Integration with Article Ingestion Service

This test script validates the full pipeline:
1. Content extraction (URL fetching or mock content)
2. AI analysis (OpenRouter API or mock analysis)
3. Tool detection and normalization
4. Sentiment and impact scoring
5. Ranking impact predictions

## Requirements

- Node.js 18+
- TypeScript
- Dependencies: `chalk`, `zod`, `dotenv`
- Optional: OpenRouter API key for full AI analysis

## Tips

1. **Start with Quick Mode**: Test with 3 articles first
2. **Use Mock Content**: Works without API keys for testing
3. **Monitor Rate Limits**: Script adds delays automatically
4. **Check Tool Mapping**: Verify tool names normalize correctly
5. **Review Impact Scores**: Validate scoring logic with real content

## Sample Articles Tested

1. **Anthropic Claude Computer Use** - Agent platform capabilities
2. **OpenAI GPT-5** - Advanced code generation
3. **Salesforce Agentforce** - Enterprise AI automation
4. **GitHub Copilot Workspace** - Collaborative AI coding
5. **Google Gemini 2.0** - Multimodal AI model
6. **Cursor IDE Funding** - AI IDE market growth
7. **Windsurf by Codeium** - Agentic IDE features
8. **Replit Agent** - Full application generation
9. **Amazon Q Developer** - Enterprise development AI
10. **Microsoft Copilot Studio** - Custom AI agents

## Future Enhancements

- [ ] Add more news sources (TechCrunch, VentureBeat, The Verge)
- [ ] Support RSS feed ingestion
- [ ] Batch processing with progress bars
- [ ] Export results to CSV/JSON
- [ ] Historical comparison tracking
- [ ] Automated daily/weekly runs
- [ ] Integration with ranking update system