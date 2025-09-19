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
├── tools/              # Tool information
│   ├── individual/     # Individual tool files (primary storage)
│   │   ├── aider.json
│   │   ├── cursor.json
│   │   └── ...        # 30 individual tool files
│   ├── tools-index.json # Lookup indices and metadata
│   └── tools.json      # Legacy monolithic file (deprecated)
├── rankings/           # Rankings by period
│   ├── 2025-01-15.json
│   ├── 2025-01-22.json
│   └── current.json    # Symlink to latest
├── news/               # News articles
│   ├── articles.json
│   └── ingestion-reports.json
└── cache/              # Generated cache files
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

// Get all tools (loads from individual files)
const toolsRepo = getToolsRepo();
const tools = await toolsRepo.getAll();

// Get tool by slug (loads only that file)
const tool = await toolsRepo.getBySlug("chatgpt");

// Update tool (writes to individual file)
await toolsRepo.upsert({
  ...tool,
  updated_at: new Date().toISOString()
});

// Rebuild index after manual file changes
await toolsRepo.rebuildIndex();
```

## Tools Storage Architecture

### Individual File Structure (New)

As of July 2025, tools are stored as individual JSON files for better maintainability and performance:

**Benefits of Individual Files:**
- **Better Git diffs**: Changes to individual tools create cleaner diffs
- **Parallel editing**: Multiple tools can be edited simultaneously without conflicts
- **Faster access**: Loading a single tool doesn't require parsing all tools
- **Easier maintenance**: Individual files are easier to validate and update
- **Reduced memory**: Only load tools that are actually needed

**File Structure:**
```
/data/json/tools/
├── individual/           # Primary storage location
│   ├── aider.json       # Each tool stored by slug
│   ├── cursor.json
│   └── ...              # 30 individual tool files
├── tools-index.json     # Index for fast lookups
└── tools.json           # Legacy file (deprecated, kept for compatibility)
```

**Index File Structure:**
```json
{
  "metadata": {
    "total": 30,
    "last_updated": "2025-07-22T18:15:37.209Z",
    "version": "1.0.0"
  },
  "index": {
    "byId": {
      "1": { "slug": "cursor", "name": "Cursor", "category": "code-editor", ... }
    },
    "bySlug": {
      "cursor": "1"
    },
    "byCategory": {
      "code-editor": ["1", "7", "11"],
      "ai-assistant": ["3", "5", "8"]
    }
  }
}
```

### Migration from Monolithic Structure

**Previous Structure (Deprecated):**
- Single `/data/json/tools.json` file containing all 30 tools
- ~500KB file size requiring full parse for any operation
- Git conflicts when multiple tools updated

**Migration Process:**
1. Each tool extracted to `/data/json/tools/individual/{slug}.json`
2. Index file generated with lookup mappings
3. Repository updated to use individual files
4. Legacy file maintained for backward compatibility
5. Cache regeneration to use new structure

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
// Direct file read (individual tools)
const toolData = await fs.readFile('/data/json/tools/individual/cursor.json', 'utf-8');
const tool = JSON.parse(toolData);

// Load index for lookups
const indexData = await fs.readFile('/data/json/tools/tools-index.json', 'utf-8');
const index = JSON.parse(indexData);

// Using repository (recommended)
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

## Tools Repository Implementation

### Key Features

The `ToolsRepository` class (`/src/lib/json-db/tools-repository.ts`) provides:

1. **Lazy Loading**: Individual tool files are loaded on-demand
2. **In-Memory Caching**: Loaded tools are cached to avoid repeated file reads
3. **Index Management**: Maintains fast lookup indices for ID, slug, and category
4. **Atomic Operations**: All write operations are atomic with automatic backups
5. **Schema Validation**: Every tool is validated against the schema before storage

### Repository Methods

```typescript
// Core operations
await toolsRepo.getAll();              // Load all tools
await toolsRepo.getBySlug("cursor");   // Load single tool
await toolsRepo.getByCategory("code-editor"); // Filter by category
await toolsRepo.upsert(tool);          // Create or update
await toolsRepo.delete("tool-id");     // Remove tool

// Index operations
await toolsRepo.rebuildIndex();        // Rebuild lookup indices
await toolsRepo.validateAll();         // Validate all tool files
```

### Performance Characteristics

- **getBySlug()**: O(1) lookup + single file read
- **getAll()**: O(n) where n = number of tools (30 files)
- **Index rebuild**: O(n) full scan of all files
- **Memory usage**: ~2MB for full cache of 30 tools

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

## Tools Migration Guide

### Migrating from Monolithic to Individual Files

If you have an existing `tools.json` file and need to migrate to the individual file structure:

```bash
# 1. Run the migration script
npm run tools:migrate

# This will:
# - Read the existing tools.json
# - Create individual files in tools/individual/
# - Generate the tools-index.json
# - Create a backup of the original file

# 2. Verify the migration
npm run validate:tools

# 3. Update cache files
npm run cache:tools
```

### Manual Migration Steps

If automated migration is not available:

```typescript
// Migration script example
import fs from 'fs-extra';
import path from 'path';

const toolsData = await fs.readJson('./data/json/tools.json');
const individualDir = './data/json/tools/individual';

// Create individual files
for (const tool of toolsData.tools) {
  const filename = `${tool.slug}.json`;
  await fs.writeJson(
    path.join(individualDir, filename),
    tool,
    { spaces: 2 }
  );
}

// Create index
const index = {
  metadata: {
    total: toolsData.tools.length,
    last_updated: new Date().toISOString(),
    version: "2.0.0"
  },
  index: {
    byId: {},
    bySlug: {},
    byCategory: {}
  }
};

// Build indices
for (const tool of toolsData.tools) {
  index.index.byId[tool.id] = tool;
  index.index.bySlug[tool.slug] = tool.id;
  
  if (!index.index.byCategory[tool.category]) {
    index.index.byCategory[tool.category] = [];
  }
  index.index.byCategory[tool.category].push(tool.id);
}

await fs.writeJson('./data/json/tools/tools-index.json', index, { spaces: 2 });
```

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
   chmod -R 755 data/json/tools/individual/
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

4. **Tools Not Loading**
   ```bash
   # Check individual file exists
   ls data/json/tools/individual/{tool-slug}.json
   
   # Validate specific tool
   npm run validate:tool -- --slug=cursor
   
   # Rebuild index if needed
   npm run tools:rebuild-index
   ```

5. **Index Out of Sync**
   ```bash
   # Signs: Tools exist but not found by repository
   # Solution: Rebuild the index
   npm run tools:rebuild-index
   
   # Verify index integrity
   npm run tools:verify-index
   ```

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