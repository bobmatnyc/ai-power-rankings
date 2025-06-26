# Cache Management Documentation

## Overview

The AI Power Rankings platform uses a **cache-first architecture** to ensure reliable operation even when the database is unavailable. This is achieved through a hybrid caching system:

- **Local Development**: Uses filesystem cache (src/data/cache/)
- **Production**: Uses Vercel Blob storage with filesystem fallback

## Architecture

### Cache Files Location

All cache files are stored in: `/src/data/cache/`

- `rankings.json` - Pre-calculated rankings with scores and positions
- `tools.json` - Complete tools database with metadata
- `news.json` - News articles and updates

### How Cache Works

#### Local Development
1. Cache files are stored in `/src/data/cache/`
2. Direct filesystem read/write access
3. Changes persist between server restarts

#### Production (Vercel)
1. **Priority Order**:
   - Vercel Blob storage (if available)
   - Filesystem cache files (fallback)
2. **Blob Storage Behavior**:
   - Generated cache is stored in Vercel Blob
   - Blob takes precedence over filesystem
   - Each deployment resets blob storage
   - Source files serve as baseline
3. **Client Processing**: All filtering, sorting, and pagination happens client-side

## Cache Generation

### Local Development

In local development, cache files can be written directly to the filesystem:

```bash
# Via Dashboard UI
1. Navigate to /dashboard/cache
2. Click "Generate" for each cache type
3. Files are automatically written to src/data/cache/

# Via API
POST /api/admin/cache/generate
Body: { "type": "all" | "rankings" | "tools" | "news" }
```

### Production (Vercel)

#### With Vercel Blob Storage (Recommended)

When `BLOB_READ_WRITE_TOKEN` is configured:

1. **Generate Cache Data**
   - Access `/dashboard/cache` in production
   - Click "Generate" to create fresh data from database
   - Data is automatically stored in Vercel Blob

2. **Blob Storage Behavior**
   - Blob cache takes precedence over filesystem
   - Cache persists until next deployment
   - Each deployment resets to source files
   - Useful for temporary cache updates

3. **Permanent Updates**
   - Download cache files
   - Commit to repository for persistent changes

#### Without Blob Storage (Fallback)

**Note**: Without blob storage, Vercel's serverless environment has a **read-only filesystem**.

1. **Generate Cache Data**
   - Access `/dashboard/cache` in production
   - Click "Generate" to create fresh data from database

2. **Download Cache Files**
   - Click "Download" for each cache type
   - Save the JSON files locally

3. **Update Repository**
   ```bash
   # Replace cache files in your local repo
   cp ~/Downloads/rankings.json src/data/cache/
   cp ~/Downloads/tools.json src/data/cache/
   cp ~/Downloads/news.json src/data/cache/
   
   # Commit and push
   git add src/data/cache/
   git commit -m "chore: update cache files"
   git push
   ```

4. **Deploy**
   - Vercel automatically deploys with updated cache files

## API Endpoints

### Cache Status
```
GET /api/admin/cache/status
```
Returns:
- Cache file status (source, size, last modified)
- Storage configuration (blob availability)
- Environment information

### Generate Cache
```
POST /api/admin/cache/generate
Body: { "type": "all" | "rankings" | "tools" | "news" }
```
Generates fresh cache data from the database:
- **Local**: Writes to filesystem
- **Production with Blob**: Stores in Vercel Blob
- **Production without Blob**: Generates data for download

### Download Cache
```
GET /api/admin/cache/download?type=rankings|tools|news
```
Downloads cache data:
- First tries to load from current cache (blob or filesystem)
- Falls back to generating fresh data if not available

## Cache Update Schedule

### Recommended Update Frequency

- **Rankings**: Monthly (after new rankings calculation)
- **Tools**: Weekly (or when tools are added/updated)
- **News**: Daily (or when significant news is added)

### Automatic Cache Usage

Cache is automatically used when:
- `USE_CACHE_FALLBACK=true` environment variable is set
- `VERCEL_ENV=preview` (preview deployments)
- Database connection fails
- Temporarily enabled for all environments (stability mode)

### Vercel Blob Configuration

To enable Vercel Blob storage:

1. **Add Blob to Vercel Project**:
   ```bash
   vercel blob add
   ```

2. **Set Environment Variable**:
   ```bash
   # This is automatically set by Vercel when blob is enabled
   BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxx...
   ```

3. **Verify Configuration**:
   - Check `/dashboard/cache` for "Blob Storage" indicator
   - Cache status will show source as "blob" when active

## Implementation Details

### Rankings Cache Structure
```json
{
  "rankings": [
    {
      "rank": 1,
      "tool": { "id": "...", "name": "...", ... },
      "scores": { ... },
      "metrics": { ... }
    }
  ],
  "algorithm": { "version": "v6-news", ... },
  "stats": { ... },
  "_cached": true,
  "_cachedAt": "2025-06-25T13:36:00.000Z"
}
```

### Tools Cache Structure
```json
{
  "tools": [
    {
      "id": "tool-id",
      "slug": "tool-slug",
      "name": "Tool Name",
      "category": "category",
      "info": { ... }
    }
  ],
  "total": 50,
  "generated_at": "2025-06-25T13:36:00.000Z"
}
```

### News Cache Structure
```json
{
  "news": [
    {
      "id": "news-id",
      "title": "Article Title",
      "published_at": "2025-06-25",
      "related_tools": ["tool-id-1", "tool-id-2"],
      ...
    }
  ],
  "total": 100,
  "generated_at": "2025-06-25T13:36:00.000Z"
}
```

## Best Practices

1. **Regular Updates**: Keep cache files updated with latest data
2. **Version Control**: Always commit cache updates with descriptive messages
3. **Testing**: Test cache generation locally before production updates
4. **Monitoring**: Check cache file dates and sources in dashboard
5. **Backup**: Keep local backups of cache files before updates
6. **Blob Usage**: Use blob storage for temporary updates, commit to repo for permanent changes

## Troubleshooting

### Cache Not Updating
- Ensure you have admin access (`ADMIN_EMAIL` environment variable)
- Check API endpoint responses for errors
- Verify database connection is working

### Production Cache Issues
- Remember: Cannot write files in Vercel production
- Must download and update via repository
- Check Vercel deployment logs for cache loading errors

### Performance Issues
- Large cache files may slow initial page loads
- Consider implementing incremental updates
- Monitor cache file sizes regularly

## Storage Comparison

| Feature | Filesystem (Dev) | Blob Storage (Prod) | Source Files (Fallback) |
|---------|-----------------|---------------------|------------------------|
| Write Access | ✅ Yes | ✅ Yes | ❌ No (read-only) |
| Persistence | ✅ Permanent | ⚡ Until deployment | ✅ Permanent |
| Performance | 🚀 Fast | 🚀 Fast | 🚀 Fast |
| Priority | Default | Highest | Lowest |
| Use Case | Development | Temporary updates | Baseline data |

## Future Improvements

1. **Automated Cache Updates**: GitHub Actions to update cache files
2. **Incremental Updates**: Update only changed data
3. **Cache Versioning**: Track cache schema versions
4. **Compression**: Reduce cache file sizes
5. **CDN Distribution**: Serve cache files from CDN
6. **Blob Persistence**: Option to persist blob storage across deployments