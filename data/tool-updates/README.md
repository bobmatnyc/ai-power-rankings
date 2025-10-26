# AI Tool Database Updates

Simple data-driven approach for updating tool content in the database.

## Overview

This directory contains JSON files with tool content updates. Each file represents a phase or batch of tool updates.

Instead of maintaining 48+ individual update scripts (18,609 lines), we use a single parametrized script (`scripts/update-tools.ts`) that reads these JSON data files.

## Usage

### Update Tools from JSON

```bash
npx tsx scripts/update-tools.ts --file data/tool-updates/phase4-9-tools.json
```

### Verify Tool Content Quality

```bash
# Verify specific tools
npx tsx scripts/verify-tools.ts --slugs coderabbit,snyk-code

# Verify all tools
npx tsx scripts/verify-tools.ts --all
```

## JSON File Format

Each JSON file has the following structure:

```json
{
  "phase": "Phase 4: Specialized Tools",
  "description": "Code review and security analysis tools",
  "tools": [
    {
      "slug": "coderabbit",
      "data": {
        "id": "coderabbit",
        "name": "CodeRabbit",
        "company": "CodeRabbit Inc.",
        "tagline": "AI-powered code review platform",
        "description": "...",
        "overview": "...",
        "features": [...],
        "use_cases": [...],
        "pricing": {...},
        "info": {...}
      }
    }
  ]
}
```

## Files

- **phase4-9-tools.json** - Phase 4: 9 specialized tools (code review, security)
- **phase5-10-tools.json** - Phase 5: 10 critical tools (AI assistants, code generators)
- **phase6-7-tools.json** - Phase 6: 7 enterprise tools (team collaboration, workflow)
- **phase7a-use-cases.json** - Phase 7A: Use cases for 22 tools

## Benefits

1. **Reduced Complexity**: One update script instead of 48
2. **Easy Maintenance**: Edit JSON data, not code
3. **Version Control**: Track changes to tool data clearly
4. **Reusability**: Same script works for all phases
5. **Validation**: Single point for quality checks

## Migration from Old Scripts

The tool data was extracted from the original phase-specific scripts:
- `scripts/phase4/` → `phase4-9-tools.json`
- `scripts/phase5/` → `phase5-10-tools.json`
- `scripts/phase6/` → `phase6-7-tools.json`
- `scripts/phase7a/` → `phase7a-use-cases.json`

Line count reduction: ~18,000 lines → ~1,000 lines (95% reduction)
