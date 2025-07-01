# Payload CMS API Guide for Claude Desktop

This guide provides everything Claude Desktop needs to update AI Power Rankings content via the Payload CMS API.

## Quick Start

### 1. API Key Setup

1. Get your API key from the admin user (already configured)
2. Store it securely in Claude Desktop environment
3. Use in all API requests:

```bash
Authorization: users API-Key YOUR_API_KEY_HERE
```

### 2. Base URLs

- **Local Development**: `http://localhost:3000/api`
- **Production**: `https://aipowerranking.com/api`

## Step-by-Step Common Updates

### 🛠️ Update Tool Description

**Example: Update Cursor's description and tagline**

1. **Find the tool by slug:**
```bash
GET http://localhost:3000/api/tools?where[slug][equals]=cursor
Authorization: users API-Key YOUR_API_KEY_HERE
```

2. **Extract the tool ID from response:**
```json
{
  "docs": [{
    "id": "66788f5e8c4a3b001e8b4567",  // <-- Copy this ID
    "name": "Cursor",
    "slug": "cursor"
  }]
}
```

3. **Update the tool:**
```bash
PATCH http://localhost:3000/api/tools/66788f5e8c4a3b001e8b4567
Content-Type: application/json
Authorization: users API-Key YOUR_API_KEY_HERE

{
  "tagline": "The AI-first code editor",
  "description": "Cursor is an AI-powered code editor that helps developers write code faster with GPT-4 integration, multi-file editing, and natural language commands."
}
```

### 💰 Update Tool Pricing

**Example: Update GitHub Copilot pricing model**

1. **Find the tool:**
```bash
GET http://localhost:3000/api/tools?where[slug][equals]=github-copilot
```

2. **Update pricing information:**
```bash
PATCH http://localhost:3000/api/tools/{tool-id}
Content-Type: application/json
Authorization: users API-Key YOUR_API_KEY_HERE

{
  "pricing_model": "subscription",
  "pricing_tiers": [
    {
      "name": "Individual",
      "price": 10,
      "price_period": "monthly",
      "features": ["Unlimited suggestions", "Multi-language support"]
    },
    {
      "name": "Business",
      "price": 19,
      "price_period": "monthly",
      "features": ["Everything in Individual", "Organization management", "Policy controls"]
    }
  ],
  "free_tier_available": true,
  "free_tier_limitations": "30-day free trial"
}
```

### 🏢 Update Company Description

**Example: Update Anthropic's company information**

1. **Find the company:**
```bash
GET http://localhost:3000/api/companies?where[slug][equals]=anthropic
```

2. **Update company details:**
```bash
PATCH http://localhost:3000/api/companies/{company-id}
Content-Type: application/json
Authorization: users API-Key YOUR_API_KEY_HERE

{
  "description": "Anthropic is an AI safety company building reliable, interpretable, and steerable AI systems. Makers of Claude, the helpful, harmless, and honest AI assistant.",
  "mission": "To ensure transformative AI helps people and society flourish",
  "headquarters": "San Francisco, CA",
  "founded_year": 2021,
  "employee_count": 200,
  "company_size": "medium",
  "funding_stage": "series_c",
  "total_funding": 1500000000,
  "website_url": "https://anthropic.com",
  "blog_url": "https://anthropic.com/news",
  "linkedin_url": "https://linkedin.com/company/anthropic"
}
```

### 📊 Add Tool Metrics

**Example: Record Cursor's user milestone**

```bash
POST http://localhost:3000/api/metrics
Content-Type: application/json
Authorization: users API-Key YOUR_API_KEY_HERE

{
  "tool": "66788f5e8c4a3b001e8b4567",  // Cursor's ID
  "metric_key": "monthly_active_users",
  "value": 500000,
  "value_display": "500K",
  "metric_type": "usage",
  "recorded_at": "2025-06-26T00:00:00Z",
  "source": "official_announcement",
  "source_url": "https://cursor.com/blog/500k-users",
  "confidence_score": 1.0,
  "notes": "Announced in official blog post"
}
```

### 🌟 Update Tool Features

**Example: Update Windsurf's key features**

```bash
PATCH http://localhost:3000/api/tools/{tool-id}
Content-Type: application/json
Authorization: users API-Key YOUR_API_KEY_HERE

{
  "key_features": [
    "AI-powered code completion",
    "Multi-file context awareness",
    "Natural language to code",
    "Integrated terminal",
    "Git integration",
    "Real-time collaboration"
  ],
  "supported_languages": [
    "JavaScript", "TypeScript", "Python", "Java", "C++", 
    "Go", "Rust", "Ruby", "PHP", "Swift"
  ],
  "llm_providers": ["anthropic", "openai", "google"],
  "deployment_options": ["desktop", "cloud"],
  "integrations": [
    "GitHub", "GitLab", "Bitbucket", "Jira", "Slack"
  ]
}
```

### 📈 Update Rankings

**Example: Update top 5 tool rankings**

```javascript
const rankings = [
  { slug: "cursor", position: 1 },
  { slug: "windsurf", position: 2 },
  { slug: "github-copilot", position: 3 },
  { slug: "cody", position: 4 },
  { slug: "continue-dev", position: 5 }
];

for (const ranking of rankings) {
  // Get tool
  const response = await fetch(
    `http://localhost:3000/api/tools?where[slug][equals]=${ranking.slug}`,
    { headers: { Authorization: `users API-Key ${API_KEY}` } }
  );
  
  const { docs } = await response.json();
  if (docs.length > 0) {
    // Update ranking
    await fetch(`http://localhost:3000/api/tools/${docs[0].id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `users API-Key ${API_KEY}`
      },
      body: JSON.stringify({
        current_ranking: ranking.position,
        is_trending: ranking.position <= 3
      })
    });
  }
}
```

### 🔧 Update Tool Status

**Example: Mark a tool as discontinued**

```bash
PATCH http://localhost:3000/api/tools/{tool-id}
Content-Type: application/json
Authorization: users API-Key YOUR_API_KEY_HERE

{
  "status": "discontinued",
  "discontinuation_date": "2025-06-01T00:00:00Z",
  "discontinuation_reason": "Company acquired and product merged into parent platform"
}
```

### 📅 Add News Article

**Example: Add funding announcement**

```bash
POST http://localhost:3000/api/news
Content-Type: application/json
Authorization: users API-Key YOUR_API_KEY_HERE

{
  "title": "Cursor Raises $60M Series A Led by Andreessen Horowitz",
  "slug": "cursor-60m-series-a-funding",
  "summary": "AI code editor startup Cursor announces $60M funding round to accelerate product development",
  "content": "Cursor, the AI-powered code editor, today announced a $60 million Series A funding round...",
  "category": "funding",
  "sentiment": "positive",
  "published_at": "2025-06-26T09:00:00Z",
  "source_url": "https://techcrunch.com/2025/06/26/cursor-raises-60m",
  "source": "TechCrunch",
  "tools": ["cursor-tool-id"],
  "companies": ["anysphere-company-id"],
  "is_featured": true
}
```

## Complete Field References

### Tool Fields Reference
```typescript
{
  // Basic Information
  name: string;              // Display name (required)
  slug: string;              // URL-friendly ID (auto-generated from name)
  tagline?: string;          // Short description (50-100 chars)
  description?: string;      // Full description (plain text or rich text)
  
  // URLs
  website_url?: string;      // Main website
  github_url?: string;       // GitHub repository
  documentation_url?: string; // Docs site
  demo_url?: string;         // Live demo
  discord_url?: string;      // Discord server
  
  // Classification
  category: string;          // Required, one of:
    // "autonomous-agent" - Fully autonomous coding agents
    // "code-editor" - AI-enhanced code editors
    // "ide-assistant" - IDE plugins/extensions
    // "app-builder" - No-code/low-code builders
    // "code-assistant" - Coding chat assistants
    // "code-review" - Code review tools
    // "testing-tool" - AI testing tools
    // "open-source-framework" - OSS frameworks
  
  subcategory?: string;      // Optional subcategory
  
  // Features & Capabilities
  key_features?: string[];   // Main features (5-10 items)
  supported_languages?: string[]; // Programming languages
  supported_platforms?: string[]; // "windows", "mac", "linux", "web"
  llm_providers?: string[];  // "openai", "anthropic", "google", etc.
  deployment_options?: string[]; // "cloud", "self-hosted", "desktop"
  integrations?: string[];   // Third-party integrations
  
  // Technical Capabilities
  context_window_size?: number; // Max tokens
  supports_images?: boolean;
  supports_web_browsing?: boolean;
  supports_function_calling?: boolean;
  
  // Pricing (deprecated - use pricing_tiers)
  pricing_model?: string;    // "free", "freemium", "subscription", "usage-based"
  pricing_tiers?: Array<{
    name: string;
    price: number;
    price_period: "monthly" | "yearly" | "one-time";
    features: string[];
  }>;
  free_tier_available?: boolean;
  free_tier_limitations?: string;
  
  // Status & Lifecycle
  status: string;            // Required, one of:
    // "active" - Actively developed
    // "beta" - In beta testing
    // "deprecated" - No longer recommended
    // "discontinued" - No longer available
    // "acquired" - Acquired by another company
  
  launch_date?: string;      // ISO date when launched
  beta_date?: string;        // ISO date when beta started
  discontinuation_date?: string; // ISO date when discontinued
  acquisition_date?: string; // ISO date when acquired
  
  // Relationships
  company: string;           // Company ID (required)
  acquired_by_company?: string; // Company ID if acquired
  
  // Rankings & Features
  current_ranking?: number;  // Current position (1-100)
  previous_ranking?: number; // Previous position
  is_featured?: boolean;     // Featured on homepage
  is_trending?: boolean;     // Trending this week
  trend_direction?: "up" | "down" | "stable";
  
  // Metadata
  logo_url?: string;         // Tool logo
  banner_url?: string;       // Banner image
  color_theme?: string;      // Hex color for branding
}
```

### Company Fields Reference
```typescript
{
  // Basic Information
  name: string;              // Company name (required)
  slug: string;              // URL-friendly ID (auto-generated)
  description?: string;      // Company description
  mission?: string;          // Company mission statement
  
  // URLs
  website_url?: string;      // Main website
  blog_url?: string;         // Company blog
  careers_url?: string;      // Careers page
  linkedin_url?: string;     // LinkedIn profile
  twitter_url?: string;      // Twitter/X profile
  github_url?: string;       // GitHub organization
  
  // Company Details
  founded_year?: number;     // Year founded (e.g., 2021)
  headquarters?: string;     // HQ location (e.g., "San Francisco, CA")
  company_size?: string;     // One of:
    // "tiny" - 1-10 employees
    // "small" - 11-50 employees
    // "medium" - 51-200 employees
    // "large" - 201-1000 employees
    // "enterprise" - 1000+ employees
  
  // Funding Information
  funding_stage?: string;    // One of:
    // "bootstrapped" - No external funding
    // "pre_seed" - Pre-seed stage
    // "seed" - Seed funding
    // "series_a" - Series A
    // "series_b" - Series B
    // "series_c" - Series C
    // "series_d_plus" - Series D or later
    // "ipo" - Public company
    // "acquired" - Acquired by another company
  
  total_funding?: number;    // Total funding in USD
  last_funding_date?: string; // ISO date of last funding
  last_funding_amount?: number; // Last round amount in USD
  valuation?: number;        // Company valuation in USD
  investors?: string[];      // List of major investors
  
  // Leadership
  leadership?: {
    ceo?: string;           // CEO name
    cto?: string;           // CTO name
    founders?: string[];    // List of founders
    board_members?: string[]; // Board members
  };
  
  // Business Metrics
  employee_count?: number;   // Current employee count
  annual_revenue?: number;   // Annual revenue in USD
  revenue_growth_rate?: number; // YoY growth rate (0.25 = 25%)
  primary_market?: string;   // Primary market focus
  
  // Relationships
  parent_company?: string;   // Parent company ID if subsidiary
  subsidiaries?: string[];   // List of subsidiary company IDs
  
  // Status
  is_active?: boolean;       // Still operating
  acquisition_date?: string; // ISO date if acquired
  acquired_by?: string;      // Company ID of acquirer
}

### Metrics Fields Reference
```typescript
{
  // Required Fields
  tool: string;              // Tool ID this metric belongs to
  metric_key: string;        // Metric identifier (see common keys below)
  value: number;             // Numeric value
  metric_type: string;       // Category of metric:
    // "financial" - Revenue, funding, valuation
    // "usage" - Users, downloads, activity
    // "performance" - Benchmarks, speed, accuracy
    // "growth" - Growth rates, trends
    // "technical" - Technical specs
  
  // Display & Source
  value_display?: string;    // Human-readable value (e.g., "500K", "$2M")
  recorded_at: string;       // ISO date when metric was recorded
  source: string;            // Source type:
    // "official_announcement" - Company announcement
    // "official_blog" - Company blog post
    // "earnings_report" - Financial filing
    // "news_article" - Media coverage
    // "research_report" - Third-party research
    // "github_api" - GitHub API data
    // "benchmark" - Official benchmark
  
  source_url?: string;       // URL to source
  confidence_score?: number; // 0-1 confidence in accuracy
  
  // Additional Context
  notes?: string;            // Additional context
  comparison_period?: string; // For growth metrics (e.g., "month", "year")
  is_estimate?: boolean;     // If value is estimated
}

// Common Metric Keys by Category:

// Financial Metrics
"monthly_arr"              // Monthly recurring revenue ($)
"annual_revenue"           // Total annual revenue ($)
"total_funding"            // Total funding raised ($)
"last_funding_amount"      // Most recent funding ($)
"valuation"                // Company valuation ($)
"burn_rate"                // Monthly burn rate ($)
"runway_months"            // Months of runway

// Usage Metrics  
"monthly_active_users"     // MAU count
"weekly_active_users"      // WAU count
"daily_active_users"       // DAU count
"total_users"              // Total registered users
"paid_users"               // Paying customers
"enterprise_customers"     // Enterprise customer count
"github_stars"             // GitHub stars
"npm_downloads_weekly"     // NPM weekly downloads
"docker_pulls"             // Docker Hub pulls

// Performance Metrics
"swe_bench_score"          // SWE-bench percentage
"human_eval_score"         // HumanEval percentage
"mbpp_score"               // MBPP benchmark score
"context_window_size"      // Max context tokens
"response_time_ms"         // Average response time
"uptime_percentage"        // Service uptime (99.9)
"accuracy_score"           // Accuracy percentage

// Growth Metrics
"user_growth_rate_mom"     // Month-over-month growth
"revenue_growth_rate_yoy"  // Year-over-year growth
"churn_rate"               // Monthly churn percentage
"retention_rate"           // User retention rate
"nps_score"                // Net Promoter Score
```

### News Fields Reference
```typescript
{
  // Required Fields
  title: string;             // Article title
  slug: string;              // URL-friendly ID (auto-generated)
  category: string;          // News category:
    // "product_update" - New features/updates
    // "funding" - Funding announcements
    // "acquisition" - M&A activity
    // "partnership" - Strategic partnerships
    // "milestone" - Usage/growth milestones
    // "research" - Papers/benchmarks
    // "analysis" - Market analysis
    // "announcement" - General announcements
  
  // Content
  summary?: string;          // Brief summary (150-300 chars)
  content?: string;          // Full article content (rich text)
  key_points?: string[];     // Bullet points of key info
  
  // Metadata
  published_at: string;      // ISO date of publication
  source?: string;           // Source name (e.g., "TechCrunch")
  source_url?: string;       // Original article URL
  author?: string;           // Author name
  
  // Relationships
  tools?: string[];          // Related tool IDs
  companies?: string[];      // Related company IDs
  
  // Analysis
  sentiment?: string;        // One of:
    // "positive" - Good news
    // "negative" - Bad news
    // "neutral" - Neutral/factual
    // "mixed" - Both positive and negative
  
  impact_level?: string;     // One of:
    // "high" - Major industry impact
    // "medium" - Significant news
    // "low" - Minor update
  
  // Metrics Mentioned
  metrics_mentioned?: {      // Metrics mentioned in article
    [toolSlug: string]: {
      [metricKey: string]: number
    }
  };
  
  // Display Options
  is_featured?: boolean;     // Feature on homepage
  is_breaking?: boolean;     // Breaking news flag
  tags?: string[];          // Additional tags
  
  // Media
  featured_image?: string;   // Hero image URL
  images?: Array<{
    url: string;
    caption?: string;
    alt_text?: string;
  }>;
}

## Batch Operations

### Update Multiple Tools
```typescript
// Example: Update rankings for top tools
const updates = [
  { slug: "cursor", ranking: 1 },
  { slug: "github-copilot", ranking: 2 },
  { slug: "cody", ranking: 3 }
];

for (const update of updates) {
  // First get the tool
  const response = await fetch(
    `${API_URL}/tools?where[slug][equals]=${update.slug}`,
    { headers: { Authorization: `users API-Key ${API_KEY}` } }
  );
  
  const { docs } = await response.json();
  if (docs.length > 0) {
    // Then update it
    await fetch(`${API_URL}/tools/${docs[0].id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `users API-Key ${API_KEY}`
      },
      body: JSON.stringify({
        current_ranking: update.ranking
      })
    });
  }
}
```

## Working with Rich Text

Payload uses Lexical for rich text. Simple text can be provided as:

```json
{
  "description": "Simple text description"
}
```

For formatted content:
```json
{
  "description": [
    {
      "children": [
        { "text": "AI-powered code editor with " },
        { "text": "GPT-4", "bold": true },
        { "text": " integration" }
      ]
    },
    {
      "children": [
        { "text": "Features include:" }
      ]
    },
    {
      "type": "list",
      "listType": "bullet",
      "children": [
        {
          "children": [
            { "text": "Intelligent code completion" }
          ]
        },
        {
          "children": [
            { "text": "Natural language to code" }
          ]
        }
      ]
    }
  ]
}
```

## Query Parameters

### Filtering
```bash
# Single condition
?where[status][equals]=active

# Multiple conditions
?where[category][equals]=code-editor&where[is_featured][equals]=true

# Not equals
?where[status][not_equals]=discontinued

# Contains (for arrays)
?where[llm_providers][contains]=openai

# Greater than/less than
?where[current_ranking][less_than]=10
```

### Sorting
```bash
# Ascending
?sort=name

# Descending
?sort=-current_ranking

# Multiple sorts
?sort=-is_featured,-current_ranking
```

### Pagination
```bash
?limit=20&page=2
```

### Relationships
```bash
# Include related data
?depth=1  # Include direct relationships
?depth=2  # Include nested relationships
```

## Error Handling

### Common Errors

#### 400 Bad Request
```json
{
  "errors": [
    {
      "message": "The following field is invalid: tool",
      "field": "tool"
    }
  ]
}
```
**Fix**: Check field names and data types match schema

#### 401 Unauthorized
```json
{
  "error": "You are not allowed to perform this action"
}
```
**Fix**: Verify API key is correct and user has required permissions

#### 404 Not Found
```json
{
  "error": "The requested resource was not found"
}
```
**Fix**: Check ID exists and collection name is correct

## Best Practices

### 1. Always Use Slugs
```typescript
// Good - use slug for lookups
const tool = await getToolBySlug("cursor");

// Avoid - IDs can change
const tool = await getToolById("60f7b3d3c3e4a0001f8e4b1a");
```

### 2. Batch Related Updates
```typescript
// When updating a tool, also update metrics
const tool = await updateTool(id, toolData);
if (newMetrics) {
  await createMetric({ tool: tool.id, ...metricsData });
}
```

### 3. Check Before Creating
```typescript
// Avoid duplicates
const existing = await findToolBySlug(slug);
if (!existing) {
  await createTool(data);
}
```

### 4. Use Meaningful Sources
```typescript
// Good - specific source
{
  "source": "official_blog",
  "source_url": "https://cursor.com/blog/500k-users"
}

// Avoid - vague source
{
  "source": "internet"
}
```

### 5. Validate URLs
```typescript
// Ensure URLs are valid
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
```

## Complete Example

Here's a complete example of updating a tool with new information:

```typescript
async function updateToolWithMetrics(
  slug: string,
  updates: any,
  metrics: any[]
) {
  const API_URL = "http://localhost:3000/api";
  const API_KEY = "your-api-key";
  
  try {
    // 1. Find the tool
    const findResponse = await fetch(
      `${API_URL}/tools?where[slug][equals]=${slug}`,
      {
        headers: {
          Authorization: `users API-Key ${API_KEY}`
        }
      }
    );
    
    const { docs } = await findResponse.json();
    if (docs.length === 0) {
      throw new Error(`Tool not found: ${slug}`);
    }
    
    const tool = docs[0];
    
    // 2. Update the tool
    const updateResponse = await fetch(
      `${API_URL}/tools/${tool.id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `users API-Key ${API_KEY}`
        },
        body: JSON.stringify(updates)
      }
    );
    
    if (!updateResponse.ok) {
      throw new Error(`Failed to update tool: ${updateResponse.statusText}`);
    }
    
    // 3. Add metrics
    for (const metric of metrics) {
      const metricResponse = await fetch(
        `${API_URL}/metrics`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `users API-Key ${API_KEY}`
          },
          body: JSON.stringify({
            tool: tool.id,
            ...metric,
            recorded_at: metric.recorded_at || new Date().toISOString()
          })
        }
      );
      
      if (!metricResponse.ok) {
        console.error(`Failed to add metric: ${metric.metric_key}`);
      }
    }
    
    return { success: true, tool };
    
  } catch (error) {
    console.error("Update failed:", error);
    return { success: false, error: error.message };
  }
}

// Usage
await updateToolWithMetrics(
  "cursor",
  {
    tagline: "The AI-first code editor",
    key_features: [
      "GPT-4 powered",
      "Multi-file editing",
      "Natural language commands"
    ]
  },
  [
    {
      metric_key: "monthly_active_users",
      value: 500000,
      value_display: "500K",
      metric_type: "usage",
      source: "official_announcement",
      confidence_score: 1.0
    }
  ]
);
```

## Rate Limits

- **Standard**: 100 requests per minute
- **With API Key**: 1000 requests per minute
- **Bulk operations**: Max 100 items per request

## Real-World Examples

### Example 1: Complete Tool Update (Cursor)

```typescript
// 1. Get Cursor's current data
const toolResponse = await fetch(
  "http://localhost:3000/api/tools?where[slug][equals]=cursor",
  { headers: { Authorization: `users API-Key ${API_KEY}` } }
);
const { docs: [cursor] } = await toolResponse.json();

// 2. Update all relevant information
await fetch(`http://localhost:3000/api/tools/${cursor.id}`, {
  method: "PATCH",
  headers: {
    "Content-Type": "application/json",
    Authorization: `users API-Key ${API_KEY}`
  },
  body: JSON.stringify({
    tagline: "The AI-first code editor",
    description: "Cursor is an AI-powered code editor built for pair programming with AI. Features GPT-4 integration, multi-file editing, and natural language commands.",
    key_features: [
      "GPT-4 powered code completion",
      "Multi-file context awareness", 
      "Natural language to code",
      "AI chat in editor",
      "Codebase-wide understanding"
    ],
    pricing_tiers: [
      {
        name: "Hobby",
        price: 0,
        price_period: "monthly",
        features: ["2000 requests/month", "GPT-3.5"]
      },
      {
        name: "Pro",
        price: 20,
        price_period: "monthly",
        features: ["Unlimited requests", "GPT-4", "Priority support"]
      }
    ],
    supported_languages: ["JavaScript", "TypeScript", "Python", "Go", "Rust", "Java"],
    llm_providers: ["openai"],
    website_url: "https://cursor.com",
    github_url: "https://github.com/getcursor/cursor"
  })
});

// 3. Add latest metrics
await fetch("http://localhost:3000/api/metrics", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `users API-Key ${API_KEY}`
  },
  body: JSON.stringify({
    tool: cursor.id,
    metric_key: "monthly_active_users",
    value: 500000,
    value_display: "500K",
    metric_type: "usage",
    recorded_at: new Date().toISOString(),
    source: "official_announcement",
    source_url: "https://cursor.com/blog/500k-users",
    confidence_score: 1.0
  })
});
```

### Example 2: Add Funding News with Company Update

```typescript
// 1. Find the company
const companyResponse = await fetch(
  "http://localhost:3000/api/companies?where[slug][equals]=anysphere",
  { headers: { Authorization: `users API-Key ${API_KEY}` } }
);
const { docs: [company] } = await companyResponse.json();

// 2. Update company funding info
await fetch(`http://localhost:3000/api/companies/${company.id}`, {
  method: "PATCH",
  headers: {
    "Content-Type": "application/json",
    Authorization: `users API-Key ${API_KEY}`
  },
  body: JSON.stringify({
    funding_stage: "series_a",
    total_funding: 60000000,
    last_funding_date: "2025-06-26",
    last_funding_amount: 60000000,
    valuation: 400000000,
    investors: ["Andreessen Horowitz", "Spark Capital", "Angel investors"]
  })
});

// 3. Create news article
const toolResponse = await fetch(
  "http://localhost:3000/api/tools?where[slug][equals]=cursor",
  { headers: { Authorization: `users API-Key ${API_KEY}` } }
);
const { docs: [tool] } = await toolResponse.json();

await fetch("http://localhost:3000/api/news", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `users API-Key ${API_KEY}`
  },
  body: JSON.stringify({
    title: "Cursor Raises $60M Series A to Build the Future of AI-Powered Coding",
    category: "funding",
    sentiment: "positive",
    impact_level: "high",
    summary: "AI code editor Cursor secures $60M in Series A funding led by Andreessen Horowitz",
    content: "Cursor, the AI-powered code editor, today announced...",
    published_at: new Date().toISOString(),
    source: "TechCrunch",
    source_url: "https://techcrunch.com/cursor-series-a",
    tools: [tool.id],
    companies: [company.id],
    is_featured: true,
    metrics_mentioned: {
      "cursor": {
        "total_funding": 60000000,
        "valuation": 400000000
      }
    }
  })
});
```

### Example 3: Bulk Update Rankings

```typescript
const rankingsUpdate = [
  { slug: "cursor", rank: 1, trending: "up", movement: 2 },
  { slug: "windsurf", rank: 2, trending: "up", movement: 5 },
  { slug: "github-copilot", rank: 3, trending: "stable", movement: 0 },
  { slug: "cody", rank: 4, trending: "down", movement: -1 },
  { slug: "continue-dev", rank: 5, trending: "up", movement: 3 }
];

for (const update of rankingsUpdate) {
  // Get tool
  const response = await fetch(
    `http://localhost:3000/api/tools?where[slug][equals]=${update.slug}`,
    { headers: { Authorization: `users API-Key ${API_KEY}` } }
  );
  
  const { docs } = await response.json();
  if (docs.length > 0) {
    const tool = docs[0];
    
    // Update ranking and trending status
    await fetch(`http://localhost:3000/api/tools/${tool.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `users API-Key ${API_KEY}`
      },
      body: JSON.stringify({
        current_ranking: update.rank,
        previous_ranking: update.rank - update.movement,
        is_trending: update.movement > 0,
        trend_direction: update.trending
      })
    });
  }
}
```

## Tips for Claude Desktop

1. **Always use slugs** for tool/company lookups - they're stable identifiers
2. **Batch related updates** - Update tool, then metrics, then create news
3. **Include source URLs** for all metrics and news for credibility
4. **Use confidence scores** - 1.0 for official sources, 0.8-0.9 for estimates
5. **Check for existing records** before creating to avoid duplicates
6. **Use appropriate categories** for news to enable proper filtering
7. **Include relationships** (tools/companies) in news for better context

## Support

For API issues or questions:
1. Check the [Payload documentation](https://payloadcms.com/docs)
2. Review error messages for specific field issues
3. Verify your API key has appropriate permissions
4. Contact admin for access issues