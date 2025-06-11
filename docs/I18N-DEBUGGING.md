# I18n Debugging Guide

This document explains how to identify and fix missing translations in the AI Power Rankings application.

## Overview

The application has a resilient i18n system that prevents crashes when translations are missing. Instead of runtime errors, missing translations display as `[property.path undefined]` and are logged for debugging.

## Available Tools

### 1. Site Crawler

Systematically crawls all pages to identify missing translations:

```bash
npm run i18n:crawl
```

This script:

- Visits all major pages of the application
- Collects missing translation logs
- Provides a comprehensive report
- Groups missing translations by locale

### 2. Debug API Endpoint

Real-time access to missing translations:

```bash
# Get current missing translations
npm run i18n:debug

# Or manually:
curl http://localhost:3000/api/debug/missing-translations

# Clear the log
curl -X DELETE http://localhost:3000/api/debug/missing-translations
```

### 3. Console Logging

Missing translations are logged with the `🌐` prefix:

```
🌐 Missing translation [en]: tools.subtitle
🌐 Missing translation [en]: methodology.algorithm.title
```

## How It Works

1. **Dictionary Processing**: When a dictionary is loaded, it's merged with an expected structure
2. **Fallback Generation**: Missing properties get fallback values like `[path.to.property undefined]`
3. **Logging**: Each missing property is logged once per session to avoid spam
4. **API Access**: The debug endpoint exposes all collected missing translations

## Fixing Missing Translations

When the crawler or logs identify missing translations:

### 1. Add to Dictionary Files

Add the missing key to the appropriate dictionary file:

```json
// src/i18n/dictionaries/en.json
{
  "tools": {
    "subtitle": "Explore all {count} AI coding tools in our database"
  }
}
```

### 2. Update Expected Structure

If the missing key represents a new pattern, add it to the expected structure:

```typescript
// src/i18n/expected-structure.ts
export const EXPECTED_DICTIONARY_STRUCTURE = {
  tools: {
    subtitle: "",
    // ... other properties
  },
};
```

### 3. Fix Structural Mismatches

Sometimes the issue is a mismatch between how code accesses properties vs. how they're organized:

```typescript
// Component expects:
dict.tools.subtitle;

// But dictionary has:
dict.tools.directory.subtitle;

// Fix by either:
// A) Moving the property in the dictionary, or
// B) Updating the component to use the correct path
```

## Best Practices

1. **Run the crawler after major changes** to catch new missing translations
2. **Check console logs during development** for immediate feedback
3. **Use the debug API** to monitor missing translations in real-time
4. **Group related translations** in the dictionary structure for better organization
5. **Use descriptive fallback values** when adding new expected structure

## Common Issues

### Structural Mismatches

- Code: `dict.newsletter.form.firstName`
- Dictionary: `dict.newsletter.modal.firstName`
- Solution: Align the structure or update component paths

### Missing Placeholders

- Code: `text.replace("{count}", value)`
- Dictionary: `"Users"` (no placeholder)
- Solution: Add placeholder: `"{count} Users"`

### Case Sensitivity

- Code: `dict.categories.autonomousAgent`
- Dictionary: `dict.categories.autonomousagent`
- Solution: Add both versions or standardize casing

## Development Workflow

1. **Start development server**: `npm run dev`
2. **Make changes** to components or add new features
3. **Run crawler**: `npm run i18n:crawl`
4. **Fix missing translations** identified by the crawler
5. **Verify** by running the crawler again

This ensures a robust i18n implementation that handles missing translations gracefully while providing clear debugging information.
