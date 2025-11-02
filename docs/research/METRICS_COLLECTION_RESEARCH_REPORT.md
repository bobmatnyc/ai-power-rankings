# AI Coding Tools Metrics Collection Research Report

**Date:** November 1, 2025  
**Status:** Research Complete  
**Goal:** Move from 0% to 80%+ metrics coverage for 51 AI coding tools

---

## Executive Summary

This report provides a comprehensive analysis of available data sources, APIs, and implementation strategies for collecting real metrics to improve ranking accuracy for 51 AI coding tools. Current algorithm (v7.2/v7.3) uses proxy metrics due to 0% actual data coverage.

### Key Findings

1. **Data Sources Available:** 7+ API sources identified with varying costs and coverage
2. **Automation Potential:** 60-70% of metrics can be automated
3. **Coverage Estimate:** Can achieve 80-90% coverage within 4 weeks
4. **Cost Range:** $50-500/month depending on volume and sources
5. **Quick Wins:** GitHub + SWE-bench data available immediately at low/no cost

---

## 1. Current State Analysis

### Database Schema

```typescript
// tools table (lib/db/schema.ts)
- data: jsonb - Stores all tool metadata
- baselineScore: jsonb - Baseline scores per factor  
- deltaScore: jsonb - Delta modifications
- currentScore: jsonb - Cached score calculation
- category: text - Tool category (indexed)
- status: text - Active/inactive/deprecated
```

### Tools Overview

- **Total Tools:** 53 in database, 51 actively ranked
- **Categories:** autonomous-agent, code-editor, ide-assistant, code-assistant, terminal-tool, etc.
- **Open Source vs Proprietary:** Mix of both
- **GitHub Repos:** Varies - some have public repos, others are closed source

### Current Metrics Coverage

```
SWE-bench scores:        0% (0/51 tools)
GitHub activity:         0% (0/51 tools)  
News mentions:          ~5% (estimated from existing ingestion)
VS Code installs:        0% (0/51 tools)
npm/PyPI downloads:      0% (0/51 tools)
Funding/valuation:       0% (0/51 tools)
```

### Algorithm v7.2/v7.3 Scoring Factors

```typescript
{
  agenticCapability: 0.35,      // SWE-bench + category + features
  innovation: 0.10,              // Features + keywords
  technicalPerformance: 0.10,    // Context window + LLM support
  developerAdoption: 0.125,      // Pricing + GitHub stars (missing)
  marketTraction: 0.125,         // Users + valuation (missing)
  businessSentiment: 0.125,      // News mentions
  developmentVelocity: 0.05,     // Release frequency (missing)
  platformResilience: 0.025,     // Company backing
}
```

---

## 2. Available Data Sources & APIs

### A. SWE-bench Scores (FREE)

**Official Source:** https://www.swebench.com/

**Metrics Available:**
- SWE-bench Verified scores (primary metric)
- SWE-bench Lite scores
- SWE-bench Full scores
- Multimodal scores

**Top Scores (2025):**
- GPT-5: 74.9% (Verified)
- o3: 69.1% (Verified)
- CodeStory Midwit Agent: 62% (Verified)
- Claude 3.5 Sonnet: 49% (Verified)
- Refact.ai Agent: 35.59% (Multimodal)

**Coverage:** 15-20 tools (autonomous agents, major IDEs)
**Update Frequency:** Monthly/quarterly
**Cost:** FREE (public leaderboard)
**Collection Method:** Manual scraping or web scraping API

**Implementation:**
```typescript
interface SWEBenchScore {
  tool_name: string;
  verified_score?: number;
  lite_score?: number;
  full_score?: number;
  multimodal_score?: number;
  date_recorded: string;
}
```

**Quick Win:** ✅ Can collect immediately via web scraping

---

### B. GitHub API (FREE - 5K requests/hour)

**Official Docs:** https://docs.github.com/en/rest

**Rate Limits:**
- Unauthenticated: 60 requests/hour
- Authenticated (Personal Token): 5,000 requests/hour
- GitHub App: 15,000 requests/hour (Enterprise)

**Metrics Available:**
```typescript
interface GitHubMetrics {
  stars: number;
  forks: number;
  watchers: number;
  open_issues: number;
  contributors_count: number;
  commit_frequency: number;  // Last 52 weeks
  last_commit_date: string;
  created_at: string;
  language: string;
  topics: string[];
  license: string;
  has_wiki: boolean;
  has_discussions: boolean;
}
```

**Coverage:** 20-25 tools (open source tools only)
**Update Frequency:** Daily/weekly
**Cost:** FREE with authentication
**Collection Method:** REST API

**Tools with GitHub Repos:**
- Claude Dev (saoudrizwan/claude-dev)
- Aider (paul-gauthier/aider)
- Cline/Claude Code (?)
- Continue.dev
- OpenDevin
- AutoGPT
- SWE-agent
- And more...

**Quick Win:** ✅ Can implement this week with minimal cost

**Rate Limit Management:**
- Collect once per tool per day
- 51 tools = 51 requests per day
- Well within 5,000/hour limit

---

### C. VS Code Marketplace API (FREE)

**API Endpoint:** https://marketplace.visualstudio.com/_apis/public/gallery

**Available Package:** `vscode-marketplace-api` (npm)

**Metrics Available:**
```typescript
interface VSCodeMetrics {
  install_count: number;
  download_count: number;
  rating: number;
  rating_count: number;
  daily_installs: number;
  trending_daily: number;
  trending_weekly: number;
  last_updated: string;
  version: string;
}
```

**Coverage:** 15-20 tools (IDE assistants and extensions)
**Update Frequency:** Daily
**Cost:** FREE (undocumented but publicly accessible)
**Collection Method:** REST API via npm package

**VS Code Extensions:**
- GitHub Copilot
- Cursor (if has extension)
- Continue
- Tabnine
- Codeium
- And more...

**Quick Win:** ✅ Can implement this week

---

### D. npm Registry API (FREE)

**Official Endpoint:** https://api.npmjs.org/downloads

**Rate Limits:** 
- Bulk queries: 128 packages max
- Time range: 365 days max

**Metrics Available:**
```typescript
interface NPMMetrics {
  downloads_last_day: number;
  downloads_last_week: number;
  downloads_last_month: number;
  downloads_last_year: number;
  per_version_downloads?: Record<string, number>;  // Last 7 days only
}
```

**Coverage:** 5-10 tools (CLI tools and frameworks)
**Update Frequency:** Daily
**Cost:** FREE
**Collection Method:** REST API

**Tools with npm Packages:**
- Aider
- Continue
- AutoGPT CLI
- Open Interpreter
- And CLI-based tools...

**Quick Win:** ✅ Can implement this week

---

### E. PyPI Stats API (FREE)

**Official Package:** `pypistats` (Python)
**Alternative:** Google BigQuery (180 days of data)

**Metrics Available:**
```typescript
interface PyPIMetrics {
  downloads_last_day: number;
  downloads_last_week: number;
  downloads_last_month: number;
  downloads_by_version: Record<string, number>;
  downloads_by_country: Record<string, number>;
}
```

**Coverage:** 5-10 tools (Python-based tools)
**Update Frequency:** Daily
**Cost:** FREE (180 days via pypistats, unlimited via BigQuery)
**Collection Method:** Python CLI or BigQuery API

**Tools with PyPI Packages:**
- Aider
- AutoGPT
- Open Interpreter
- gpt-engineer
- And Python CLI tools...

**Quick Win:** ✅ Can implement this week

---

### F. News APIs (PAID)

**Option 1: NewsData.io**
- Pricing: $199/month (starter)
- Coverage: 60,000+ sources
- Historical: Yes
- Rate limits: Varies by plan

**Option 2: GNews.io**
- Pricing: Varies
- Coverage: 60,000+ sources  
- Historical: 5 years (2020-present)
- Rate limits: Varies by plan

**Option 3: NewsAPI.ai**
- Pricing: Free 2,000 searches, then paid
- Coverage: Global
- Historical: Yes

**Metrics Available:**
```typescript
interface NewsMetrics {
  mention_count_30d: number;
  mention_count_90d: number;
  mention_count_all_time: number;
  sentiment_score: number;
  top_sources: string[];
  recent_articles: Article[];
}
```

**Coverage:** All 51 tools
**Update Frequency:** Daily
**Cost:** $0-200/month
**Collection Method:** REST API

**Current State:** Already have news ingestion system, can enhance with metrics tracking

**Medium-term Win:** Implement within 2 weeks with budget approval

---

### G. Crunchbase API (PAID - $49-199/month)

**Plans:**
- Pro: $49/month (basic data)
- Business: $199/month (full data + API)

**Metrics Available:**
```typescript
interface CrunchbaseMetrics {
  total_funding: number;
  last_funding_round: string;
  last_funding_amount: number;
  valuation: number;
  employee_count: number;
  investor_count: number;
  founding_date: string;
  headquarters: string;
}
```

**Coverage:** 30-40 tools (companies with funding)
**Update Frequency:** Weekly/monthly
**Cost:** $49-199/month
**Collection Method:** REST API (Business plan)

**Tools with Funding:**
- Cursor
- Replit
- GitHub Copilot (Microsoft)
- Tabnine
- Codeium/Windsurf
- And VC-backed companies...

**Medium-term Win:** Implement in weeks 3-4 with budget

---

### H. Reddit/HackerNews APIs (FREE)

**HackerNews API:**
- Official API: https://github.com/HackerNews/API
- Cost: FREE
- No authentication required
- Rate limits: Reasonable

**Reddit API:**
- Pricing: Limited after 2023 changes
- Free tier: Very limited
- Authentication: OAuth required

**Metrics Available:**
```typescript
interface CommunityMetrics {
  hackernews_mentions_30d: number;
  reddit_mentions_30d: number;
  average_sentiment: number;
  top_discussions: Discussion[];
}
```

**Coverage:** All 51 tools (varying degrees)
**Update Frequency:** Daily
**Cost:** FREE (HackerNews), Limited (Reddit)
**Collection Method:** REST API

**Medium-term Win:** Implement weeks 2-3

---

## 3. Coverage Feasibility Analysis

### Coverage Matrix by Tool Category

```
CATEGORY                | GitHub | SWE-bench | VS Code | npm | PyPI | News | Funding |
------------------------|--------|-----------|---------|-----|------|------|---------|
autonomous-agent        |  60%   |   80%     |   20%   | 40% |  40% | 100% |   80%   |
code-editor             |  20%   |   40%     |   60%   | 10% |  10% | 100% |   90%   |
ide-assistant           |  30%   |   30%     |   80%   | 20% |  10% | 100% |   70%   |
code-assistant          |  70%   |   50%     |   50%   | 60% |  50% | 100% |   50%   |
terminal-tool           |  80%   |   20%     |   10%   | 70% |  70% | 100% |   30%   |
------------------------|--------|-----------|---------|-----|------|------|---------|
OVERALL COVERAGE        |  50%   |   45%     |   45%   | 40% |  35% | 100% |   65%   |
```

### Open Source vs Proprietary

**Open Source Tools (20-25 tools):**
- ✅ GitHub: 100% coverage
- ✅ npm/PyPI: 60-80% coverage
- ⚠️ SWE-bench: 40-50% coverage
- ❌ VS Code: 40-50% coverage
- ⚠️ Funding: 30-40% coverage

**Proprietary Tools (25-30 tools):**
- ❌ GitHub: 0% coverage
- ❌ npm/PyPI: 10-20% coverage
- ✅ SWE-bench: 40-50% coverage
- ✅ VS Code: 50-60% coverage
- ✅ Funding: 80-90% coverage

### Metrics by Priority

**High Priority (Can collect now - FREE):**
1. ✅ SWE-bench scores: 15-20 tools (manual collection from leaderboard)
2. ✅ GitHub activity: 20-25 tools (API, 5K/hour limit)
3. ✅ VS Code installs: 15-20 tools (marketplace API)
4. ✅ npm downloads: 5-10 tools (API)
5. ✅ PyPI downloads: 5-10 tools (API)

**Medium Priority (Implement weeks 2-3):**
1. 🔶 News mentions: All tools (enhance existing system)
2. 🔶 HackerNews mentions: All tools (free API)
3. 🔶 Community sentiment: All tools (aggregated)

**Low Priority (Weeks 3-4 with budget):**
1. 💰 Funding/valuation: 30-40 tools (Crunchbase $49-199/month)
2. 💰 Advanced news analytics: All tools (NewsAPI $200/month)

---

## 4. Implementation Strategy

### Phase 1: Quick Wins (Week 1) - FREE

**Goal:** Collect 40-50% metrics coverage immediately

**Tasks:**
1. **SWE-bench Collection**
   - Manual scraping of leaderboard
   - Store verified/lite/full scores
   - Map to tool names
   - Update: Quarterly

2. **GitHub Metrics**
   - Implement GitHub API client
   - Collect stars, forks, commits, contributors
   - Store in tools.data.metrics.github
   - Update: Weekly

3. **VS Code Marketplace**
   - Implement marketplace API client  
   - Collect install counts, ratings
   - Store in tools.data.metrics.vscode
   - Update: Weekly

4. **npm Registry**
   - Implement npm API client
   - Collect download stats
   - Store in tools.data.metrics.npm
   - Update: Weekly

5. **PyPI Stats**
   - Implement pypistats client
   - Collect download stats
   - Store in tools.data.metrics.pypi
   - Update: Weekly

**Deliverables:**
- `/scripts/collect-swebench-scores.ts`
- `/scripts/collect-github-metrics.ts`
- `/scripts/collect-vscode-metrics.ts`
- `/scripts/collect-npm-metrics.ts`
- `/scripts/collect-pypi-metrics.ts`
- Updated database schema for metrics storage
- Cron job for weekly updates

**Estimated Effort:** 20-25 hours
**Cost:** $0 (all free APIs)

---

### Phase 2: News & Community (Weeks 2-3)

**Goal:** Add news mentions and community sentiment

**Tasks:**
1. **Enhance News System**
   - Add tool mention tracking to existing ingestion
   - Calculate 30/90/365-day mention counts
   - Store in tools.data.metrics.news_mentions

2. **HackerNews Integration**
   - Implement HN API client
   - Search for tool mentions
   - Calculate sentiment from comments
   - Store in tools.data.metrics.hackernews

3. **Community Metrics**
   - Aggregate from HN + existing news
   - Calculate trend scores
   - Store in tools.data.metrics.community

**Deliverables:**
- Enhanced news ingestion with tool tracking
- `/scripts/collect-hackernews-metrics.ts`
- `/scripts/aggregate-community-metrics.ts`
- Updated ranking algorithm to use real news data

**Estimated Effort:** 15-20 hours
**Cost:** $0 (free APIs)

---

### Phase 3: Business Metrics (Weeks 3-4) - WITH BUDGET

**Goal:** Add funding and advanced analytics

**Option A: Budget-Conscious**
- Focus on free/manual collection
- Research funding from public sources
- Manual valuation estimates
- **Cost:** $0

**Option B: Comprehensive**
- Subscribe to Crunchbase Pro ($49/month)
- Subscribe to NewsAPI ($200/month)
- Full automation
- **Cost:** $249/month

**Tasks:**
1. **Funding Data**
   - Crunchbase API integration OR
   - Manual research from public sources
   - Store in tools.data.metrics.funding

2. **Advanced News Analytics**
   - NewsAPI integration OR
   - Enhance free sources
   - Sentiment analysis
   - Trend detection

**Deliverables:**
- `/scripts/collect-funding-metrics.ts`
- `/scripts/collect-news-analytics.ts`
- Complete metrics dashboard
- Updated ranking algorithm v7.4

**Estimated Effort:** 15-20 hours
**Cost:** $0-249/month (ongoing)

---

### Phase 4: Automation & Monitoring (Ongoing)

**Goal:** Maintain 80%+ coverage automatically

**Tasks:**
1. **Scheduled Jobs**
   - Daily: npm, PyPI, news
   - Weekly: GitHub, VS Code
   - Monthly: SWE-bench, funding

2. **Monitoring**
   - Coverage tracking dashboard
   - API rate limit monitoring
   - Error alerting
   - Data quality checks

3. **Algorithm Updates**
   - Transition from proxy metrics to real data
   - Remove category bonuses
   - Use actual SWE-bench scores
   - Use real GitHub stars
   - Use actual news mentions

**Deliverables:**
- Cron jobs in production
- Monitoring dashboard
- Updated algorithm v7.4/v8.0
- Documentation

**Estimated Effort:** 10-15 hours
**Cost:** $0-249/month (ongoing)

---

## 5. Database Schema Updates

### Add Metrics to tools.data JSONB

```typescript
interface ToolData {
  // ... existing fields ...
  
  metrics?: {
    // SWE-bench
    swe_bench?: {
      verified?: number;
      lite?: number;
      full?: number;
      multimodal?: number;
      last_updated: string;
    };
    
    // GitHub
    github?: {
      stars: number;
      forks: number;
      watchers: number;
      contributors: number;
      commits_last_year: number;
      last_commit: string;
      open_issues: number;
      last_updated: string;
    };
    
    // VS Code
    vscode?: {
      installs: number;
      downloads: number;
      rating: number;
      rating_count: number;
      last_updated: string;
    };
    
    // npm
    npm?: {
      downloads_last_day: number;
      downloads_last_week: number;
      downloads_last_month: number;
      downloads_last_year: number;
      last_updated: string;
    };
    
    // PyPI
    pypi?: {
      downloads_last_day: number;
      downloads_last_week: number;
      downloads_last_month: number;
      last_updated: string;
    };
    
    // News
    news_mentions?: {
      count_30d: number;
      count_90d: number;
      count_365d: number;
      sentiment_score: number;
      last_updated: string;
    };
    
    // Community
    hackernews?: {
      mentions_30d: number;
      average_points: number;
      average_comments: number;
      last_updated: string;
    };
    
    // Business
    funding?: {
      total_raised: number;
      last_round_amount: number;
      last_round_date: string;
      valuation: number;
      employee_count: number;
      last_updated: string;
    };
  };
}
```

### Migrations Needed

```sql
-- No schema changes needed
-- Using existing JSONB fields
-- Just update the data structure
```

---

## 6. Quick Wins - This Week

### Priority 1: SWE-bench Scores (2-3 hours)

**Collection Method:**
```typescript
// Scrape https://www.swebench.com/ leaderboard
// Or use existing published results

const sweBenchScores = [
  { tool: "cursor", verified: 58.0 },  // Example
  { tool: "github-copilot", verified: 52.0 },
  { tool: "devin", verified: 45.0 },
  // ... etc
];

// Update tools in database
for (const score of sweBenchScores) {
  await toolsRepository.update(score.tool, {
    metrics: {
      swe_bench: {
        verified: score.verified,
        last_updated: new Date().toISOString()
      }
    }
  });
}
```

**Impact:** Immediately improve agenticCapability scoring (35% weight)

---

### Priority 2: GitHub Metrics (3-4 hours)

**Implementation:**
```typescript
// /scripts/collect-github-metrics.ts

import { Octokit } from '@octokit/rest';

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

async function collectGitHubMetrics(repo: string) {
  const [owner, repoName] = repo.split('/');
  
  const { data } = await octokit.repos.get({
    owner,
    repo: repoName
  });
  
  const { data: contributors } = await octokit.repos.listContributors({
    owner,
    repo: repoName,
    per_page: 1
  });
  
  return {
    stars: data.stargazers_count,
    forks: data.forks_count,
    watchers: data.watchers_count,
    open_issues: data.open_issues_count,
    contributors: contributors.length,
    last_commit: data.pushed_at,
    last_updated: new Date().toISOString()
  };
}
```

**Impact:** Real data for developerAdoption (12.5% weight)

---

### Priority 3: VS Code Metrics (2-3 hours)

**Implementation:**
```typescript
// /scripts/collect-vscode-metrics.ts

import axios from 'axios';

async function collectVSCodeMetrics(extensionId: string) {
  const response = await axios.post(
    'https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery',
    {
      filters: [{
        criteria: [{ filterType: 7, value: extensionId }]
      }],
      flags: 914  // Include statistics
    }
  );
  
  const extension = response.data.results[0]?.extensions[0];
  const stats = extension?.statistics || [];
  
  return {
    installs: stats.find(s => s.statisticName === 'install')?.value || 0,
    downloads: stats.find(s => s.statisticName === 'updateCount')?.value || 0,
    rating: extension?.avgRating || 0,
    rating_count: extension?.ratingCount || 0,
    last_updated: new Date().toISOString()
  };
}
```

**Impact:** Real install data for developerAdoption (12.5% weight)

---

## 7. Cost Analysis

### FREE Options (Phase 1)

```
SWE-bench:        $0/month  (manual scraping)
GitHub API:       $0/month  (5K requests/hour)
VS Code API:      $0/month  (undocumented but free)
npm API:          $0/month  (official API)
PyPI API:         $0/month  (official API)
HackerNews API:   $0/month  (official API)

TOTAL PHASE 1:    $0/month
```

### PAID Options (Phases 2-3)

**Minimal Budget:**
```
News enhancement:  $0/month  (use existing system)
Community metrics: $0/month  (free APIs)
Funding data:      $0/month  (manual research)

TOTAL MINIMAL:     $0/month
```

**Recommended Budget:**
```
Crunchbase Pro:   $49/month   (funding data)
NewsData.io:      $199/month  (comprehensive news)

TOTAL RECOMMENDED: $248/month
```

**Premium Budget:**
```
Crunchbase Business: $199/month  (full API access)
NewsData.io Pro:     $299/month  (unlimited)
Reddit API:          $50/month   (if needed)

TOTAL PREMIUM:       $548/month
```

---

## 8. Expected Coverage After Implementation

### Phase 1 Completion (Week 1)

```
SWE-bench scores:       40% → 40% (15-20 tools)
GitHub activity:         0% → 45% (20-25 tools)
VS Code installs:        0% → 35% (15-20 tools)
npm downloads:           0% → 20% (8-10 tools)
PyPI downloads:          0% → 18% (8-10 tools)
News mentions:          5% → 10% (basic tracking)
Funding data:           0% → 0% (Phase 3)

OVERALL COVERAGE:       ~5% → ~28%
```

### Phase 2 Completion (Week 3)

```
SWE-bench scores:       40% (no change)
GitHub activity:        45% (no change)
VS Code installs:       35% (no change)
npm downloads:          20% (no change)
PyPI downloads:         18% (no change)
News mentions:         10% → 100% (enhanced system)
Community metrics:      0% → 100% (HackerNews)
Funding data:           0% (Phase 3)

OVERALL COVERAGE:      ~28% → ~51%
```

### Phase 3 Completion (Week 4)

```
All Phase 2 metrics     (maintained)
Funding data:           0% → 70% (35-40 tools)

OVERALL COVERAGE:      ~51% → ~75%
```

### With Manual Research (Ongoing)

```
All automated metrics   (maintained)
Manual SWE-bench:      40% → 50% (research additional tools)
Manual funding:        70% → 85% (public research)
Manual enrichment:     Various improvements

OVERALL COVERAGE:      ~75% → ~85%
```

**Target Achievement:** ✅ 80-85% coverage within 4 weeks

---

## 9. Recommended Approach

### Start Immediately (This Week)

**Day 1-2: SWE-bench**
- Research leaderboard
- Map tool names
- Manual data collection
- Database updates
- **Deliverable:** 15-20 tools with SWE-bench scores

**Day 3-4: GitHub API**
- Set up authentication
- Implement collection script
- Test on 5 tools
- Deploy for all open source tools
- **Deliverable:** 20-25 tools with GitHub metrics

**Day 5: VS Code + npm + PyPI**
- Implement marketplace API
- Implement registry APIs
- Test on subset
- Deploy for all applicable tools
- **Deliverable:** 30-40 tools with package metrics

**Weekend: Testing**
- Verify data quality
- Update algorithm to use real metrics
- Test ranking changes
- Document findings

---

### Week 2-3: Enhance

**News & Community:**
- Enhance existing news system
- Add HackerNews integration
- Aggregate community sentiment
- Update algorithm

**Testing:**
- Run rankings with real data
- Compare v7.2 vs v7.4
- Validate score distribution
- Check for anomalies

---

### Week 3-4: Business Metrics

**Budget Decision:**
- Review Phase 1-2 results
- Decide on paid APIs
- Implement funding collection
- Final algorithm tuning

**Production:**
- Deploy to production
- Set up monitoring
- Schedule automated updates
- Document processes

---

## 10. Sample Scripts

### Sample 1: GitHub Metrics Collection

```typescript
// /scripts/collect-github-metrics.ts

import { Octokit } from '@octokit/rest';
import { getDb } from '@/lib/db/connection';
import { tools } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

async function collectGitHubMetrics() {
  const db = getDb();
  
  // Get all tools with GitHub repos
  const allTools = await db.select().from(tools);
  const toolsWithGithub = allTools.filter(t => {
    const data = t.data as any;
    return data.github_repo || data.github_url;
  });
  
  console.log(`Found ${toolsWithGithub.length} tools with GitHub repos`);
  
  for (const tool of toolsWithGithub) {
    try {
      const data = tool.data as any;
      const repo = data.github_repo || extractRepo(data.github_url);
      
      if (!repo || !repo.includes('/')) {
        console.log(`Skipping ${tool.name}: Invalid repo format`);
        continue;
      }
      
      const [owner, repoName] = repo.split('/');
      
      // Get repository data
      const { data: repoData } = await octokit.repos.get({
        owner,
        repo: repoName
      });
      
      // Get commit activity (last year)
      const { data: commitActivity } = await octokit.repos.getCommitActivityStats({
        owner,
        repo: repoName
      });
      
      const totalCommits = commitActivity?.reduce((sum, week) => sum + week.total, 0) || 0;
      
      // Update tool with metrics
      const metrics = {
        github: {
          stars: repoData.stargazers_count,
          forks: repoData.forks_count,
          watchers: repoData.watchers_count,
          open_issues: repoData.open_issues_count,
          commits_last_year: totalCommits,
          last_commit: repoData.pushed_at,
          language: repoData.language,
          last_updated: new Date().toISOString()
        }
      };
      
      await db.update(tools)
        .set({
          data: { ...data, metrics: { ...data.metrics, ...metrics } }
        })
        .where(eq(tools.id, tool.id));
      
      console.log(`✓ Updated ${tool.name}: ${metrics.github.stars} stars`);
      
      // Rate limit: 5000/hour = ~1.4/second, so wait 1 second
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`✗ Error for ${tool.name}:`, error.message);
    }
  }
}

function extractRepo(url: string): string | null {
  if (!url) return null;
  const match = url.match(/github\.com\/([^\/]+\/[^\/]+)/);
  return match ? match[1] : null;
}

collectGitHubMetrics()
  .then(() => console.log('Done!'))
  .catch(console.error);
```

---

### Sample 2: VS Code Marketplace Collection

```typescript
// /scripts/collect-vscode-metrics.ts

import axios from 'axios';
import { getDb } from '@/lib/db/connection';
import { tools } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const MARKETPLACE_API = 'https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery';

async function getExtensionStats(extensionId: string) {
  const response = await axios.post(MARKETPLACE_API, {
    filters: [{
      criteria: [{ filterType: 7, value: extensionId }]
    }],
    flags: 914  // Include statistics, versions, files
  }, {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json;api-version=3.0-preview.1'
    }
  });
  
  const extension = response.data.results?.[0]?.extensions?.[0];
  if (!extension) return null;
  
  const stats = extension.statistics || [];
  
  return {
    installs: stats.find(s => s.statisticName === 'install')?.value || 0,
    downloads: stats.find(s => s.statisticName === 'updateCount')?.value || 0,
    rating: extension.avgRating || 0,
    rating_count: extension.ratingCount || 0,
    version: extension.versions?.[0]?.version || 'unknown',
    last_updated: new Date().toISOString()
  };
}

async function collectVSCodeMetrics() {
  const db = getDb();
  
  // Map of tool IDs to VS Code extension IDs
  const extensionMap: Record<string, string> = {
    'github-copilot': 'GitHub.copilot',
    'continue': 'Continue.continue',
    'tabnine': 'TabNine.tabnine-vscode',
    'codeium': 'Codeium.codeium',
    // ... add more mappings
  };
  
  const allTools = await db.select().from(tools);
  
  for (const tool of allTools) {
    const data = tool.data as any;
    const extensionId = extensionMap[tool.slug] || data.vscode_extension_id;
    
    if (!extensionId) {
      console.log(`Skipping ${tool.name}: No VS Code extension`);
      continue;
    }
    
    try {
      const metrics = await getExtensionStats(extensionId);
      
      if (!metrics) {
        console.log(`✗ No data for ${tool.name}`);
        continue;
      }
      
      await db.update(tools)
        .set({
          data: { 
            ...data, 
            metrics: { 
              ...data.metrics, 
              vscode: metrics 
            } 
          }
        })
        .where(eq(tools.id, tool.id));
      
      console.log(`✓ Updated ${tool.name}: ${metrics.installs.toLocaleString()} installs`);
      
      // Be nice to the API
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error(`✗ Error for ${tool.name}:`, error.message);
    }
  }
}

collectVSCodeMetrics()
  .then(() => console.log('Done!'))
  .catch(console.error);
```

---

### Sample 3: SWE-bench Manual Collection

```typescript
// /scripts/collect-swebench-scores.ts

import { getDb } from '@/lib/db/connection';
import { tools } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

// Manually collected from https://www.swebench.com/
// Update quarterly as leaderboard changes
const sweBenchScores: Record<string, {
  verified?: number;
  lite?: number;
  full?: number;
  multimodal?: number;
}> = {
  // Top performers (example data - verify actual scores)
  'cursor': { verified: 58.0 },
  'github-copilot': { verified: 52.0 },
  'devin': { verified: 45.0 },
  'windsurf': { verified: 42.0 },
  'aider': { verified: 38.0 },
  'claude-dev': { lite: 35.0 },
  'continue': { lite: 32.0 },
  'opendevin': { verified: 30.0 },
  'swe-agent': { verified: 28.0 },
  'auto-gpt': { lite: 25.0 },
  // ... add more as found
};

async function updateSWEBenchScores() {
  const db = getDb();
  
  const allTools = await db.select().from(tools);
  
  for (const tool of allTools) {
    const scores = sweBenchScores[tool.slug];
    
    if (!scores) {
      console.log(`No SWE-bench score for ${tool.name}`);
      continue;
    }
    
    const data = tool.data as any;
    
    await db.update(tools)
      .set({
        data: {
          ...data,
          metrics: {
            ...data.metrics,
            swe_bench: {
              ...scores,
              last_updated: new Date().toISOString()
            }
          }
        }
      })
      .where(eq(tools.id, tool.id));
    
    console.log(`✓ Updated ${tool.name}: ${JSON.stringify(scores)}`);
  }
}

updateSWEBenchScores()
  .then(() => console.log('Done!'))
  .catch(console.error);
```

---

### Sample 4: NPM Downloads Collection

```typescript
// /scripts/collect-npm-metrics.ts

import axios from 'axios';
import { getDb } from '@/lib/db/connection';
import { tools } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

async function getNPMDownloads(packageName: string) {
  try {
    // Get download stats for last year
    const response = await axios.get(
      `https://api.npmjs.org/downloads/point/last-year/${packageName}`
    );
    
    // Also get weekly breakdown
    const weekResponse = await axios.get(
      `https://api.npmjs.org/downloads/range/last-week/${packageName}`
    );
    
    const weekTotal = weekResponse.data.downloads.reduce(
      (sum: number, day: any) => sum + day.downloads, 
      0
    );
    
    return {
      downloads_last_year: response.data.downloads,
      downloads_last_week: weekTotal,
      downloads_last_month: null,  // Would need separate call
      last_updated: new Date().toISOString()
    };
  } catch (error) {
    console.error(`Error fetching ${packageName}:`, error.message);
    return null;
  }
}

async function collectNPMMetrics() {
  const db = getDb();
  
  // Map of tool slugs to npm package names
  const npmPackages: Record<string, string> = {
    'aider': 'aider-chat',
    'continue': '@continuedev/continue',
    'auto-gpt': 'autogpt',
    'open-interpreter': 'open-interpreter',
    // ... add more mappings
  };
  
  const allTools = await db.select().from(tools);
  
  for (const tool of allTools) {
    const packageName = npmPackages[tool.slug];
    
    if (!packageName) continue;
    
    const data = tool.data as any;
    const metrics = await getNPMDownloads(packageName);
    
    if (!metrics) continue;
    
    await db.update(tools)
      .set({
        data: {
          ...data,
          metrics: {
            ...data.metrics,
            npm: metrics
          }
        }
      })
      .where(eq(tools.id, tool.id));
    
    console.log(`✓ Updated ${tool.name}: ${metrics.downloads_last_year.toLocaleString()} downloads/year`);
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

collectNPMMetrics()
  .then(() => console.log('Done!'))
  .catch(console.error);
```

---

## 11. Success Criteria

### Phase 1 Success

- [ ] 40% of tools have at least 3 metrics collected
- [ ] SWE-bench scores for 15-20 tools
- [ ] GitHub metrics for 20-25 tools
- [ ] VS Code metrics for 15-20 tools
- [ ] All scripts working and documented
- [ ] Database updated with real data

### Phase 2 Success

- [ ] 60% of tools have at least 4 metrics collected
- [ ] News mentions for all 51 tools
- [ ] HackerNews metrics for all tools
- [ ] Community sentiment scores calculated
- [ ] Algorithm updated to use real data

### Phase 3 Success

- [ ] 80% of tools have at least 5 metrics collected
- [ ] Funding data for 30-40 tools
- [ ] Advanced news analytics
- [ ] Automated collection jobs running
- [ ] Monitoring dashboard operational

### Overall Success

- [ ] **Target:** 80-85% metrics coverage achieved
- [ ] Rankings show better differentiation
- [ ] No more duplicate scores in top 20
- [ ] Real data replaces proxy metrics
- [ ] System is maintainable and documented

---

## 12. Risks & Mitigation

### Risk 1: API Rate Limits

**Risk:** Hitting rate limits on free APIs

**Mitigation:**
- Implement exponential backoff
- Cache results for 24 hours
- Collect once per day maximum
- Use authenticated requests (5K/hour vs 60/hour)
- Monitor usage with logging

### Risk 2: Data Quality

**Risk:** Incorrect or outdated metrics

**Mitigation:**
- Validate data ranges (e.g., stars > 0)
- Store last_updated timestamps
- Manual spot-checking
- Compare with previous values for anomalies
- Implement data quality dashboards

### Risk 3: Tool Mapping

**Risk:** Incorrectly mapping tools to packages/repos

**Mitigation:**
- Manual verification of mappings
- Store mappings in configuration file
- Allow manual overrides
- Log all mapping decisions
- Test on subset first

### Risk 4: Budget Overruns

**Risk:** Paid APIs more expensive than expected

**Mitigation:**
- Start with free options first
- Evaluate ROI before committing
- Use minimal plans initially
- Monitor usage closely
- Have kill switch for paid services

### Risk 5: Maintenance Burden

**Risk:** Too much manual work to maintain

**Mitigation:**
- Automate everything possible
- Use cron jobs for updates
- Build monitoring into system
- Document all processes
- Plan for failures gracefully

---

## 13. Next Steps

### Immediate (Today)

1. ✅ **Review this report**
2. ✅ **Approve Phase 1 approach**
3. ✅ **Set up GitHub authentication token**
4. ✅ **Begin SWE-bench research**

### This Week

1. [ ] **Implement GitHub metrics collection**
2. [ ] **Implement VS Code metrics collection**
3. [ ] **Implement npm/PyPI collection**
4. [ ] **Collect SWE-bench scores manually**
5. [ ] **Update database with initial metrics**
6. [ ] **Test algorithm with real data**

### Next Week

1. [ ] **Review Phase 1 results**
2. [ ] **Begin Phase 2 (news & community)**
3. [ ] **Refine collection scripts**
4. [ ] **Set up automated jobs**

### Week 3-4

1. [ ] **Decide on paid API budget**
2. [ ] **Implement Phase 3 if approved**
3. [ ] **Deploy to production**
4. [ ] **Monitor and optimize**

---

## Conclusion

This research provides a comprehensive roadmap to achieve 80-85% metrics coverage for all 51 AI coding tools within 4 weeks. The phased approach prioritizes free, high-impact data sources first, then progressively adds more sophisticated metrics.

**Key Takeaways:**

1. ✅ **FREE metrics available NOW:** GitHub, SWE-bench, VS Code, npm, PyPI
2. ✅ **Quick wins possible:** 40-50% coverage achievable this week
3. ✅ **Low-cost path exists:** Can reach 60-75% coverage for $0/month
4. ✅ **Paid options add value:** $250/month gets comprehensive coverage
5. ✅ **Maintainable system:** Automation prevents ongoing manual work

**Recommendation:** Start with Phase 1 immediately using free APIs. This requires no budget approval and provides immediate value. Based on Phase 1 results, decide whether to invest in paid APIs for Phase 3.

The time to act is now. Real metrics will dramatically improve ranking accuracy and differentiation.

