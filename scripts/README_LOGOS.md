# Logo Collection Scripts - Quick Reference

## Scripts Overview

### 1. Collect Tool Logos
**Script**: `collect-tool-logos.ts`
**Purpose**: Automatically download and store logos for tools

```bash
npx tsx scripts/collect-tool-logos.ts
```

**What it does**:
- Finds all active tools without logos
- Tries Clearbit API first
- Falls back to Google Favicon API
- Downloads logos to `/public/tools/`
- Updates database with logo URLs
- Rate-limited to 500ms between requests

---

### 2. Verify Logo Collection
**Script**: `verify-logos.ts`
**Purpose**: Verify logo collection status and file integrity

```bash
npx tsx scripts/verify-logos.ts
```

**What it shows**:
- Total coverage statistics
- Tools with valid logos
- Tools without logos
- Broken logo links
- File system validation

---

### 3. Check Missing Logos
**Script**: `check-missing-logos.ts`
**Purpose**: Detailed analysis of tools without logos

```bash
npx tsx scripts/check-missing-logos.ts
```

**What it shows**:
- Complete tool details for missing logos
- Available website/GitHub URLs
- Suggested logo sources
- Manual fix recommendations

---

### 4. Show Logo Samples
**Script**: `show-logo-samples.ts`
**Purpose**: Display sample database entries with logos

```bash
npx tsx scripts/show-logo-samples.ts
```

**What it shows**:
- Sample tool entries with logo URLs
- Database structure examples
- Coverage statistics

---

## Quick Commands

### Count Logo Files
```bash
ls -1 public/tools/*.png | wc -l
```

### Check Total Size
```bash
du -sh public/tools/
```

### List Logos by Size
```bash
ls -lhS public/tools/*.png
```

### View All Logo Files
```bash
ls -lh public/tools/
```

---

## Database Structure

Logos are stored in the `tools.data` JSONB field:

```typescript
{
  "data": {
    "logo_url": "/tools/cursor.png",  // Local path
    "website": "https://cursor.com",
    "github_url": "https://github.com/...",
    // ... other fields
  }
}
```

---

## File Naming Convention

Logo files follow this pattern:
```
/public/tools/{tool-slug}.png
```

Examples:
- `/public/tools/cursor.png`
- `/public/tools/github-copilot.png`
- `/public/tools/claude-code.png`

---

## Common Tasks

### Re-run Collection After Adding URLs
```bash
# 1. Update tool data in database with website URLs
# 2. Re-run collection
npx tsx scripts/collect-tool-logos.ts

# 3. Verify results
npx tsx scripts/verify-logos.ts
```

### Manual Logo Addition
```bash
# 1. Download logo to /public/tools/{slug}.png
# 2. Update database:
# UPDATE tools
# SET data = jsonb_set(data, '{logo_url}', '"/tools/{slug}.png"')
# WHERE slug = '{slug}'
```

---

## API Endpoints Used

### Clearbit Logo API
```
https://logo.clearbit.com/{domain}
```
- Returns high-quality official logos
- Free for reasonable use
- ~68% success rate

### Google Favicon API
```
https://www.google.com/s2/favicons?domain={domain}&sz=256
```
- Returns favicon-based logos
- Always available
- Lower quality than Clearbit
- ~32% success rate

---

## Troubleshooting

### "No URL available"
**Problem**: Tool has no website or GitHub URL in database
**Solution**: Add website URL to `tool.data.website` field and re-run

### "Logo download failed"
**Problem**: Both APIs returned errors
**Solution**: Download logo manually and save to `/public/tools/{slug}.png`

### "Broken logo link"
**Problem**: Logo URL points to external/missing resource
**Solution**: Download the logo, save locally, update database

---

## Implementation Stats

- **Total Scripts**: 4 (480 LOC)
- **Logos Collected**: 38
- **Success Rate**: 77.6%
- **File Storage**: `/public/tools/` (324 KB)
- **Database Updates**: 38 tools

---

## Next Steps

1. Add website URLs for 10 tools without URLs
2. Manually collect Flint logo
3. Fix Anything Max broken logo link
4. Re-run collection script
5. Achieve 100% coverage

---

For detailed implementation information, see:
- `LOGO_COLLECTION_SUMMARY.md` - Full implementation guide
- `LOGO_COLLECTION_EVIDENCE.md` - Evidence report with all results
