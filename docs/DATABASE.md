# Database Architecture - JSON Storage System

## Overview

AI Power Rankings uses a static JSON file-based database system for all data storage. This architecture eliminates traditional database dependencies, improves development velocity, and enables version control for all data changes.

## Architecture

### Directory Structure

```
data/
├── json/
│   ├── tools/
│   │   ├── individual/         # Individual tool files (primary)
│   │   │   ├── aider.json
│   │   │   ├── cursor.json
│   │   │   └── ...           # 30 individual tool files
│   │   ├── tools-index.json    # Lookup indices and metadata
│   │   └── tools.json          # Legacy file (deprecated)
│   ├── rankings/
│   │   ├── index.json          # Rankings metadata
│   │   └── periods/            # Individual ranking periods
│   │       ├── 2025-01.json
│   │       └── 2025-06.json
│   ├── news/
│   │   └── news.json           # News articles
│   ├── companies/
│   │   └── companies.json      # Company data
│   ├── subscribers/
│   │   └── subscribers.json    # Newsletter subscribers
│   └── settings/
│       └── site-settings.json  # Site configuration
└── backups/                    # Automated backups
    └── backup-YYYY-MM-DD-HHMMSS/
```

## Repository Pattern

All data access is managed through repository classes that extend `BaseRepository`:

### BaseRepository

```typescript
import { BaseRepository } from '@/lib/json-db/base-repository';

class YourRepository extends BaseRepository<YourDataType> {
  constructor() {
    super(filePath, defaultData);
  }
}
```

**Features:**
- Atomic writes with automatic backups
- File locking to prevent race conditions
- Automatic JSON validation
- Built-in error recovery
- Logging for all operations

### Available Repositories

1. **ToolsRepository** - `/lib/json-db/tools-repository.ts`
   - Manages AI tools data
   - Methods: `getAll()`, `getById()`, `getBySlug()`, `getByStatus()`, `create()`, `update()`, `delete()`

2. **RankingsRepository** - `/lib/json-db/rankings-repository.ts`
   - Manages ranking periods and entries
   - Methods: `getPeriods()`, `getRankingsForPeriod()`, `saveRankingsForPeriod()`, `getCurrentPeriod()`, `setCurrentPeriod()`

3. **NewsRepository** - `/lib/json-db/news-repository.ts`
   - Manages news articles
   - Methods: `getAll()`, `getById()`, `getBySlug()`, `getByDate()`, `getRecent()`, `create()`, `update()`

4. **CompaniesRepository** - `/lib/json-db/companies-repository.ts`
   - Manages company data
   - Methods: `getAll()`, `getById()`, `getBySlug()`, `create()`, `update()`, `delete()`

5. **SubscribersRepository** - `/lib/json-db/subscribers-repository.ts`
   - Manages newsletter subscribers
   - Methods: `getAll()`, `getByEmail()`, `getByStatus()`, `create()`, `update()`, `verifySubscriber()`

## Data Schemas

All data structures are defined in `/lib/json-db/schemas.ts`:

### Tool Schema
```typescript
interface Tool {
  id: string;
  slug: string;
  name: string;
  category: string;
  status: 'active' | 'inactive' | 'deprecated';
  company_id?: string;
  info: {
    summary: string;
    description: string;
    website: string;
    features: string[];
    technical: {
      context_window?: number;
      supported_languages?: number;
      // ...
    };
    business: {
      pricing_model?: string;
      business_model?: string;
      // ...
    };
    metrics: {
      github_stars?: number;
      estimated_users?: number;
      // ...
    };
  };
  created_at: string;
  updated_at: string;
}
```

### Ranking Schema
```typescript
interface RankingPeriod {
  period: string;          // "2025-06"
  algorithm_version: string;
  is_current: boolean;
  created_at: string;
  rankings: RankingEntry[];
}

interface RankingEntry {
  tool_id: string;
  tool_name: string;
  position: number;
  score: number;
  tier?: 'S' | 'A' | 'B' | 'C' | 'D';
  factor_scores: {
    agentic_capability: number;
    innovation: number;
    // ...
  };
}
```

## Usage Examples

### Reading Data

```typescript
import { getToolsRepo, getRankingsRepo } from '@/lib/json-db';

// Get all active tools
const toolsRepo = getToolsRepo();
const activeTools = await toolsRepo.getByStatus('active');

// Get current rankings
const rankingsRepo = getRankingsRepo();
const currentPeriod = await rankingsRepo.getCurrentPeriod();
const rankings = await rankingsRepo.getRankingsForPeriod(currentPeriod);
```

### Writing Data

```typescript
// Update a tool
await toolsRepo.update(toolId, {
  info: {
    metrics: {
      github_stars: 25000
    }
  }
});

// Create a new ranking period
await rankingsRepo.saveRankingsForPeriod({
  period: "2025-07",
  algorithm_version: "v6.0",
  is_current: false,
  created_at: new Date().toISOString(),
  rankings: calculatedRankings
});
```

## Backup and Recovery

### Automated Backups

The system automatically creates backups:
1. **Before every write operation** - Ensures data safety
2. **Daily at 2 AM** - Scheduled backups in production
3. **Rotation policy** - Keeps last 10 backups

### Manual Backup Commands

```bash
# Create backup
npm run backup:create

# Restore from latest backup
npm run backup:restore:latest

# Interactive restore (choose backup)
npm run backup:restore
```

### Backup Structure
```
data/backups/
└── backup-2025-06-29-220000/
    ├── tools/
    ├── rankings/
    ├── news/
    ├── companies/
    ├── subscribers/
    ├── settings/
    └── backup-metadata.json
```

## Performance Optimization

### Caching
- In-memory caching via LowDB
- File reads are cached until write operations
- No cache expiration needed (data changes infrequently)

### Indexing
Each repository maintains indices for fast lookups:
- `byId` - O(1) lookup by ID
- `bySlug` - O(1) lookup by slug
- `byDate` - O(1) lookup by date (news)
- `byStatus` - O(1) filtering by status

### File Size Management
- Tools: ~65KB (30 tools)
- Rankings: ~10KB per period
- News: ~50KB (20 articles)
- All files remain under 100KB for fast parsing

## Migration from Previous System

### From Payload CMS + Supabase
```bash
# Run migration scripts
npm run json:migrate
npm run json:migrate:historical
npm run json:validate
```

### Rollback if needed
```bash
# List available rollback points
npm run json:rollback:list

# Rollback to specific point
npm run json:rollback
```

## API Integration

All API endpoints use the repository pattern:

```typescript
// Example: /api/tools/route.ts
import { getToolsRepo } from '@/lib/json-db';

export async function GET() {
  const toolsRepo = getToolsRepo();
  const tools = await toolsRepo.getAll();
  
  return NextResponse.json({
    tools,
    _source: 'json-db'
  });
}
```

## Development Workflow

### Local Development
1. Data files are tracked in git (except backups)
2. Changes to data create diffs for review
3. Commits capture data history

### Testing
```bash
# Validate all JSON files
npm run validate:all

# Test specific repository
npm run test:api:tools
npm run test:api:rankings
```

### Deployment
1. Data files are included in the build
2. Vercel serves them as static assets
3. No database connection needed
4. Zero cold starts

## Troubleshooting

### Common Issues

1. **File locked error**
   - Another process is writing
   - Wait and retry
   - Check for hung processes

2. **Invalid JSON error**
   - Run validation: `npm run validate:all`
   - Check file syntax
   - Restore from backup if corrupted

3. **Missing data**
   - Check file exists in correct location
   - Verify file permissions
   - Run initialization: `npm run json:migrate`

### Debug Commands

```bash
# Check file integrity
npm run health:check

# View backup list
ls -la data/backups/

# Manually inspect JSON
cat data/json/tools/tools.json | jq '.tools | length'
```

## Security Considerations

1. **No SQL injection** - No SQL queries
2. **No connection strings** - No database credentials
3. **File permissions** - Managed by OS/deployment platform
4. **Validation** - All inputs validated before writing
5. **Backups** - Automatic recovery from corruption

## Future Enhancements

- [ ] Implement file-based transactions
- [ ] Add compression for large datasets
- [ ] Create data migration tooling
- [ ] Build admin UI for data management
- [ ] Add real-time sync capabilities