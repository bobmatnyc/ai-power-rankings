# News Repository Directory Modes

The NewsRepositoryV2 supports two different directory structures for storing news articles:

1. **`articles` mode** - Original structure with monthly JSON files in `/data/json/news/articles/`
2. **`by-month` mode** - New structure with enhanced monthly files in `/data/json/news/by-month/`

## Directory Mode Configuration

### Environment Variable

Set the `NEWS_DIRECTORY_MODE` environment variable to choose the mode:

```bash
# Use the new /by-month/ directory structure
export NEWS_DIRECTORY_MODE=by-month

# Use the original /articles/ directory structure (default)
export NEWS_DIRECTORY_MODE=articles
```

### Programmatic Configuration

```typescript
import { NewsRepositoryV2 } from '@/lib/json-db/news-repository-v2';

const repo = NewsRepositoryV2.getInstance();

// Switch to by-month mode
repo.setDirectoryMode('by-month');

// Check current mode
console.log(repo.getDirectoryMode()); // 'by-month'

// Switch back to articles mode
repo.setDirectoryMode('articles');
```

## Directory Structure Differences

### `/articles/` Directory (Original)

```
/data/json/news/articles/
├── 2025-07.json    # Array of NewsArticle objects
├── 2025-06.json
├── ...
└── index.json      # MonthlyIndex format
```

Each monthly file contains a simple array of articles:
```json
[
  {
    "id": "...",
    "slug": "...",
    "title": "...",
    "published_date": "2025-07-22T00:00:00.000Z",
    ...
  }
]
```

### `/by-month/` Directory (New)

```
/data/json/news/by-month/
├── 2025-07.json    # MonthlyData format with indices
├── 2025-06.json
├── ...
└── index.json      # ByMonthIndex format
```

Each monthly file contains articles with pre-built indices:
```json
{
  "articles": [...],
  "newsById": {
    "article-id": { ... }
  },
  "newsBySlug": {
    "article-slug": { ... }
  },
  "metadata": {
    "month": "2025-07",
    "articleCount": 58,
    "generatedAt": "2025-07-23T17:09:45.862Z"
  }
}
```

## Performance Benefits

The `/by-month/` structure provides:

1. **Faster lookups by ID/slug** - Uses pre-built indices instead of array searches
2. **Better scalability** - Indices remain efficient as article count grows
3. **Reduced memory usage** - Only loads necessary month data

## Auto-Detection

If no environment variable is set, the repository will auto-detect which mode to use:

1. Checks if `/by-month/` directory exists and has content
2. Falls back to `/articles/` if available
3. Defaults to `by-month` for new installations

## API Compatibility

All repository methods work identically in both modes:

```typescript
// These work the same regardless of directory mode:
await repo.getAll();
await repo.getById(id);
await repo.getBySlug(slug);
await repo.getRecent(10);
await repo.getByDate("2025-07");
await repo.search("AI");
await repo.upsert(article);
await repo.delete(id);
```

## Migration

To migrate from `/articles/` to `/by-month/` structure:

1. Run the migration script (if available)
2. Or manually convert files to include indices
3. Update `NEWS_DIRECTORY_MODE=by-month` in environment

## Date Field Handling

The repository handles both date field formats:

- `/articles/` uses `published_date` field
- `/by-month/` uses `date` field

The repository automatically handles both formats when sorting and filtering.