# Article Ingestion Test Scripts

These scripts demonstrate and test the complete article ingestion workflow using a real AI news article from `~/Downloads/ai-news-upates.md`.

## Available Scripts

### 1. test-article-standalone.ts
**Zero Dependencies** - Pure TypeScript analysis without any database or API requirements.

```bash
# Run the analysis
npx tsx scripts/test-article-standalone.ts

# With verbose output
npx tsx scripts/test-article-standalone.ts --verbose

# Show help
npx tsx scripts/test-article-standalone.ts --help
```

**Features:**
- ✅ No environment variables needed
- ✅ No database connection required
- ✅ Works immediately without setup
- ✅ Full tool detection and normalization
- ✅ Sentiment and trend analysis
- ✅ Ranking impact simulation
- ✅ Beautiful colored terminal output

### 2. test-article-simple.ts
**No API Key Required** - Uses mock AI analysis with Supabase integration.

```bash
# Show help
npx tsx scripts/test-article-simple.ts --help

# Dry run (default)
npx tsx scripts/test-article-simple.ts

# With verbose output
npx tsx scripts/test-article-simple.ts --verbose

# Commit to database (requires Supabase config)
npx tsx scripts/test-article-simple.ts --commit
```

**Features:**
- ✅ Tool detection and normalization (GPT-5 → OpenAI GPT-5)
- ✅ Category scoring based on content
- ✅ Sentiment analysis
- ✅ Funding information extraction
- ✅ Database simulation in dry-run mode
- ✅ No external API calls needed

### 3. test-with-real-article.ts
**Full API Integration** - Tests the complete workflow with real API endpoints.

```bash
# Show help
npx tsx scripts/test-with-real-article.ts --help

# Dry run (default)
npx tsx scripts/test-with-real-article.ts

# Commit to database
npx tsx scripts/test-with-real-article.ts --commit

# Commit and test rollback
npx tsx scripts/test-with-real-article.ts --commit --rollback
```

**Features:**
- 🔄 Tests `/api/news/analyze` endpoint
- 🔄 Tests `/api/news/ingest` endpoint
- 🔄 Tests `/api/news/rollback` endpoint
- 📊 Shows ranking impacts for mentioned tools
- 💰 Displays API cost comparison
- ✅ Supports both full AI and preprocessed modes

## Article Content

The test article (`~/Downloads/ai-news-upates.md`) contains mentions of:
- **OpenAI GPT-5** - New multi-step code generation
- **Warp Code** - Transparent agent coding
- **Cursor/Anysphere** - Popular AI code editor
- **GitHub Copilot** - AI pair programmer
- **Salesforce Agentforce** - Enterprise agent platform
- **Mercor** - $10B+ valuation AI startup
- **Greptile** - AI code review ($30M Series A)
- **CodeRabbit** - Code review automation

## Environment Requirements

### For test-article-simple.ts
- Node.js with npx/tsx
- No API keys required (uses mock analysis)

### For test-with-real-article.ts
Create `.env.local` with:
```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key
OPENROUTER_API_KEY=your-api-key  # Optional, for full AI analysis
```

## Tool Normalization Examples

The scripts demonstrate how tool names are normalized:
- "GPT-5" → "OpenAI GPT-5"
- "Copilot" → "GitHub Copilot"
- "Agentforce" → "Salesforce Agentforce Builder"
- "Anysphere" → "Cursor" (company to product)

## Workflow Demonstration

1. **Article Reading**: Loads real content from markdown file
2. **AI Analysis**: Either mock (simple) or real API (comprehensive)
3. **Tool Detection**: Identifies and normalizes tool mentions
4. **Impact Calculation**: Shows ranking changes per tool
5. **Database Operations**: Simulates or executes ingestion
6. **Rollback Testing**: Demonstrates undo capability

## Cost Analysis

The scripts show API cost comparisons:
- **Full AI Analysis**: ~$0.000018 per article (6KB)
- **Preprocessed Mode**: $0.00 (no API calls)
- **Savings**: 100% when using preprocessed analysis

## Testing Scenarios

### Quick Test (Zero Setup)
```bash
# Immediate test with no configuration needed
npx tsx scripts/test-article-standalone.ts
```

### Mock API Test (Requires Supabase Config)
```bash
# Test with mock AI analysis
npx tsx scripts/test-article-simple.ts
```

### Full Integration Test
```bash
# Requires .env.local configuration
npx tsx scripts/test-with-real-article.ts --commit
```

### Rollback Test
```bash
npx tsx scripts/test-with-real-article.ts --commit --rollback
```

## Output Examples

### Tool Detection Output
```
🛠️  Tools Detected & Normalized:
  GPT-5 → OpenAI GPT-5
  Warp Code = Warp Code
  Cursor = Cursor
  GitHub Copilot = GitHub Copilot
```

### Ranking Impact Output
```
📈 Ranking Impacts:
  📍 OpenAI GPT-5
     Category: code-generation
     Current Rank: #2
     Sentiment: 0.8
     Impact Score: +8.5
```

### Category Scoring
```
📁 Category Scores:
  code-generation      ████████░░ 8/10
  code-review         ███████░░░ 7/10
  development-tools   ████████░░ 8/10
```

## Recommended Testing Order

1. **Start with Standalone** - No setup required
   ```bash
   npx tsx scripts/test-article-standalone.ts
   ```
   This validates that the article can be read and analyzed without any dependencies.

2. **Test with Mock Analysis** - Requires Supabase config
   ```bash
   npx tsx scripts/test-article-simple.ts
   ```
   This tests database integration with mock AI responses.

3. **Full Integration Test** - Requires API keys
   ```bash
   npx tsx scripts/test-with-real-article.ts --commit
   ```
   This tests the complete workflow with real AI and database operations.

## Troubleshooting

### Missing Environment Variables
```
❌ Missing Supabase environment variables
💡 This script requires Supabase configuration in .env.local
```
**Solution**: Create `.env.local` with required variables or use `test-article-simple.ts` for mock testing.

### Article Not Found
```
❌ Failed to read article: Error: ENOENT
```
**Solution**: Ensure `~/Downloads/ai-news-upates.md` exists with the test article content.

### API Connection Failed
```
❌ API Error: fetch failed
```
**Solution**: Ensure the development server is running (`npm run dev`) on port 3000.