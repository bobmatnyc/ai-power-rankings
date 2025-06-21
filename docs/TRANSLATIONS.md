# Translation Management Guide

This guide explains how to manage translations in the AI Power Rankings project.

## Overview

The project uses a JSON-based translation system with support for multiple languages:

- English (en) - Reference language
- German (de)
- French (fr)
- Croatian (hr)
- Italian (it)
- Japanese (jp)
- Korean (ko)
- Ukrainian (uk)

Translation files are located in: `src/i18n/dictionaries/`

## Scripts

### Sync Translations

```bash
npm run i18n:sync
```

This script:

- Reads the English reference file (`en.json`)
- Compares it with all other language files
- Adds missing keys with `[TRANSLATE]` prefix
- Preserves existing translations
- Maintains the same structure across all files

### Translation Summary

```bash
npm run i18n:summary
```

This script provides:

- Overall translation progress for each language
- Visual progress bars
- List of untranslated keys
- Translation completion percentage

### Other i18n Scripts

```bash
npm run i18n:crawl    # Crawl for missing translations in code
npm run i18n:debug    # Debug missing translations API
```

## Workflow

### Adding New Translation Keys

1. Add the new key to `en.json` with the English text
2. Run `npm run i18n:sync` to propagate the key to all language files
3. The new keys will be marked with `[TRANSLATE]` prefix in other languages
4. Translators can search for `[TRANSLATE]` to find untranslated content

### Checking Translation Status

1. Run `npm run i18n:summary` to see overall progress
2. Look for files with lower completion percentages
3. Search for `[TRANSLATE]` in specific language files

### Translation Process

1. Open the language file (e.g., `de.json` for German)
2. Search for `[TRANSLATE]`
3. Replace `[TRANSLATE] English text` with the translated text
4. Save the file
5. Run `npm run i18n:summary` to verify progress

## Best Practices

1. **Always use English as reference**: Add new keys to `en.json` first
2. **Run sync after adding keys**: Use `npm run i18n:sync` to keep files in sync
3. **Preserve placeholders**: Keep `{variable}` placeholders unchanged in translations
4. **Maintain structure**: Don't modify the JSON structure
5. **Test translations**: Check the UI after translating to ensure proper display

## Example

Adding a new translation:

1. Add to `en.json`:

```json
{
  "common": {
    "newFeature": "This is a new feature"
  }
}
```

2. Run sync:

```bash
npm run i18n:sync
```

3. Other language files will have:

```json
{
  "common": {
    "newFeature": "[TRANSLATE] This is a new feature"
  }
}
```

4. Translator updates `de.json`:

```json
{
  "common": {
    "newFeature": "Dies ist eine neue Funktion"
  }
}
```

## Troubleshooting

- **Missing translations in UI**: Run `npm run i18n:sync` to ensure all keys exist
- **Translation not showing**: Check for typos in translation keys
- **JSON parse errors**: Validate JSON syntax using a JSON validator
- **Encoding issues**: Ensure files are saved as UTF-8
