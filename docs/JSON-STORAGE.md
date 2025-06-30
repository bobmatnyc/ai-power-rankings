# JSON Storage Architecture

## Overview

AI Power Rankings uses a JSON file-based storage system for all data persistence. This architecture provides:

- **Simplicity**: No database server required
- **Version Control**: All data changes tracked in git
- **Performance**: Direct file access with in-memory caching
- **Reliability**: No external dependencies
- **Portability**: Easy backup and migration

## Architecture

### Storage Structure

```
/data/json/
├── companies.json      # Company data
├── tools.json         # Tool information
├── rankings/          # Rankings by period
│   ├── 2025-01-15.json
│   ├── 2025-01-22.json
│   └── current.json   # Symlink to latest
├── news/              # News articles
│   ├── articles.json
│   └── ingestion-reports.json
└── cache/             # Generated cache files
    ├── rankings-cache.json
    ├── tools-cache.json
    └── news-cache.json
```

### Data Flow

```
JSON Files → Repository Layer → API Routes → Frontend
     ↓              ↓                ↓
  Backup      In-Memory Cache    Response Cache
```

## Repository Pattern

Each data type has a dedicated repository that handles:

- **Reading**: Load JSON data with schema validation
- **Writing**: Atomic writes with backup
- **Querying**: In-memory filtering and sorting
- **Indexing**: Maintain lookup indices for performance

### Example Repository Usage

```typescript
import { getToolsRepo, getRankingsRepo } from "@/lib/json-db";

// Get all tools
const toolsRepo = getToolsRepo();
const tools = await toolsRepo.getAll();

// Get tool by slug
const tool = await toolsRepo.getBySlug("chatgpt");

// Update tool
await toolsRepo.upsert({
  ...tool,
  updated_at: new Date().toISOString()
});
```

## Schema Definitions

### Tool Schema

```typescript
interface Tool {
  id: string;
  slug: string;
  name: string;
  category: ToolCategory;
  status: 'active' | 'deprecated';
  company_id: string;
  info: {
    summary: string;
    description: string;
    website: string;
    features: string[];
    integrations: string[];
    business: {
      pricing_model: string;
      target_market: string;
    };
  };
  created_at: string;
  updated_at: string;
}
```

### Company Schema

```typescript
interface Company {
  id: string;
  slug: string;
  name: string;
  info: {
    description: string;
    website: string;
    headquarters: string;
    founded_year: number;
    company_size: string;
    funding_total: number;
    public_trading: {
      is_public: boolean;
      ticker?: string;
      exchange?: string;
    };
  };
  created_at: string;
  updated_at: string;
}
```

### Ranking Schema

```typescript
interface RankingPeriod {
  period: string; // YYYY-MM-DD
  rankings: RankingEntry[];
  metadata: {
    algorithm_version: string;
    created_at: string;
    is_current: boolean;
  };
}

interface RankingEntry {
  tool_id: string;
  position: number;
  score: number;
  tier: string;
  movement: {
    direction: 'up' | 'down' | 'stable' | 'new';
    change: number;
    previous_position?: number;
  };
  factor_scores: {
    agentic_capability: number;
    innovation: number;
    technical_performance: number;
    developer_adoption: number;
    market_traction: number;
    business_sentiment: number;
    development_velocity: number;
    platform_resilience: number;
  };
}
```

## Data Operations

### Reading Data

```typescript
// Direct file read
const data = await fs.readFile('/data/json/tools.json', 'utf-8');
const tools = JSON.parse(data);

// Using repository
const toolsRepo = getToolsRepo();
const activeTools = await toolsRepo.getByStatus('active');
```

### Writing Data

```typescript
// Atomic write with backup
const toolsRepo = getToolsRepo();
await toolsRepo.upsert(newTool);

// Bulk operations
await toolsRepo.bulkUpsert(tools);
```

### Querying Data

```typescript
// Filter and sort
const tools = await toolsRepo.getAll();
const aiTools = tools
  .filter(t => t.category === 'ai-coding-tool')
  .sort((a, b) => a.name.localeCompare(b.name));

// Search
const results = await toolsRepo.search('chat');
```

## Performance Optimization

For comprehensive performance optimization strategies, see [PERFORMANCE-OPTIMIZATION.md](./PERFORMANCE-OPTIMIZATION.md).

### Quick Reference

```bash
# Optimize JSON files for production
npm run optimize:json

# Generate cache files
npm run cache:generate

# View cache statistics
npm run cache:stats
```

### Key Optimizations

1. **In-Memory Caching**: LRU cache with TTL for all repositories
2. **File Compression**: Automatic .gz and .br versions
3. **Data Indexing**: O(1) lookups for large arrays
4. **File Chunking**: Automatic splitting of files >500KB
5. **CDN Integration**: Cache headers for edge caching

## Backup and Recovery

For comprehensive backup and recovery procedures, see [BACKUP-RECOVERY.md](./BACKUP-RECOVERY.md).

### Quick Reference

```bash
# Create backup
npm run backup:create

# Restore interactively
npm run backup:restore

# Restore latest backup
npm run backup:restore:latest

# Validate data integrity
npm run validate:all
```

### Automated Backups

- **Pre-write backups**: Automatic before any data modification
- **Daily backups**: Scheduled at 2 AM local time
- **Retention**: Last 10 backups kept automatically
- **Git tracking**: All changes tracked in version control

## Migration Procedures

### Importing Data

```bash
# Import from CSV
npm run import:tools --file=tools.csv

# Import from API
npm run import:rankings --source=api

# Validate after import
npm run validate:all
```

### Exporting Data

```bash
# Export to CSV
npm run export:tools --format=csv

# Export to SQL
npm run export:all --format=sql
```

## Troubleshooting

### Common Issues

1. **File Permission Errors**
   ```bash
   chmod -R 755 data/json/
   ```

2. **Corrupted JSON**
   ```bash
   npm run validate:json
   npm run backup:restore --latest
   ```

3. **Memory Issues**
   - Increase Node.js heap size
   - Enable incremental loading
   - Use streaming for large files

### Health Checks

```bash
# Validate all JSON files
npm run validate:all

# Check file integrity
npm run health:check

# Repair indices
npm run repair:indices
```

## Best Practices

1. **Always use repositories** - Don't read/write JSON files directly
2. **Validate before writing** - Use schema validation
3. **Handle errors gracefully** - Always have fallbacks
4. **Monitor file sizes** - Split large files if needed
5. **Regular backups** - Automate backup procedures
6. **Version control** - Commit data changes regularly

## Development Tools

### JSON Viewer

```bash
# Pretty print JSON file
npm run json:view -- tools.json

# Validate structure
npm run json:validate -- rankings/2025-01-29.json
```

### Data Inspector

```bash
# Inspect tool data
npm run inspect:tool -- chatgpt

# Show rankings diff
npm run diff:rankings -- 2025-01-22 2025-01-29
```

## Security Considerations

1. **Read-only in production** - Write operations restricted to admin APIs
2. **Input validation** - All data validated against schemas
3. **Rate limiting** - Prevent excessive file operations
4. **Access control** - File permissions properly set
5. **Audit logging** - Track all write operations

## Performance Benchmarks

- **Load time**: < 50ms for full dataset
- **Query time**: < 5ms for indexed lookups
- **Write time**: < 100ms with backup
- **Memory usage**: ~50MB for full cache
- **Startup time**: < 1s to load all repositories